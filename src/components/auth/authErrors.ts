/**
 * Supabase 인증 오류 → 고정 한국어 문구 (CWE-209).
 * 원문 메시지는 화면에 내보내지 않고, 오류 코드·메시지의 키워드로만 분류한다.
 */

interface AuthErrorLike {
  code?: string
  message?: string
  status?: number
  name?: string
}

export const SERVICE_UNAVAILABLE = '서비스에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'
const RATE_LIMITED = '요청이 너무 많습니다. 잠시 후 다시 시도하세요.'

function classify(error: unknown): { code: string; message: string; status: number | undefined; name: string } {
  const e = (error && typeof error === 'object' ? error : {}) as AuthErrorLike
  return {
    code: typeof e.code === 'string' ? e.code : '',
    message: typeof e.message === 'string' ? e.message.toLowerCase() : '',
    status: typeof e.status === 'number' ? e.status : undefined,
    name: typeof e.name === 'string' ? e.name : '',
  }
}

function isNetworkFailure({ name, status, message }: ReturnType<typeof classify>): boolean {
  return name === 'AuthRetryableFetchError' || status === 0 || message.includes('failed to fetch')
}

export function loginErrorMessage(error: unknown): string {
  const info = classify(error)
  if (isNetworkFailure(info)) return SERVICE_UNAVAILABLE
  if (info.code === 'invalid_credentials' || info.message.includes('invalid login')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (info.code === 'email_not_confirmed' || info.message.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다.'
  }
  if (info.code.startsWith('over_') || info.status === 429) return RATE_LIMITED
  return '로그인에 실패했습니다.'
}

export function signupErrorMessage(error: unknown): string {
  const info = classify(error)
  if (isNetworkFailure(info)) return SERVICE_UNAVAILABLE
  if (
    info.code === 'user_already_exists' ||
    info.code === 'email_exists' ||
    info.message.includes('already registered') ||
    info.message.includes('already been registered')
  ) {
    return '이미 가입된 이메일입니다.'
  }
  if (info.code === 'weak_password' || info.message.includes('password should')) {
    return '비밀번호가 보안 기준을 충족하지 않습니다.'
  }
  if (info.code === 'email_address_invalid' || (info.message.includes('invalid') && info.message.includes('email'))) {
    return '유효하지 않은 이메일 형식입니다.'
  }
  if (info.code.startsWith('over_') || info.status === 429) return RATE_LIMITED
  if (info.code === 'signup_disabled') return '현재 회원가입을 받을 수 없습니다. 잠시 후 다시 시도하세요.'
  return '회원가입에 실패했습니다. 다시 시도해주세요.'
}

/** 입력 단계의 간단한 이메일 형식 확인 (최종 판정은 서버) */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
