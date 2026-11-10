/**
 * 기존 Supabase 회원 이전 (LEGACY_SUPABASE_MIGRATION=on 일 때만).
 *
 * Cognito에 없는 이메일로 로그인하면 같은 이메일·비밀번호를 Supabase에 확인하고, 맞으면 Cognito 계정과
 * DynamoDB 프로필을 만든다. Supabase 쪽 데이터는 읽기만 하고 지우거나 바꾸지 않는다.
 * 비밀번호는 Supabase가 해시로만 가지고 있어 일괄 이전이 불가능하므로, 회원이 직접 로그인할 때 옮긴다.
 */
import { randomBytes } from 'node:crypto'
import { SUPABASE } from '@/config/site'
import { passwordProblem } from '@/lib/account'
import { adminCreateMigrated, adminGetUser } from './cognito'
import type { MembersConfig } from './config'
import { ensureProfile, writeAudit } from './profiles'

interface LegacyUser {
  email: string
  name: string
  company: string | null
  marketingAgreed: boolean
}

async function verifyWithSupabase(email: string, password: string): Promise<LegacyUser | null> {
  try {
    const response = await fetch(`${SUPABASE.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { user?: { email?: unknown; user_metadata?: Record<string, unknown> } }
    const userEmail = typeof body.user?.email === 'string' ? body.user.email.toLowerCase() : null
    if (userEmail !== email) return null
    const meta = body.user?.user_metadata ?? {}
    const name = typeof meta.full_name === 'string' && meta.full_name.trim() ? meta.full_name.trim().slice(0, 50) : email.split('@')[0] ?? email
    return {
      email,
      name,
      company: typeof meta.company === 'string' && meta.company.trim() ? meta.company.trim().slice(0, 100) : null,
      marketingAgreed: meta.marketing_agreed === true,
    }
  } catch (error) {
    console.error('[members:legacy] supabase check failed:', error instanceof Error ? error.message : error)
    return null
  }
}

/** 임의 비밀번호: 정책(영문·숫자·특수문자)을 반드시 만족하게 붙인다 */
const unusablePassword = () => `${randomBytes(24).toString('base64url')}a1!`

export type MigrationResult = 'migrated' | 'reset_required' | 'not_legacy'

export async function migrateLegacyMember(config: MembersConfig, email: string, password: string): Promise<MigrationResult> {
  // 이미 Cognito에 있는 이메일이면 단순히 비밀번호가 틀린 것이다
  if (await adminGetUser(config, email)) return 'not_legacy'
  const legacy = await verifyWithSupabase(email, password)
  if (!legacy) return 'not_legacy'

  const keptPassword = passwordProblem(password) === null
  const passwordSet = await adminCreateMigrated(config, {
    email,
    name: legacy.name,
    password: keptPassword ? password : unusablePassword(),
    fallbackPassword: unusablePassword(),
  })
  const user = await adminGetUser(config, email)
  if (!user) return 'not_legacy'
  await ensureProfile(config, {
    userId: user.sub,
    email,
    name: legacy.name,
    emailVerified: true,
    company: legacy.company,
    marketingAgreed: legacy.marketingAgreed,
  })
  await writeAudit(config, {
    targetUserId: user.sub,
    targetEmail: email,
    action: 'member.migrate',
    actorId: 'system',
    actorEmail: 'system',
    detail: keptPassword && passwordSet ? 'Supabase 회원 이전' : 'Supabase 회원 이전 (비밀번호 재설정 필요)',
  }).catch((error: unknown) => console.error('[members:legacy] audit failed:', error instanceof Error ? error.message : error))

  return keptPassword && passwordSet ? 'migrated' : 'reset_required'
}
