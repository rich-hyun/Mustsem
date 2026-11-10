/**
 * 회원 API 오류 코드. 응답에는 코드만 싣고(CWE-209), 화면 문구는 클라이언트(memberErrors.ts)가 정한다.
 */
export type MemberErrorCode =
  | 'bad_request'
  | 'forbidden_origin'
  | 'unauthenticated'
  | 'forbidden'
  | 'disabled'
  | 'not_found'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_credentials'
  | 'not_confirmed'
  | 'already_confirmed'
  | 'code_mismatch'
  | 'code_expired'
  | 'password_reset_required'
  | 'rate_limited'
  | 'delivery_failed'
  | 'self_action'
  | 'protected_account'
  | 'conflict'
  | 'partial_failure'
  | 'unavailable'

const STATUS: Record<MemberErrorCode, number> = {
  bad_request: 400,
  forbidden_origin: 403,
  unauthenticated: 401,
  forbidden: 403,
  disabled: 403,
  not_found: 404,
  email_taken: 409,
  weak_password: 400,
  invalid_credentials: 401,
  not_confirmed: 403,
  already_confirmed: 409,
  code_mismatch: 400,
  code_expired: 400,
  password_reset_required: 403,
  rate_limited: 429,
  delivery_failed: 502,
  self_action: 409,
  protected_account: 403,
  conflict: 409,
  partial_failure: 502,
  unavailable: 503,
}

export class MemberError extends Error {
  readonly status: number
  constructor(readonly code: MemberErrorCode) {
    super(code)
    this.name = 'MemberError'
    this.status = STATUS[code]
  }
}
