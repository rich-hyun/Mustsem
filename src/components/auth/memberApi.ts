/**
 * 회원 API 호출 도우미 (같은 사이트의 /api/*). 세션은 httpOnly 쿠키로 자동 전송된다.
 * 실패하면 서버가 준 오류 코드만 담은 MemberApiError를 던진다 (원문 메시지 없음).
 */
import { logDevError } from '@/lib/errors'

export class MemberApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
    this.name = 'MemberApiError'
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/** 401이 오면 부를 함수 (AuthProvider가 등록: 화면을 로그아웃 상태로 바꾼다) */
let onUnauthenticated: ((code: string) => void) | null = null
export function setUnauthenticatedHandler(handler: ((code: string) => void) | null) {
  onUnauthenticated = handler
}

export async function memberApi<T>(path: string, { method = 'GET', body }: { method?: Method; body?: unknown } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    logDevError(`api:${path}`, error)
    throw new MemberApiError('network', 0)
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: unknown }
  if (!response.ok) {
    const code = typeof data.error === 'string' ? data.error : 'unavailable'
    // 로그인 API 자체의 401(비밀번호 틀림)은 세션 만료가 아니다
    if ((code === 'unauthenticated' || code === 'disabled') && !path.startsWith('/api/auth/login')) onUnauthenticated?.(code)
    throw new MemberApiError(code, response.status)
  }
  return data
}

export const isApiError = (error: unknown, ...codes: string[]): error is MemberApiError =>
  error instanceof MemberApiError && (codes.length === 0 || codes.includes(error.code))
