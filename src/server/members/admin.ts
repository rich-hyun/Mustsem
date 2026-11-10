/**
 * 관리자 회원 관리 로직. Route Handler는 authenticate(role: 'ADMIN')을 통과한 뒤에만 이 함수를 부른다.
 * 모든 변경은 서버가 DynamoDB에서 다시 읽은 관리자 정보로 판단하고, 작업 기록 테이블에 남긴다.
 */
import type { MemberProfile, MemberRole, MemberStatus } from '@/lib/account'
import { ROLE_LABELS, STATUS_LABELS } from '@/lib/account'
import { adminDelete, adminDisable, adminEnable, adminGetUser } from './cognito'
import type { MembersConfig } from './config'
import { MemberError } from './errors'
import { deleteProfile, getProfile, scanProfiles, setRole, setStatus, writeAudit, type AuditAction } from './profiles'

const DAY = 24 * 60 * 60 * 1000
export const RECENT_DAYS = 7
export const PAGE_SIZES = [10, 20, 50] as const

export interface ListQuery {
  q: string
  status: MemberStatus | 'ALL'
  role: MemberRole | 'ALL'
  /** YYYY-MM-DD (가입일, 한국 시간 기준 그날 0시부터) */
  from: string | null
  /** YYYY-MM-DD (그날 끝까지 포함) */
  to: string | null
  sort: 'newest' | 'oldest'
  page: number
  pageSize: number
}

const KST_OFFSET = '+09:00'
const dayStart = (date: string) => Date.parse(`${date}T00:00:00${KST_OFFSET}`)
const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayStart(value)))

export function parseListQuery(params: URLSearchParams): ListQuery {
  const status = params.get('status')
  const role = params.get('role')
  const size = Number(params.get('pageSize'))
  const from = params.get('from')
  const to = params.get('to')
  return {
    q: (params.get('q') ?? '').trim().toLowerCase().slice(0, 100),
    status: status === 'ACTIVE' || status === 'DISABLED' ? status : 'ALL',
    role: role === 'USER' || role === 'ADMIN' ? role : 'ALL',
    from: isDate(from) ? from : null,
    to: isDate(to) ? to : null,
    sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
    page: Math.max(1, Math.floor(Number(params.get('page')) || 1)),
    pageSize: (PAGE_SIZES as readonly number[]).includes(size) ? size : 20,
  }
}

export interface MemberStats {
  total: number
  active: number
  disabled: number
  recent: number
  admins: number
}

export async function listMembers(config: MembersConfig, query: ListQuery) {
  const all = await scanProfiles(config)
  const now = Date.now()
  const stats: MemberStats = {
    total: all.length,
    active: all.filter((member) => member.status === 'ACTIVE').length,
    disabled: all.filter((member) => member.status === 'DISABLED').length,
    recent: all.filter((member) => now - Date.parse(member.createdAt) <= RECENT_DAYS * DAY).length,
    admins: all.filter((member) => member.role === 'ADMIN').length,
  }

  const from = query.from ? dayStart(query.from) : null
  const to = query.to ? dayStart(query.to) + DAY : null
  const filtered = all.filter((member) => {
    if (query.status !== 'ALL' && member.status !== query.status) return false
    if (query.role !== 'ALL' && member.role !== query.role) return false
    const joined = Date.parse(member.createdAt)
    if (from !== null && joined < from) return false
    if (to !== null && joined >= to) return false
    if (query.q && !member.name.toLowerCase().includes(query.q) && !member.email.includes(query.q)) return false
    return true
  })
  filtered.sort((a, b) => (query.sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))

  const pages = Math.max(1, Math.ceil(filtered.length / query.pageSize))
  const page = Math.min(query.page, pages)
  const items = filtered.slice((page - 1) * query.pageSize, page * query.pageSize)
  return { stats, items, total: filtered.length, page, pages, pageSize: query.pageSize }
}

async function record(config: MembersConfig, actor: MemberProfile, target: MemberProfile, action: AuditAction, detail: string) {
  const entry = { targetUserId: target.userId, targetEmail: target.email, action, actorId: actor.userId, actorEmail: actor.email, detail }
  try {
    await writeAudit(config, entry)
  } catch (error) {
    // 기록 저장이 실패해도 서버 로그(CloudWatch)에 같은 내용을 남긴다
    console.error('[members:audit] write failed, entry:', JSON.stringify(entry), error instanceof Error ? error.message : error)
  }
}

async function loadTarget(config: MembersConfig, actor: MemberProfile, userId: string): Promise<MemberProfile> {
  // 자기 자신의 비활성화·권한 변경·삭제는 막는다 (마지막 관리자가 스스로 잠기는 일 방지)
  if (userId === actor.userId) throw new MemberError('self_action')
  const target = await getProfile(config, userId)
  if (!target) throw new MemberError('not_found')
  return target
}

/** Cognito 사용자 이름 (이메일 로그인 풀은 sub). sub로 먼저 찾고, 없으면 이메일로 찾는다. 이미 없으면 null */
async function cognitoName(config: MembersConfig, target: MemberProfile): Promise<string | null> {
  const user = (await adminGetUser(config, target.userId)) ?? (await adminGetUser(config, target.email))
  return user && user.sub === target.userId ? user.username : null
}

export async function changeStatus(config: MembersConfig, actor: MemberProfile, userId: string, status: MemberStatus) {
  const target = await loadTarget(config, actor, userId)
  if (target.status === status) return target
  const username = await cognitoName(config, target)

  let updated: MemberProfile | null
  if (status === 'DISABLED') {
    // 먼저 DynamoDB 상태를 바꿔 다음 요청부터 바로 막고, Cognito 로그인 차단·세션 폐기를 이어서 한다
    updated = await setStatus(config, userId, 'DISABLED')
    if (username) {
      try {
        await adminDisable(config, username)
      } catch (error) {
        await record(config, actor, target, 'member.disable', '비활성화 (Cognito 반영 실패, 다시 시도 필요)')
        throw error instanceof MemberError ? new MemberError('partial_failure') : error
      }
    }
  } else {
    if (username) await adminEnable(config, username)
    updated = await setStatus(config, userId, 'ACTIVE')
  }
  if (!updated) throw new MemberError('not_found')
  await record(
    config,
    actor,
    target,
    status === 'DISABLED' ? 'member.disable' : 'member.enable',
    `${STATUS_LABELS[target.status]} → ${STATUS_LABELS[status]}`,
  )
  return updated
}

export async function changeRole(config: MembersConfig, actor: MemberProfile, userId: string, role: MemberRole) {
  const target = await loadTarget(config, actor, userId)
  if (target.role === role) return target
  const updated = await setRole(config, userId, role)
  if (!updated) throw new MemberError('not_found')
  await record(config, actor, target, 'member.role', `${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}`)
  return updated
}

export async function removeMember(config: MembersConfig, actor: MemberProfile, userId: string, confirmEmail: string) {
  const target = await loadTarget(config, actor, userId)
  // 화면의 확인 절차와 별도로, 서버도 대상 이메일을 정확히 받아야 삭제한다
  if (confirmEmail.trim().toLowerCase() !== target.email) throw new MemberError('bad_request')
  const username = await cognitoName(config, target)
  // Cognito 계정을 먼저 지워 더는 로그인할 수 없게 하고, 프로필을 지운다 (둘 다 다시 시도해도 안전)
  if (username) await adminDelete(config, username)
  await deleteProfile(config, userId)
  await record(config, actor, target, 'member.delete', `회원 삭제 (${target.name}, 가입 ${target.createdAt.slice(0, 10)})`)
}
