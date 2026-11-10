/**
 * POST /api/auth/logout  → { ok: true }
 * 리프레시 토큰을 Cognito에서 폐기하고 세션 쿠키를 지운다. 폐기가 실패해도 쿠키는 지운다.
 */
import type { NextRequest } from 'next/server'
import { revokeRefreshToken } from '@/server/members/cognito'
import { membersConfig } from '@/server/members/config'
import { fail, ok, sameOrigin } from '@/server/members/http'
import { clearSessionCookies, refreshTokenOf } from '@/server/members/session'

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail('forbidden_origin')
  const config = membersConfig()
  const refreshToken = refreshTokenOf(request)
  if (config && refreshToken) {
    await revokeRefreshToken(config, refreshToken).catch((error: unknown) =>
      console.error('[members:logout] revoke failed:', error instanceof Error ? error.message : error),
    )
  }
  return clearSessionCookies(ok({ ok: true }))
}
