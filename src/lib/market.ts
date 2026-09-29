/**
 * 대시보드 가치 변화 차트의 데이터 도우미.
 * 일별 종가를 달력 날짜에 맞춰 채우고(휴장일은 직전 값), 기준일 = 100 지수로 바꾸고, 일·주·월 단위로 묶는다.
 */

export type MarketKey = 'mst' | 'btc' | 'qqq'
export type RealKey = Exclude<MarketKey, 'mst'>
export type Interval = 'day' | 'week' | 'month'

export interface MarketPoint {
  date: string
  close: number
}

export const MARKET_FROM = '2026-01-01'
export const BASE_INDEX = 100
/** MST 코인 = 비트코인 시세보다 1% 높은 파생 지수 */
export const MST_PREMIUM = 0.01

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const todayKey = () => new Date().toISOString().slice(0, 10)
const parseKey = (key: string) => new Date(`${key}T00:00:00Z`)
const toKey = (date: Date) => date.toISOString().slice(0, 10)

export const monthDay = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`
const yearMonth = (key: string) => `${key.slice(0, 4)}.${key.slice(5, 7)}`
const yearMonthKo = (key: string) => `${key.slice(0, 4)}년 ${Number(key.slice(5, 7))}월`
export const dateKo = (key: string) => `${key.slice(0, 4)}년 ${Number(key.slice(5, 7))}월 ${Number(key.slice(8, 10))}일`

export function listDays(from: string, to: string): string[] {
  const out: string[] = []
  for (let day = parseKey(from), end = parseKey(to); day <= end; day.setUTCDate(day.getUTCDate() + 1)) out.push(toKey(day))
  return out
}

/** 서버 응답을 믿지 않고 형태를 확인한다. 날짜·가격이 올바른 점만 남긴다 */
export function cleanPoints(value: unknown): MarketPoint[] | null {
  if (!Array.isArray(value)) return null
  const points = value.flatMap((item): MarketPoint[] => {
    const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const date = typeof entry.date === 'string' ? entry.date.slice(0, 10) : ''
    const close = typeof entry.close === 'number' ? entry.close : Number.NaN
    return DATE_RE.test(date) && Number.isFinite(close) && close > 0 ? [{ date, close }] : []
  })
  return points.length > 1 ? points : null
}

/** 달력의 모든 날짜에 값을 채운다. 휴장일은 직전 값, 맨 앞의 빈 날은 첫 값으로 */
export function toDaily(points: MarketPoint[], days: string[]): number[] {
  const byDay = new Map(points.map((point) => [point.date, point.close]))
  let last: number | null = null
  const filled = days.map((day) => {
    const value = byDay.get(day)
    if (value !== undefined) last = value
    return last
  })
  const first = filled.find((value): value is number => value !== null) ?? 0
  return filled.map((value) => value ?? first)
}

export function lastDateOf(points: MarketPoint[], cap: string): string | null {
  return points.reduce<string | null>((latest, point) => (point.date <= cap && (!latest || point.date > latest) ? point.date : latest), null)
}

function groupKey(day: string, interval: Interval): string {
  if (interval === 'day') return day
  if (interval === 'month') return day.slice(0, 7)
  const date = parseKey(day) // 주: 월요일 시작
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return toKey(date)
}

export interface Bucket {
  /** 이 구간을 대표하는 날(구간의 마지막 날)의 인덱스 */
  index: number
  label: string
  title: string
}

/** 일별 달력을 보기 단위로 묶는다. 각 구간은 마지막 날 값을 쓴다 */
export function resample(days: string[], interval: Interval): Bucket[] {
  const groups: { key: string; start: string; end: string; index: number }[] = []
  days.forEach((day, index) => {
    const key = groupKey(day, interval)
    const current = groups[groups.length - 1]
    if (!current || current.key !== key) groups.push({ key, start: day, end: day, index })
    else {
      current.end = day
      current.index = index
    }
  })
  return groups.map((group) => ({
    index: group.index,
    label: interval === 'month' ? yearMonth(group.end) : monthDay(group.end),
    title:
      interval === 'day'
        ? dateKo(group.end)
        : interval === 'week'
          ? `${monthDay(group.start)} ~ ${monthDay(group.end)} (주간, ${monthDay(group.end)} 기준)`
          : `${yearMonthKo(group.end)} (${monthDay(group.end)} 기준)`,
  }))
}
