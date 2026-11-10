/**
 * 회원 프로필·작업 기록 저장소 (Amazon DynamoDB).
 *
 * 회원 테이블  (PK userId = Cognito sub)
 *   name, email, role(USER|ADMIN), status(ACTIVE|DISABLED), emailVerified, company, marketingAgreed,
 *   createdAt, updatedAt, lastLoginAt
 * 작업 기록 테이블 (PK targetUserId, SK at = ISO시각#난수)
 *   action, actorId, actorEmail, targetEmail, detail
 *
 * 역할(role)·상태(status)의 원본은 이 테이블이다. 서버는 요청마다 여기서 다시 읽어 권한을 판단하므로
 * 토큰을 조작하거나 오래된 세션을 써도 권한이 바뀌지 않는다. 비밀번호는 Cognito만 가지고 있다.
 */
import { randomBytes } from 'node:crypto'
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { MemberProfile, MemberRole, MemberStatus } from '@/lib/account'
import { dynamo } from './clients'
import type { MembersConfig } from './config'

type Item = Record<string, unknown>

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

export function toProfile(item: Item | undefined): MemberProfile | null {
  if (!item) return null
  const userId = str(item.userId)
  const email = str(item.email)
  if (!userId || !email) return null
  const createdAt = str(item.createdAt) ?? new Date(0).toISOString()
  return {
    userId,
    email,
    name: str(item.name) ?? email.split('@')[0] ?? '',
    role: item.role === 'ADMIN' ? 'ADMIN' : 'USER',
    status: item.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    emailVerified: item.emailVerified === true,
    company: str(item.company),
    marketingAgreed: item.marketingAgreed === true,
    createdAt,
    updatedAt: str(item.updatedAt) ?? createdAt,
    lastLoginAt: str(item.lastLoginAt),
  }
}

export async function getProfile(config: MembersConfig, userId: string): Promise<MemberProfile | null> {
  const { Item } = await dynamo(config).send(
    new GetCommand({ TableName: config.usersTable, Key: { userId }, ConsistentRead: true }),
  )
  return toProfile(Item)
}

export interface NewProfile {
  userId: string
  email: string
  name: string
  emailVerified: boolean
  company?: string | null
  marketingAgreed?: boolean
}

/**
 * 프로필이 없을 때만 만든다 (있으면 그대로 돌려준다). 회원가입·인증·로그인 어느 단계에서 불러도 안전해서
 * 중간 단계가 실패해도 다음 단계가 빈자리를 채운다. 역할은 언제나 USER로 시작한다.
 */
export async function ensureProfile(config: MembersConfig, input: NewProfile): Promise<MemberProfile> {
  const now = new Date().toISOString()
  const item = {
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: 'USER' satisfies MemberRole,
    status: 'ACTIVE' satisfies MemberStatus,
    emailVerified: input.emailVerified,
    company: input.company ?? undefined,
    marketingAgreed: input.marketingAgreed ?? false,
    createdAt: now,
    updatedAt: now,
  }
  try {
    await dynamo(config).send(
      new PutCommand({ TableName: config.usersTable, Item: item, ConditionExpression: 'attribute_not_exists(userId)' }),
    )
    return toProfile(item) as MemberProfile
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error
    const existing = await getProfile(config, input.userId)
    if (!existing) throw error
    return existing
  }
}

async function update(
  config: MembersConfig,
  userId: string,
  set: Record<string, unknown>,
  { touch = true }: { touch?: boolean } = {},
): Promise<MemberProfile | null> {
  const values: Record<string, unknown> = { ...set }
  if (touch) values.updatedAt = new Date().toISOString()
  const names: Record<string, string> = {}
  const expressionValues: Record<string, unknown> = {}
  const parts = Object.entries(values).map(([key, value]) => {
    names[`#${key}`] = key
    expressionValues[`:${key}`] = value
    return `#${key} = :${key}`
  })
  try {
    const { Attributes } = await dynamo(config).send(
      new UpdateCommand({
        TableName: config.usersTable,
        Key: { userId },
        UpdateExpression: `SET ${parts.join(', ')}`,
        ConditionExpression: 'attribute_exists(userId)',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_NEW',
      }),
    )
    return toProfile(Attributes)
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return null
    throw error
  }
}

/**
 * 로그인 성공 기록. 정보 수정이 아니라 updatedAt은 건드리지 않는다.
 * email: Cognito가 확인한 현재 이메일 (인증을 거쳐 바뀐 경우 프로필도 맞춘다)
 */
export const recordLogin = (config: MembersConfig, userId: string, email?: string) =>
  update(
    config,
    userId,
    { lastLoginAt: new Date().toISOString(), emailVerified: true, ...(email ? { email } : {}) },
    { touch: Boolean(email) },
  )

export const markVerified = (config: MembersConfig, userId: string) =>
  update(config, userId, { emailVerified: true }, { touch: false })

export const updateOwnProfile = (config: MembersConfig, userId: string, fields: { name: string; company: string | null; marketingAgreed: boolean }) =>
  update(config, userId, { name: fields.name, company: fields.company ?? '', marketingAgreed: fields.marketingAgreed })

export const setStatus = (config: MembersConfig, userId: string, status: MemberStatus) => update(config, userId, { status })

export async function deleteProfile(config: MembersConfig, userId: string): Promise<void> {
  await dynamo(config).send(new DeleteCommand({ TableName: config.usersTable, Key: { userId } }))
}

/**
 * 전체 회원 목록. 회원 수가 수만 명 이하인 동안은 한 번 훑어 서버에서 검색·필터·정렬하는 편이
 * 인덱스를 여러 개 두는 것보다 단순하고 싸다 (회원 1명 ≈ 0.3KB, 1만 명 ≈ 3MB 읽기).
 */
