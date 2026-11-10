/**
 * Amazon Cognito 호출 모음. 비밀번호 저장·검증·이메일 인증 코드 발송은 모두 Cognito가 맡는다.
 *
 * 사용자 풀은 이메일을 로그인 ID로 쓰고(대소문자 무시), Cognito 내부 사용자 이름은 sub(UUID)다.
 * 관리자 API(Admin*)는 서버의 IAM 역할 권한으로만 부를 수 있다.
 */
import { createHmac } from 'node:crypto'
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  ChangePasswordCommand,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider'
import { cognitoClient } from './clients'
import type { MembersConfig } from './config'
import { MemberError } from './errors'

function secretHash(config: MembersConfig, username: string): string | undefined {
  if (!config.clientSecret) return undefined
  return createHmac('sha256', config.clientSecret).update(username + config.clientId).digest('base64')
}

/** Cognito 예외 → 앱 오류 코드. 원문 메시지는 서버 로그에만 남긴다 */
export function fromCognito(error: unknown, scope: string): MemberError {
  if (error instanceof MemberError) return error
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  const message = error instanceof Error ? error.message : ''
  switch (name) {
    case 'UsernameExistsException':
    case 'AliasExistsException':
      return new MemberError('email_taken')
    case 'InvalidPasswordException':
      return new MemberError('weak_password')
    case 'CodeMismatchException':
      return new MemberError('code_mismatch')
    case 'ExpiredCodeException':
      return new MemberError('code_expired')
    case 'UserNotConfirmedException':
      return new MemberError('not_confirmed')
    case 'PasswordResetRequiredException':
      return new MemberError('password_reset_required')
    case 'UserNotFoundException':
      return new MemberError('invalid_credentials')
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return new MemberError('rate_limited')
    case 'CodeDeliveryFailureException':
      return new MemberError('delivery_failed')
    case 'InvalidParameterException':
      return new MemberError('bad_request')
    case 'NotAuthorizedException':
      if (/disabled/i.test(message)) return new MemberError('disabled')
      if (/current status is confirmed/i.test(message)) return new MemberError('already_confirmed')
      return new MemberError('invalid_credentials')
    default:
      console.error(`[members:${scope}] cognito ${name || 'error'}: ${message}`)
      return new MemberError('unavailable')
  }
}

async function call<T>(scope: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    throw fromCognito(error, scope)
  }
}

export interface IdClaims {
  sub: string
  /** Cognito 내부 사용자 이름 (이메일 로그인 풀에서는 sub와 같다) */
  username: string
  email: string
  name: string | null
}

/** Cognito가 방금 TLS로 돌려준 ID 토큰의 본문만 읽는다 (서명 검증은 요청 인증 때 액세스 토큰으로 한다) */
export function readIdToken(idToken: string): IdClaims {
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
  if (!sub || !email) throw new MemberError('unavailable')
  const username = typeof payload['cognito:username'] === 'string' ? payload['cognito:username'] : sub
  return { sub, username, email, name: typeof payload.name === 'string' && payload.name ? payload.name : null }
}

/* ── 회원 본인 흐름 (공개 API) ───────────────────────────────────── */

export async function signUp(config: MembersConfig, input: { email: string; password: string; name: string }): Promise<string> {
  const result = await call('signUp', () =>
    cognitoClient(config).send(
      new SignUpCommand({
        ClientId: config.clientId,
        SecretHash: secretHash(config, input.email),
        Username: input.email,
        Password: input.password,
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'name', Value: input.name },
        ],
      }),
    ),
  )
  if (!result.UserSub) throw new MemberError('unavailable')
  return result.UserSub
}

export async function confirmSignUp(config: MembersConfig, email: string, code: string): Promise<void> {
  await call('confirmSignUp', () =>
    cognitoClient(config).send(
      new ConfirmSignUpCommand({
        ClientId: config.clientId,
        SecretHash: secretHash(config, email),
        Username: email,
        ConfirmationCode: code,
      }),
    ),
  )
}

export async function resendCode(config: MembersConfig, email: string): Promise<void> {
  await call('resendCode', () =>
    cognitoClient(config).send(
      new ResendConfirmationCodeCommand({ ClientId: config.clientId, SecretHash: secretHash(config, email), Username: email }),
    ),
  )
}

