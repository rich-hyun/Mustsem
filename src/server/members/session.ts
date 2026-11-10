/**
 * 로그인 세션. 토큰은 브라우저 스크립트가 읽을 수 없는 httpOnly 쿠키에만 둔다.
 *
 *   ms_at   액세스 토큰 (1시간, /api 경로에만 전송)
 *   ms_rt   리프레시 토큰 (30일, /api 경로에만 전송)
 *   ms_u    Cognito 사용자 이름(sub) (비밀키 클라이언트의 갱신 계산용)
 *   ms_auth "1" (스크립트가 읽는 표시. 로그인 흔적이 있는 방문자만 세션을 확인하게 한다. 권한 정보 없음)
 *
 * 요청마다: 액세스 토큰 서명·만료·클라이언트 검증 → (만료면 리프레시로 갱신) → DynamoDB에서 프로필을 다시 읽어
 * 상태(비활성)와 역할(관리자)을 판단한다. 관리자가 비활성화하면 이미 발급된 토큰으로도 다음 요청부터 막힌다.
 */
import { CognitoJwtVerifier, JwtRsaVerifier } from 'aws-jwt-verify'
import type { NextRequest, NextResponse } from 'next/server'
import type { MemberProfile } from '@/lib/account'
import { refreshTokens, type Tokens } from './cognito'
import { membersConfig, secureCookies, type MembersConfig } from './config'
import { MemberError } from './errors'
import { fail } from './http'
import { getProfile } from './profiles'

const ACCESS = 'ms_at'
const REFRESH = 'ms_rt'
const USERNAME = 'ms_u'
const HINT = 'ms_auth'
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60

interface AccessClaims {
  sub: string
  username: string
}

type Verify = (token: string) => Promise<AccessClaims>
let verifier: { key: string; verify: Verify } | null = null

function accessVerifier(config: MembersConfig): Verify {
  const key = `${config.userPoolId}|${config.clientId}|${config.cognitoEndpoint ?? ''}`
  if (verifier?.key === key) return verifier.verify

  let verify: Verify
  if (config.cognitoEndpoint) {
    // 로컬 에뮬레이터: 발급자 주소가 Cognito 형식이 아니라 일반 RSA 검증기로 같은 항목을 확인한다
    const issuer = `${config.cognitoEndpoint.replace(/\/+$/, '')}/${config.userPoolId}`
    const jwksUri = `${issuer}/.well-known/jwks.json`
    const local = JwtRsaVerifier.create({ issuer, audience: null, jwksUri })
    // 검증 라이브러리는 https 키 주소만 받으므로, 에뮬레이터(http)의 키는 직접 받아 넣어 둔다
    let keysLoaded: Promise<void> | null = null
    verify = async (token) => {
      keysLoaded ??= fetch(jwksUri, { cache: 'no-store' })
        .then((response) => response.json())
        .then((jwks) => local.cacheJwks(jwks))
        .catch((error: unknown) => {
          keysLoaded = null
          throw error
        })
      await keysLoaded
      const payload = await local.verify(token)
      if (payload.token_use !== 'access' || payload.client_id !== config.clientId) throw new Error('token not for this client')
      return { sub: String(payload.sub), username: String(payload.username ?? payload['cognito:username'] ?? payload.sub) }
    }
  } else {
    const cognito = CognitoJwtVerifier.create({ userPoolId: config.userPoolId, tokenUse: 'access', clientId: config.clientId })
    verify = async (token) => {
      const payload = await cognito.verify(token)
      return { sub: payload.sub, username: payload.username }
    }
  }
  verifier = { key, verify }
  return verify
}

const cookieBase = () => ({ httpOnly: true, secure: secureCookies(), sameSite: 'lax' as const, path: '/api' })