export async function scanProfiles(config: MembersConfig): Promise<MemberProfile[]> {
  const profiles: MemberProfile[] = []
  let startKey: Record<string, unknown> | undefined
  do {
    const page = await dynamo(config).send(
      new ScanCommand({ TableName: config.usersTable, ExclusiveStartKey: startKey }),
    )
    for (const item of page.Items ?? []) {
      const profile = toProfile(item)
      if (profile) profiles.push(profile)
    }
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return profiles
}

/* ── 작업 기록 ─────────────────────────────────────────────────── */

export type AuditAction =
  | 'member.disable'
  | 'member.enable'
  | 'member.role'
  | 'member.delete'
  | 'member.migrate'

export interface AuditEntry {
  at: string
  targetUserId: string
  targetEmail: string
  action: AuditAction
  actorId: string
  actorEmail: string
  detail: string
}

const auditKey = () => `${new Date().toISOString()}#${randomBytes(4).toString('hex')}`

export async function writeAudit(config: MembersConfig, entry: Omit<AuditEntry, 'at'>): Promise<void> {
  await dynamo(config).send(new PutCommand({ TableName: config.auditTable, Item: { ...entry, at: auditKey() } }))
}

const errorName = (error: unknown) => (error && typeof error === 'object' && 'name' in error ? String(error.name) : '')

/**
 * 권한 변경 결과.
 * - changed: 바뀌었다. audited가 false면 작업 기록은 아직 없으니 부른 쪽이 따로 남긴다.
 * - stale:   읽은 뒤 그 사이에 다른 요청이 권한을 바꿨거나 회원이 지워졌다 (아무것도 바꾸지 않았다).
 */
export type RoleChange = { result: 'changed'; profile: MemberProfile; audited: boolean } | { result: 'stale' }

/**
 * 권한을 from → to 로 바꾸고 작업 기록을 남긴다.
 *
 * 조건부 업데이트: 지금 권한이 from 일 때만 바꾼다. 두 관리자가 동시에 누르거나 오래된 화면에서 눌러도
 * 한 번만 반영되고 기록도 한 줄만 남는다.
 * 한 트랜잭션: 권한 변경과 작업 기록을 함께 쓴다 (둘 다 되거나 둘 다 안 된다). 트랜잭션은 따로 IAM 권한이 없고
 * 안에 든 UpdateItem(회원 테이블)·PutItem(작업 기록 테이블) 권한을 쓴다. 그래도 역할 정책이 달라 거절되면
 * 조건부 업데이트만 하고 audited: false 로 돌려준다 (권한 변경이 통째로 막히는 것보다 낫다).
 */
export async function changeRoleRecorded(
  config: MembersConfig,
  userId: string,
  from: MemberRole,
  to: MemberRole,
  audit: Omit<AuditEntry, 'at'>,
): Promise<RoleChange> {
  const change = {
    TableName: config.usersTable,
    Key: { userId },
    UpdateExpression: 'SET #role = :to, #updatedAt = :now',
    // 권한 속성이 없는 오래된 항목은 일반 회원으로 읽으므로(toProfile) 같은 뜻으로 다룬다
    ConditionExpression: `attribute_exists(userId) AND (#role = :from${from === 'USER' ? ' OR attribute_not_exists(#role)' : ''})`,
    ExpressionAttributeNames: { '#role': 'role', '#updatedAt': 'updatedAt' },
    ExpressionAttributeValues: { ':to': to, ':from': from, ':now': new Date().toISOString() },
  }
  try {
    await dynamo(config).send(
      new TransactWriteCommand({
        TransactItems: [{ Update: change }, { Put: { TableName: config.auditTable, Item: { ...audit, at: auditKey() } } }],
      }),
    )
    const profile = await getProfile(config, userId)
    return profile ? { result: 'changed', profile, audited: true } : { result: 'stale' }
  } catch (error) {
    const name = errorName(error)
    if (name === 'TransactionCanceledException') {
      const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons ?? []
      if (reasons[0]?.Code === 'ConditionalCheckFailed') return { result: 'stale' }
      throw error
    }
    // UnknownOperationException: 로컬 에뮬레이터(dynalite)는 트랜잭션을 모른다
    if (name !== 'AccessDeniedException' && name !== 'UnknownOperationException') throw error
    console.error(`[members:role] transaction unavailable (${name}), falling back to conditional update`)
  }
  try {
    const { Attributes } = await dynamo(config).send(new UpdateCommand({ ...change, ReturnValues: 'ALL_NEW' }))
    const profile = toProfile(Attributes)
    return profile ? { result: 'changed', profile, audited: false } : { result: 'stale' }
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) return { result: 'stale' }
    throw error
  }
}

export async function listAudit(config: MembersConfig, targetUserId: string, limit = 20): Promise<AuditEntry[]> {
  const { Items } = await dynamo(config).send(
    new QueryCommand({
      TableName: config.auditTable,
      KeyConditionExpression: 'targetUserId = :id',
      ExpressionAttributeValues: { ':id': targetUserId },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )
  return (Items ?? []).map((item) => ({
    at: String(item.at ?? '').split('#')[0] ?? '',
    targetUserId: String(item.targetUserId ?? ''),
    targetEmail: String(item.targetEmail ?? ''),
    action: item.action as AuditAction,
    actorId: String(item.actorId ?? ''),
    actorEmail: String(item.actorEmail ?? ''),
    detail: String(item.detail ?? ''),
  }))
}