export interface Tokens {
  accessToken: string
  idToken: string
  refreshToken: string | null
  expiresIn: number
}

export async function passwordLogin(config: MembersConfig, email: string, password: string): Promise<Tokens> {
  const result = await call('login', () =>
    cognitoClient(config).send(
      new InitiateAuthCommand({
        ClientId: config.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          ...(config.clientSecret ? { SECRET_HASH: secretHash(config, email) as string } : {}),
        },
      }),
    ),
  ).catch((error: unknown) => {
    // 로그인에서 '비밀번호 형식' 오류는 '비밀번호가 틀림'과 같게 다룬다
    if (error instanceof MemberError && error.code === 'weak_password') throw new MemberError('invalid_credentials')
    throw error
  })
  // 콘솔에서 임시 비밀번호로 만든 계정 등: 비밀번호를 새로 정해야 한다
  if (result.ChallengeName) throw new MemberError('password_reset_required')
  const auth = result.AuthenticationResult
  if (!auth?.AccessToken || !auth.IdToken) throw new MemberError('unavailable')
  return { accessToken: auth.AccessToken, idToken: auth.IdToken, refreshToken: auth.RefreshToken ?? null, expiresIn: auth.ExpiresIn ?? 3600 }
}

/** username: 비밀키가 있는 클라이언트의 SECRET_HASH 계산용 (Cognito 사용자 이름 = sub) */
export async function refreshTokens(config: MembersConfig, refreshToken: string, username: string | null): Promise<Tokens> {
  const result = await call('refresh', () =>
    cognitoClient(config).send(
      new InitiateAuthCommand({
        ClientId: config.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          ...(config.clientSecret && username ? { SECRET_HASH: secretHash(config, username) as string } : {}),
        },
      }),
    ),
  )
  const auth = result.AuthenticationResult
  if (!auth?.AccessToken || !auth.IdToken) throw new MemberError('invalid_credentials')
  return { accessToken: auth.AccessToken, idToken: auth.IdToken, refreshToken: auth.RefreshToken ?? null, expiresIn: auth.ExpiresIn ?? 3600 }
}

export async function revokeRefreshToken(config: MembersConfig, refreshToken: string): Promise<void> {
  await call('revoke', () =>
    cognitoClient(config).send(
      new RevokeTokenCommand({ ClientId: config.clientId, Token: refreshToken, ...(config.clientSecret ? { ClientSecret: config.clientSecret } : {}) }),
    ),
  )
}

export async function forgotPassword(config: MembersConfig, email: string): Promise<void> {
  await call('forgotPassword', () =>
    cognitoClient(config).send(
      new ForgotPasswordCommand({ ClientId: config.clientId, SecretHash: secretHash(config, email), Username: email }),
    ),
  )
}

export async function confirmForgotPassword(config: MembersConfig, email: string, code: string, password: string): Promise<void> {
  await call('confirmForgotPassword', () =>
    cognitoClient(config).send(
      new ConfirmForgotPasswordCommand({
        ClientId: config.clientId,
        SecretHash: secretHash(config, email),
        Username: email,
        ConfirmationCode: code,
        Password: password,
      }),
    ),
  )
}

export async function changePassword(config: MembersConfig, accessToken: string, previous: string, next: string): Promise<void> {
  await call('changePassword', () =>
    cognitoClient(config).send(new ChangePasswordCommand({ AccessToken: accessToken, PreviousPassword: previous, ProposedPassword: next })),
  )
}

/* ── 관리자 API (서버 IAM 역할 권한) ───────────────────────────────── */

export interface CognitoUser {
  username: string
  sub: string
  email: string
  name: string | null
  confirmed: boolean
  enabled: boolean
}

const attr = (list: AttributeType[] | undefined, name: string) => list?.find((item) => item.Name === name)?.Value ?? null