/** 로그인·갱신 직후 쿠키를 심는다 */
export function setSessionCookies(response: NextResponse, tokens: Tokens, username: string): NextResponse {
  response.cookies.set(ACCESS, tokens.accessToken, { ...cookieBase(), maxAge: tokens.expiresIn })
  if (tokens.refreshToken) {
    response.cookies.set(REFRESH, tokens.refreshToken, { ...cookieBase(), maxAge: REFRESH_MAX_AGE })
    response.cookies.set(USERNAME, username, { ...cookieBase(), maxAge: REFRESH_MAX_AGE })
    response.cookies.set(HINT, '1', { secure: secureCookies(), sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE })
  }
  return response
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  for (const name of [ACCESS, REFRESH, USERNAME]) response.cookies.set(name, '', { ...cookieBase(), maxAge: 0 })
  response.cookies.set(HINT, '', { secure: secureCookies(), sameSite: 'lax', path: '/', maxAge: 0 })
  return response
}

export const refreshTokenOf = (request: NextRequest) => request.cookies.get(REFRESH)?.value ?? null

export interface Authenticated {
  config: MembersConfig
  profile: MemberProfile
  accessToken: string
  /** 응답에 갱신된 쿠키를 붙인다 (갱신이 없었으면 그대로) */
  finish: (response: NextResponse) => NextResponse
}

export type AuthOutcome = { ok: true; auth: Authenticated } | { ok: false; response: NextResponse }

/**
 * 요청한 회원을 확인한다. role: 'ADMIN'이면 관리자만 통과.
 * 실패 응답: 503(설정 없음) · 401(로그인 필요, 쿠키 지움) · 403 disabled(쿠키 지움) · 403 forbidden(권한 없음)
 */
export async function authenticate(request: NextRequest, { role }: { role?: 'ADMIN' } = {}): Promise<AuthOutcome> {
  const config = membersConfig()
  if (!config) return { ok: false, response: fail('unavailable') }
  const signedOut = (code: 'unauthenticated' | 'disabled') => ({ ok: false as const, response: clearSessionCookies(fail(code)) })

  const verify = accessVerifier(config)
  let accessToken = request.cookies.get(ACCESS)?.value ?? null
  let claims: AccessClaims | null = null
  let refreshed: Tokens | null = null

  if (accessToken) {
    claims = await verify(accessToken).catch(() => null)
  }
  if (!claims) {
    const refreshToken = refreshTokenOf(request)
    if (!refreshToken) return signedOut('unauthenticated')
    try {
      refreshed = await refreshTokens(config, refreshToken, request.cookies.get(USERNAME)?.value ?? null)
      accessToken = refreshed.accessToken
      claims = await verify(accessToken)
    } catch (error) {
      if (error instanceof MemberError && error.code === 'unavailable') return { ok: false, response: fail('unavailable') }
      return signedOut('unauthenticated')
    }
  }

  let profile: MemberProfile | null
  try {
    profile = await getProfile(config, claims.sub)
  } catch (error) {
    console.error('[members:session] profile read failed:', error instanceof Error ? error.message : error)
    return { ok: false, response: fail('unavailable') }
  }
  // 프로필이 없으면(관리자가 삭제한 계정 등) 세션을 끝낸다
  if (!profile) return signedOut('unauthenticated')
  if (profile.status !== 'ACTIVE') return signedOut('disabled')
  if (role === 'ADMIN' && profile.role !== 'ADMIN') return { ok: false, response: fail('forbidden') }

  const username = claims.username
  const tokens = refreshed
  return {
    ok: true,
    auth: {
      config,
      profile,
      accessToken: accessToken as string,
      // 갱신 응답에는 리프레시 토큰이 없으므로 액세스 토큰만 바꾼다
      finish: (response) => (tokens ? setSessionCookies(response, { ...tokens, refreshToken: null }, username) : response),
    },
  }
}

export function sessionUser(profile: MemberProfile) {
  return { userId: profile.userId, email: profile.email, name: profile.name, role: profile.role }
}
