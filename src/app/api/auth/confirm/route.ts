/**
 * POST /api/auth/confirm  { email, code }  → { ok: true }
 * 이메일 인증 코드를 확인해 가입을 마친다. 이미 인증된 계정이면 성공으로 본다(다시 눌러도 안전).
 */
import type { NextRequest } from 'next/server'
import { looksLikeCode, looksLikeEmail, normalizeEmail } from '@/lib/account'
import { adminGetUser, confirmSignUp } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { ensureProfile, markVerified } from '@/server/members/profiles'

export async function POST(request: NextRequest) {
  return handle('confirm', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    const code = text(body.code).trim()
    if (!looksLikeEmail(email) || !looksLikeCode(code)) throw new MemberError('bad_request')

    try {
      await confirmSignUp(config, email, code)
    } catch (error) {
      if (!(error instanceof MemberError && error.code === 'already_confirmed')) throw error
    }

    // 가입 때 프로필 저장이 실패했어도 여기서 채운다 (로그인 때도 한 번 더 확인한다)
    try {
      const user = await adminGetUser(config, email)
      if (user) {
        const profile = await ensureProfile(config, {
          userId: user.sub,
          email,
          name: user.name ?? email.split('@')[0] ?? email,
          emailVerified: true,
        })
        if (!profile.emailVerified) await markVerified(config, user.sub)
      }
    } catch (error) {
      console.error('[members:confirm] profile sync deferred:', error instanceof Error ? error.message : error)
    }
    return ok({ ok: true })
  })
}