export async function adminGetUser(config: MembersConfig, username: string): Promise<CognitoUser | null> {
  try {
    const user = await cognitoClient(config).send(new AdminGetUserCommand({ UserPoolId: config.userPoolId, Username: username }))
    const sub = attr(user.UserAttributes, 'sub')
    const email = attr(user.UserAttributes, 'email')
    if (!user.Username || !sub || !email) return null
    return {
      username: user.Username,
      sub,
      email: email.toLowerCase(),
      name: attr(user.UserAttributes, 'name'),
      confirmed: user.UserStatus === 'CONFIRMED',
      enabled: user.Enabled !== false,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'UserNotFoundException') return null
    throw fromCognito(error, 'adminGetUser')
  }
}

export async function adminSetName(config: MembersConfig, username: string, name: string): Promise<void> {
  await call('adminSetName', () =>
    cognitoClient(config).send(
      new AdminUpdateUserAttributesCommand({ UserPoolId: config.userPoolId, Username: username, UserAttributes: [{ Name: 'name', Value: name }] }),
    ),
  )
}

/** 비활성화: 로그인을 막고, 발급된 리프레시 토큰을 모두 무효로 만든다 */
export async function adminDisable(config: MembersConfig, username: string): Promise<void> {
  await call('adminDisable', () => cognitoClient(config).send(new AdminDisableUserCommand({ UserPoolId: config.userPoolId, Username: username })))
  // 차단 자체는 DynamoDB 상태(요청마다 확인)와 위의 Cognito 비활성화(로그인·토큰 갱신 거절)로 이미 성립한다.
  // 리프레시 토큰 폐기는 추가 방어라서 실패해도 작업을 실패로 돌리지 않고 기록만 남긴다.
  await adminSignOutEverywhere(config, username).catch((error: unknown) =>
    console.error('[members:adminDisable] global sign-out failed:', error instanceof Error ? error.message : error),
  )
}

/** 이 사용자의 리프레시 토큰을 모두 폐기한다 (다른 기기 세션 종료) */
export async function adminSignOutEverywhere(config: MembersConfig, username: string): Promise<void> {
  await call('adminSignOut', () =>
    cognitoClient(config).send(new AdminUserGlobalSignOutCommand({ UserPoolId: config.userPoolId, Username: username })),
  )
}

export async function adminEnable(config: MembersConfig, username: string): Promise<void> {
  await call('adminEnable', () => cognitoClient(config).send(new AdminEnableUserCommand({ UserPoolId: config.userPoolId, Username: username })))
}

/** 이미 없는 사용자는 성공으로 본다 (삭제를 다시 시도해도 안전) */
export async function adminDelete(config: MembersConfig, username: string): Promise<void> {
  try {
    await cognitoClient(config).send(new AdminDeleteUserCommand({ UserPoolId: config.userPoolId, Username: username }))
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'UserNotFoundException') return
    throw fromCognito(error, 'adminDelete')
  }
}

/**
 * 기존(Supabase) 회원을 Cognito로 옮긴다. 이메일은 이미 인증된 것으로 두고 안내 메일은 보내지 않는다.
 * 기존 비밀번호가 새 정책에 맞으면 그대로 쓰고, 아니면 false를 돌려준다 (비밀번호 재설정 필요).
 */
export async function adminCreateMigrated(
  config: MembersConfig,
  input: { email: string; name: string; password: string; fallbackPassword: string },
): Promise<boolean> {
  const created = await call('migrateCreate', () =>
    cognitoClient(config).send(
      new AdminCreateUserCommand({
        UserPoolId: config.userPoolId,
        Username: input.email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: input.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: input.name },
        ],
      }),
    ),
  )
  const username = created.User?.Username ?? input.email
  try {
    await cognitoClient(config).send(
      new AdminSetUserPasswordCommand({ UserPoolId: config.userPoolId, Username: username, Password: input.password, Permanent: true }),
    )
    return true
  } catch (error) {
    if (!(error && typeof error === 'object' && 'name' in error && error.name === 'InvalidPasswordException')) {
      throw fromCognito(error, 'migratePassword')
    }
    // 정책에 맞지 않는 옛 비밀번호: 아무도 모르는 임의 비밀번호로 확정해 두고 재설정 메일로 새로 정하게 한다
    await call('migrateFallback', () =>
      cognitoClient(config).send(
        new AdminSetUserPasswordCommand({ UserPoolId: config.userPoolId, Username: username, Password: input.fallbackPassword, Permanent: true }),
      ),
    )
    return false
  }
}
