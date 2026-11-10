/**
 * POST /api/auth/resend  { email }  → { ok: true }
 * 인증 코드를 다시 보낸다. 가입 여부를 알려 주지 않도록 없는 계정도 같은 응답을 준다.
 */
import type { NextRequest } from 'next/server'
import { looksLikeEmail, normalizeEmail } from '@/lib/account'
import { resendCode } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'

const SILENT = new Set(['invalid_credentials', 'bad_request', 'already_confirmed'])

export async function POST(request: NextRequest) {
  return handle('resend', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    if (!looksLikeEmail(email)) throw new MemberError('bad_request')
    try {
      await resendCode(config, email)
    } catch (error) {
      if (!(error instanceof MemberError && SILENT.has(error.code))) throw error
    }
    return ok({ ok: true })
  })
}
