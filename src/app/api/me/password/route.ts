/**
 * POST /api/me/password  { currentPassword, newPassword }  → { ok: true }
 * 로그인한 본인의 비밀번호 변경. 현재 비밀번호가 틀리면 invalid_credentials.
 */
import type { NextRequest } from 'next/server'
import { passwordProblem } from '@/lib/account'
import { changePassword } from '@/server/members/cognito'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { authenticate } from '@/server/members/session'

export async function POST(request: NextRequest) {
  const outcome = await authenticate(request)
  if (!outcome.ok) return outcome.response
  const { config, accessToken, finish } = outcome.auth

  return handle('me:password', async () => {
    const body = await readBody(request)
    const current = text(body.currentPassword)
    const next = text(body.newPassword)
    if (!current) throw new MemberError('invalid_credentials')
    if (passwordProblem(next)) throw new MemberError('weak_password')
    await changePassword(config, accessToken, current, next)
    return finish(ok({ ok: true }))
  })
}
