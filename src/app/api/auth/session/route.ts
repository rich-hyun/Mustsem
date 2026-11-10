/**
 * GET /api/auth/session  → { user: { userId, email, name, role } }
 * 새로 고침 뒤 세션 복구용. 액세스 토큰이 만료됐으면 리프레시 토큰으로 갱신해 쿠키를 바꾼다.
 * 401 unauthenticated · 403 disabled 이면 쿠키를 지운다.
 */
import type { NextRequest } from 'next/server'
import { ok } from '@/server/members/http'
import { authenticate, sessionUser } from '@/server/members/session'

export async function GET(request: NextRequest) {
  const outcome = await authenticate(request)
  if (!outcome.ok) return outcome.response
  return outcome.auth.finish(ok({ user: sessionUser(outcome.auth.profile) }))
}
