/**
 * GET    /api/admin/users/:id                        → { profile(+protected), account: { confirmed, enabled } | null, audit }
 * PATCH  /api/admin/users/:id  { status } | { role }  → { profile(+protected) }
 * DELETE /api/admin/users/:id  { confirmEmail }       → { ok: true }
 *
 * 관리자만 (요청마다 DynamoDB에서 요청자의 권한·상태를 다시 읽는다). 변경 요청은 같은 사이트 출처만 받는다.
 * 자기 자신은 대상이 될 수 없고(self_action), 보호 계정(최고 관리자)은 권한 회수·비활성화·삭제할 수 없다(protected_account).
 * 권한 변경은 조건부 업데이트라 그 사이 다른 관리자가 먼저 바꿨으면 conflict. 모든 변경은 작업 기록 테이블에 남는다.
 */
import type { NextRequest } from 'next/server'
import { changeRole, changeStatus, forAdmin, removeMember } from '@/server/members/admin'
import { adminGetUser } from '@/server/members/cognito'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { getProfile, listAudit } from '@/server/members/profiles'
import { authenticate } from '@/server/members/session'

const validId = (id: string) => /^[0-9a-zA-Z-]{1,64}$/.test(id)

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const outcome = await authenticate(request, { role: 'ADMIN' })
  if (!outcome.ok) return outcome.response
  const { config, finish } = outcome.auth
  const { id } = await ctx.params
  return handle('admin:detail', async () => {
    if (!validId(id)) throw new MemberError('not_found')
    const profile = await getProfile(config, id)
    if (!profile) throw new MemberError('not_found')
    const [user, audit] = await Promise.all([
      adminGetUser(config, profile.email).catch(() => null),
      listAudit(config, id).catch((error: unknown) => {
        console.error('[members:admin] audit read failed:', error instanceof Error ? error.message : error)
        return []
      }),
    ])
    const account = user && user.sub === profile.userId ? { confirmed: user.confirmed, enabled: user.enabled } : null
    return finish(ok({ profile: forAdmin(config, profile), account, audit }))
  })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const outcome = await authenticate(request, { role: 'ADMIN' })
  if (!outcome.ok) return outcome.response
  const { config, profile: actor, finish } = outcome.auth
  const { id } = await ctx.params
  return handle('admin:update', async () => {
    if (!validId(id)) throw new MemberError('not_found')
    const body = await readBody(request)
    if (body.status !== undefined && body.role !== undefined) throw new MemberError('bad_request')
    if (body.status === 'ACTIVE' || body.status === 'DISABLED') {
      return finish(ok({ profile: forAdmin(config, await changeStatus(config, actor, id, body.status)) }))
    }
    if (body.role === 'USER' || body.role === 'ADMIN') {
      return finish(ok({ profile: forAdmin(config, await changeRole(config, actor, id, body.role)) }))
    }
    throw new MemberError('bad_request')
  })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const outcome = await authenticate(request, { role: 'ADMIN' })
  if (!outcome.ok) return outcome.response
  const { config, profile: actor, finish } = outcome.auth
  const { id } = await ctx.params
  return handle('admin:delete', async () => {
    if (!validId(id)) throw new MemberError('not_found')
    const body = await readBody(request)
    await removeMember(config, actor, id, text(body.confirmEmail))
    return finish(ok({ ok: true }))
  })
}
