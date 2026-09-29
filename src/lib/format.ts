/** 화면 표시용 형식 도우미 — 외부 라이브러리 없이 동작한다 */

export function shortenAddress(value: string, lead = 6, tail = 4): string {
  if (!value) return ''
  if (value.length <= lead + tail + 1) return value
  return `${value.slice(0, lead)}…${value.slice(-tail)}`
}

export const shortenHash = (hash: string) => shortenAddress(hash, 10, 8)

const groupInteger = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * 정수 단위(wei 등) 금액을 소수점 문자열로 정확하게 변환한다.
 * 부동소수 변환을 거치지 않으므로 큰 금액도 오차가 없다.
 */
export function formatUnitsExact(value: bigint, decimals = 18, maxFraction = 6): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  let fraction = (abs % base).toString().padStart(decimals, '0').slice(0, maxFraction)
  fraction = fraction.replace(/0+$/, '')
  const text = groupInteger(whole.toString()) + (fraction ? `.${fraction}` : '')
  return negative ? `-${text}` : text
}

export function formatNumber(value: number, maxFraction = 2): string {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR', { maximumFractionDigits: maxFraction })
}

export function formatDateTime(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
