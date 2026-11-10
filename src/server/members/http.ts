/**
 * 회원 API 공용 응답·검사 도우미.
 * - 응답 본문에는 오류 코드만 싣는다 (내부 메시지·엔드포인트 비노출, CWE-209).
 * - 상태를 바꾸는 요청은 같은 사이트 출처(Origin)와 JSON 본문만 받는다 (CSRF 방어, SameSite 쿠키와 이중).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { MemberError, type MemberErrorCode } from './errors'

const NO_STORE = { 'Cache-Control': 'no-store' }

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE })
}

export function fail(code: MemberErrorCode): NextResponse {
  return NextResponse.json({ error: code }, { status: new MemberError(code).status, headers: NO_STORE })
}

/** 같은 사이트에서 보낸 요청인지 확인 (Origin 헤더의 호스트 = 요청 호스트) */
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')
  try {
    return Boolean(host) && new URL(origin).host === host
  } catch {
    return false
  }
}

/** 상태 변경 요청의 본문. 출처가 다르거나 JSON이 아니면 MemberError */
export async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (!sameOrigin(request)) throw new MemberError('forbidden_origin')
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new MemberError('bad_request')
  const text = await request.text()
  if (text.length > 16_384) throw new MemberError('bad_request')
  try {
    const body: unknown = text ? JSON.parse(text) : {}
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object')
    return body as Record<string, unknown>
  } catch {
    throw new MemberError('bad_request')
  }
}

export const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** 처리 중 예외를 오류 코드 응답으로 바꾼다. 예상하지 못한 예외는 서버 로그에만 남긴다 */
export async function handle(scope: string, run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof MemberError) return fail(error.code)
    const name = error instanceof Error ? error.name : 'error'
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[members:${scope}] ${name}: ${message}`)
    return fail('unavailable')
  }
}
