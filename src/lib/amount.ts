/** 사용자가 입력한 토큰 수량을 검증하고 정수 단위(wei)로 바꾼다 */

export type AmountResult = { ok: true; value: bigint } | { ok: false; message: string }

const AMOUNT_PATTERN = /^(\d+(\.\d*)?|\.\d+)$/

export function parseAmount(input: string, decimals = 18): AmountResult {
  const text = input.trim().replaceAll(',', '')
  if (!text) return { ok: false, message: '수량을 입력하세요.' }
  if (!AMOUNT_PATTERN.test(text)) return { ok: false, message: '숫자만 입력할 수 있습니다.' }

  const [wholePart = '0', fractionPart = ''] = text.split('.')
  if (fractionPart.length > decimals) {
    return { ok: false, message: `소수점 아래 ${decimals}자리까지만 입력할 수 있습니다.` }
  }

  const value =
    BigInt(wholePart || '0') * 10n ** BigInt(decimals) + BigInt(fractionPart.padEnd(decimals, '0') || '0')
  if (value <= 0n) return { ok: false, message: '0보다 큰 수량을 입력하세요.' }
  return { ok: true, value }
}

/** 정수 단위 금액을 입력칸에 넣을 소수 문자열로 (쉼표 없이, 끝자리 0 제거) */
export function toInputAmount(value: bigint, decimals = 18): string {
  const base = 10n ** BigInt(decimals)
  const whole = value / base
  const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

/** 입력 중인 값에서 숫자·소수점 외 문자를 걸러낸다 */
export function sanitizeAmountInput(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replaceAll('.', '')
}
