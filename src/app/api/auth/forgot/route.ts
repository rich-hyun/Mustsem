/**
 * POST /api/auth/forgot  { email }  → { ok: true }
 * 비밀번호 재설정 코드를 메일로 보낸다. 가입 여부를 알려 주지 않도록 없는 계정도 같은 응답을 준다.
 */
import type { NextRequest } from 'next/server'
import { looksLikeEmail, normalizeEmail } from '@/lib/account'
import { forgotPassword } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'

const SILENT = new Set(['invalid_credentials', 'bad_request', 'not_confirmed', 'disabled'])

export async function POST(request: NextRequest) {
  return handle('forgot', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    if (!looksLikeEmail(email)) throw new MemberError('bad_request')
    try {
      await forgotPassword(config, email)
    } catch (error) {
      if (!(error instanceof MemberError && SILENT.has(error.code))) throw error
    }
    return ok({ ok: true })
  })
}
