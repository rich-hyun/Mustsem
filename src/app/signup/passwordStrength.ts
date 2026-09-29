/** 비밀번호 강도 0~4 — 기존 사이트의 점수 규칙을 그대로 쓴다 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4
}

export const STRENGTH_LABELS = ['', '취약', '보통', '양호', '강력'] as const
