/**
 * 회원 API 오류 코드 → 고정 한국어 문구 (CWE-209).
 * 서버는 코드만 보내고, 화면은 이 표에 있는 문구만 보여 준다.
 */
import { MemberApiError } from './memberApi'

export { looksLikeEmail } from '@/lib/account'

export const SERVICE_UNAVAILABLE = '서비스에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'

const COMMON: Record<string, string> = {
  network: SERVICE_UNAVAILABLE,
  unavailable: SERVICE_UNAVAILABLE,
  delivery_failed: '메일을 보내지 못했습니다. 잠시 후 다시 시도하세요.',
  rate_limited: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
  forbidden_origin: '요청을 처리하지 못했습니다. 페이지를 새로 고친 뒤 다시 시도하세요.',
  bad_request: '입력값을 다시 확인해주세요.',
  unauthenticated: '로그인이 만료되었습니다. 다시 로그인해주세요.',
  disabled: '이용이 중지된 계정입니다. 고객센터로 문의해주세요.',
  forbidden: '이 작업을 할 권한이 없습니다.',
  not_found: '대상을 찾지 못했습니다. 목록을 새로 고쳐 주세요.',
  weak_password: '비밀번호가 보안 기준을 충족하지 않습니다.',
  code_mismatch: '인증 코드가 올바르지 않습니다.',
  code_expired: '인증 코드가 만료되었습니다. 코드를 다시 받아주세요.',
}

const SCOPED: Record<'login' | 'signup' | 'confirm' | 'reset' | 'password' | 'admin', Record<string, string>> = {
  login: {
    invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
    not_confirmed: '이메일 인증이 완료되지 않았습니다.',
    password_reset_required: '보안 정책이 바뀌어 비밀번호를 새로 정해야 합니다. 비밀번호 찾기에서 재설정해주세요.',
  },
  signup: {
    email_taken: '이미 가입된 이메일입니다.',
    bad_request: '입력값을 다시 확인해주세요. 필수 약관에 동의해야 합니다.',
  },
  confirm: {
    bad_request: '이메일과 6자리 인증 코드를 확인해주세요.',
  },
  reset: {
    bad_request: '이메일과 6자리 인증 코드를 확인해주세요.',
  },
  password: {
    invalid_credentials: '현재 비밀번호가 올바르지 않습니다.',
  },
  admin: {
    self_action: '내 계정의 상태·권한은 여기서 바꿀 수 없습니다.',
    protected_account: '최고 관리자 계정은 권한 회수, 비활성화, 삭제를 할 수 없습니다.',
    conflict: '다른 관리자가 먼저 변경했습니다. 목록을 새로 고친 뒤 다시 확인해주세요.',
    forbidden: '관리자 권한이 없어 이 작업을 할 수 없습니다.',
    partial_failure: '일부만 반영되었습니다. 같은 작업을 한 번 더 실행해주세요.',
    bad_request: '요청 내용을 다시 확인해주세요.',
  },
}

export function memberErrorMessage(error: unknown, scope?: keyof typeof SCOPED): string {
  const code = error instanceof MemberApiError ? error.code : 'unavailable'
  return (scope && SCOPED[scope][code]) || COMMON[code] || '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'
}
