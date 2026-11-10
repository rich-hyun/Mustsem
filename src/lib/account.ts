/**
 * 회원 계정 규칙. 화면(입력 검증)과 서버(API 검증)가 같은 규칙을 쓴다.
 * 비밀번호 정책은 Cognito 사용자 풀 정책(infra/aws/members-stack.yaml)과 맞춰 둔다:
 * 8자 이상, 숫자·특수문자 각 1자 이상 (Cognito가 강제) + 영문 1자 이상 (앱이 강제).
 */

export type MemberRole = 'USER' | 'ADMIN'
export type MemberStatus = 'ACTIVE' | 'DISABLED'

/** 화면과 API가 주고받는 회원 정보 (비밀번호·토큰은 없다) */
export interface MemberProfile {
  userId: string
  name: string
  email: string
  role: MemberRole
  status: MemberStatus
  emailVerified: boolean
  company: string | null
  marketingAgreed: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

/** 로그인한 본인에게 내려 주는 최소 정보 (헤더·권한 분기용) */
export interface SessionUser {
  userId: string
  email: string
  name: string
  role: MemberRole
}

export const NAME_MAX = 50
export const EMAIL_MAX = 100
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
export const COMPANY_MAX = 100

/** Cognito가 특수문자로 인정하는 문자 (공백 제외) */
const COGNITO_SYMBOLS = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`=+-]/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function looksLikeEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export interface PasswordCheck {
  id: 'length' | 'letter' | 'number' | 'symbol'
  label: string
  ok: boolean
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: 'length', label: `${PASSWORD_MIN}자 이상`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { id: 'letter', label: '영문', ok: /[A-Za-z]/.test(password) },
    { id: 'number', label: '숫자', ok: /[0-9]/.test(password) },
    { id: 'symbol', label: '특수문자', ok: COGNITO_SYMBOLS.test(password) },
  ]
}

/** 정책을 어기면 사용자용 문구, 지키면 null */
export function passwordProblem(password: string): string | null {
  if (!password) return '비밀번호를 입력해주세요.'
  if (/\s/.test(password)) return '비밀번호에는 공백을 쓸 수 없습니다.'
  if (password.length > PASSWORD_MAX) return `비밀번호는 ${PASSWORD_MAX}자 이하로 입력해주세요.`
  if (passwordChecks(password).some((check) => !check.ok)) {
    return `비밀번호는 영문, 숫자, 특수문자를 포함해 ${PASSWORD_MIN}자 이상이어야 합니다.`
  }
  return null
}

export function nameProblem(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '이름을 입력해주세요.'
  if (trimmed.length > NAME_MAX) return `이름은 ${NAME_MAX}자 이하로 입력해주세요.`
  if (/[<>{}\u0000-\u001f]/.test(trimmed)) return '이름에 쓸 수 없는 문자가 있습니다.'
  return null
}

/** 인증 코드: Cognito 기본값은 숫자 6자리 */
export function looksLikeCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim())
}

/** 로그인 뒤 돌아갈 주소: 사이트 안 경로만 허용 (오픈 리다이렉트 방지) */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/^\/(login|signup|confirm|forgot-password)(\/|\?|$)/.test(value)) return fallback
  return value
}

export const ROLE_LABELS: Record<MemberRole, string> = { USER: '일반 회원', ADMIN: '관리자' }
export const STATUS_LABELS: Record<MemberStatus, string> = { ACTIVE: '활성', DISABLED: '비활성' }
