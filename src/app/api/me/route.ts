/**
 * GET   /api/me                                        → { profile }
 * PATCH /api/me  { name, company?, marketingAgreed? }  → { profile }
 *
 * 본인이 바꿀 수 있는 항목은 이름·회사명·마케팅 수신 동의뿐이다. 본문에 role·status·email이 있어도 읽지 않는다
 * (권한 상승 차단). 이메일은 로그인 ID라 바꾸지 않는다.
 */
import type { NextRequest } from 'next/server'
import { COMPANY_MAX, nameProblem } from '@/lib/account'
import { adminSetName } from '@/server/members/cognito'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { updateOwnProfile } from '@/server/members/profiles'
import { authenticate } from '@/server/members/session'

export async function GET(request: NextRequest) {
  const outcome = await authenticate(request)
  if (!outcome.ok) return outcome.response
  return outcome.auth.finish(ok({ profile: outcome.auth.profile }))
}

export async function PATCH(request: NextRequest) {
  const outcome = await authenticate(request)
  if (!outcome.ok) return outcome.response
  const { config, profile, finish } = outcome.auth

  return handle('me:update', async () => {
    const body = await readBody(request)
    const name = text(body.name).trim()
    if (nameProblem(name)) throw new MemberError('bad_request')
    const company = text(body.company).trim().slice(0, COMPANY_MAX) || null
    const marketingAgreed = typeof body.marketingAgreed === 'boolean' ? body.marketingAgreed : profile.marketingAgreed

    const updated = await updateOwnProfile(config, profile.userId, { name, company, marketingAgreed })
    if (!updated) throw new MemberError('not_found')
    // Cognito의 name 속성도 맞춰 둔다 (원본은 DynamoDB라 실패해도 화면 결과는 같다)
    if (name !== profile.name) {
      await adminSetName(config, profile.email, name).catch((error: unknown) =>
        console.error('[members:me] cognito name sync failed:', error instanceof Error ? error.message : error),
      )
    }
    return finish(ok({ profile: updated }))
  })
}
