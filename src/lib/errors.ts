/**
 * 지갑·컨트랙트·네트워크 오류를 사용자용 고정 문구로 바꾼다.
 * 원문 메시지(스택, RPC 주소, 내부 응답)는 화면에 내보내지 않는다 (CWE-209).
 * 예외: 컨트랙트가 공개적으로 정의한 되돌림 사유(revert reason)는 짧은 경우에만 덧붙인다.
 */

/** 화면에 그대로 보여도 되는 문구를 담은 오류 (앱이 직접 만든 안내) */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}

type ErrorShape = {
  code?: unknown
  reason?: unknown
  revert?: { name?: unknown } | null
  info?: { error?: { code?: unknown } } | null
  error?: { code?: unknown } | null
}

const USER_REJECTED = new Set<unknown>([4001, 'ACTION_REJECTED'])

function codeOf(error: ErrorShape): unknown {
  return error.code ?? error.info?.error?.code ?? error.error?.code
}

export function isUserRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as ErrorShape
  return USER_REJECTED.has(e.code) || USER_REJECTED.has(e.info?.error?.code) || USER_REJECTED.has(e.error?.code)
}

/** 컨트랙트가 정의한 사유만 허용: 짧고, 줄바꿈·URL·JSON이 없는 문자열 */
function publicRevertReason(error: ErrorShape): string | null {
  const candidates = [error.reason, error.revert?.name]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const text = candidate.trim()
    if (!text || text.length > 80) continue
    if (/[\n\r{}<>]|https?:\/\//i.test(text)) continue
    if (/^(execution reverted|require\(false\)|missing revert data)/i.test(text)) continue
    return text
  }
  return null
}

export function describeError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message
  if (!error || typeof error !== 'object') return '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'
  const e = error as ErrorShape
  if (isUserRejection(e)) return '지갑에서 요청을 거절했습니다.'

  switch (codeOf(e)) {
    case 'INSUFFICIENT_FUNDS':
      return '잔액이 부족합니다. 수수료(가스)를 포함한 잔액을 확인하세요.'
    case -32002:
      return '지갑에서 이미 처리 중인 요청이 있습니다. 지갑 창을 확인하세요.'
    case 4100:
      return '지갑에서 이 사이트의 접근을 허용해야 합니다.'
    case 4902:
      return '지갑에 해당 네트워크가 등록되어 있지 않습니다.'
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
    case 'SERVER_ERROR':
      return '네트워크가 응답하지 않습니다. 잠시 후 다시 시도하세요.'
    case 'NONCE_EXPIRED':
    case 'REPLACEMENT_UNDERPRICED':
      return '대기 중인 이전 트랜잭션과 충돌했습니다. 지갑의 대기 목록을 확인하세요.'
    case 'TRANSACTION_REPLACED':
      return '트랜잭션이 다른 트랜잭션으로 대체되었습니다.'
    case 'INVALID_ARGUMENT':
      return '입력값 형식이 올바르지 않습니다.'
    case 'BAD_DATA':
      // 대개 선택한 네트워크의 해당 주소에 컨트랙트가 없을 때(빈 응답 0x) 생긴다
      return '컨트랙트 응답을 해석하지 못했습니다. 이 네트워크에 컨트랙트가 배포되어 있는지 확인하세요.'
    case 'CALL_EXCEPTION': {
      const reason = publicRevertReason(e)
      return reason
        ? `컨트랙트가 요청을 거부했습니다. (사유: ${reason})`
        : '컨트랙트가 요청을 거부했습니다. 입력값과 권한을 확인하세요.'
    }
    default:
      return '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'
  }
}

/** 개발 중에만 원문 오류를 콘솔에 남긴다 */
export function logDevError(scope: string, error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${scope}]`, error)
  }
}
