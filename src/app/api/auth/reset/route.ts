/**
 * POST /api/auth/reset  { email, code, password }  → { ok: true }
 * 재설정 코드로 새 비밀번호를 정한다. 성공하면 다른 기기의 세션도 모두 끝낸다.
 */
import type { NextRequest } from 'next/server'
import { looksLikeCode, looksLikeEmail, normalizeEmail, passwordProblem } from '@/lib/account'
import { adminGetUser, adminSignOutEverywhere, confirmForgotPassword } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'

export async function POST(request: NextRequest) {
  return handle('reset', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    const code = text(body.code).trim()
    const password = text(body.password)
    if (!looksLikeEmail(email) || !looksLikeCode(code)) throw new MemberError('bad_request')
    if (passwordProblem(password)) throw new MemberError('weak_password')

    try {
      await confirmForgotPassword(config, email, code, password)
    } catch (error) {
      // 없는 계정에 대한 코드는 '코드가 틀림'과 같게 보여 가입 여부를 숨긴다
      if (error instanceof MemberError && error.code === 'invalid_credentials') throw new MemberError('code_mismatch')
      throw error
    }

    try {
      const user = await adminGetUser(config, email)
      if (user) await adminSignOutEverywhere(config, user.username)
    } catch (error) {
      console.error('[members:reset] global sign-out failed:', error instanceof Error ? error.message : error)
    }
    return ok({ ok: true })
  })
}
