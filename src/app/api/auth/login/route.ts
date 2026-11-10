/**
 * POST /api/auth/login  { email, password }  → { user }  + httpOnly 세션 쿠키
 *
 * 오류: invalid_credentials · not_confirmed(인증 코드 단계로) · disabled · password_reset_required · rate_limited
 * 기존 Supabase 회원은 LEGACY_SUPABASE_MIGRATION=on 일 때 첫 로그인에서 Cognito로 옮긴다.
 */
import type { NextRequest } from 'next/server'
import { looksLikeEmail, normalizeEmail } from '@/lib/account'
import { passwordLogin, readIdToken, revokeRefreshToken, type Tokens } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { migrateLegacyMember } from '@/server/members/legacy'
import { ensureProfile, recordLogin } from '@/server/members/profiles'
import { sessionUser, setSessionCookies } from '@/server/members/session'

export async function POST(request: NextRequest) {
  return handle('login', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    const password = text(body.password)
    if (!looksLikeEmail(email) || !password || password.length > 256) throw new MemberError('invalid_credentials')

    let tokens: Tokens
    try {
      tokens = await passwordLogin(config, email, password)
    } catch (error) {
      if (!(config.legacyMigration && error instanceof MemberError && error.code === 'invalid_credentials')) throw error
      const migration = await migrateLegacyMember(config, email, password)
      if (migration === 'reset_required') throw new MemberError('password_reset_required')
      if (migration !== 'migrated') throw error
      tokens = await passwordLogin(config, email, password)
    }

    const claims = readIdToken(tokens.idToken)
    const profile = await ensureProfile(config, {
      userId: claims.sub,
      email: claims.email,
      name: claims.name ?? claims.email.split('@')[0] ?? claims.email,
      emailVerified: true,
    })
    if (profile.status !== 'ACTIVE') {
      if (tokens.refreshToken) await revokeRefreshToken(config, tokens.refreshToken).catch(() => undefined)
      throw new MemberError('disabled')
    }
    const updated = (await recordLogin(config, claims.sub, profile.email !== claims.email ? claims.email : undefined)) ?? profile

    return setSessionCookies(ok({ user: sessionUser(updated) }), tokens, claims.username)
  })
}
