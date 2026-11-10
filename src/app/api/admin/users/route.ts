/**
 * GET /api/admin/users?q=&status=ALL|ACTIVE|DISABLED&role=ALL|USER|ADMIN&from=YYYY-MM-DD&to=YYYY-MM-DD
 *                     &sort=newest|oldest&page=1&pageSize=10|20|50
 *   → { stats: { total, active, disabled, recent, admins }, items: MemberProfile[], total, page, pages, pageSize }
 *
 * 관리자만 (서버가 요청마다 DynamoDB의 역할을 다시 확인한다). 일반 회원은 403 forbidden.
 */
import type { NextRequest } from 'next/server'
import { listMembers, parseListQuery, RECENT_DAYS } from '@/server/members/admin'
import { handle, ok } from '@/server/members/http'
import { authenticate } from '@/server/members/session'

export async function GET(request: NextRequest) {
  const outcome = await authenticate(request, { role: 'ADMIN' })
  if (!outcome.ok) return outcome.response
  const { config, finish } = outcome.auth
  return handle('admin:list', async () => {
    const result = await listMembers(config, parseListQuery(request.nextUrl.searchParams))
    return finish(ok({ ...result, recentDays: RECENT_DAYS }))
  })
}
