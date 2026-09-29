import { formatUnitsExact } from '@/lib/format'

/** 체인에서 읽은 값 하나의 상태. 새로고침 중이나 실패해도 직전 값은 유지한다. */
export interface Reading {
  state: 'idle' | 'loading' | 'ok' | 'error'
  value?: bigint
}

export const IDLE_READING: Reading = { state: 'idle' }

export function loadingFrom(previous: Reading): Reading {
  return { state: 'loading', value: previous.value }
}

export function settleReading(result: PromiseSettledResult<unknown>, previous: Reading): Reading {
  if (result.status === 'fulfilled' && typeof result.value === 'bigint') return { state: 'ok', value: result.value }
  return { state: 'error', value: previous.value }
}

export function formatReading(reading: Reading, maxFraction = 6): string {
  if (reading.value !== undefined) return formatUnitsExact(reading.value, 18, maxFraction)
  if (reading.state === 'loading') return '…'
  if (reading.state === 'error') return '조회 실패'
  return '-'
}
