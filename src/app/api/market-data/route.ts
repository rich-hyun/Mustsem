/**
 * GET /api/market-data?from=2026-01-01&to=2026-09-28
 *
 * 대시보드 "머스트리 코인 가치 변화" 차트가 쓰는 실제 과거 시세(일별 종가).
 *   QQQ: Stooq 일별 CSV → 실패 시 Yahoo Finance
 *   BTC: CoinGecko      → 실패 시 Yahoo Finance (BTC-USD)
 *
 * 응답: { updated, range, data: { btc: [{date, close}], qqq: [...] }, sources: { btc, qqq }, missing: [...] }
 * - 두 시세가 모두 오면 CDN에 30분 캐시, 하나라도 빠지면 캐시하지 않는다.
 * - 원본 API 주소나 오류 원문은 응답에 싣지 않는다 (서버 로그에만 남긴다).
 * - 같은 사이트 화면만 쓰는 창구라 CORS를 열지 않는다 (외부 사이트의 무료 프록시로 쓰이는 것을 막는다).
 */
import type { NextRequest } from 'next/server'

type SeriesKey = 'btc' | 'qqq'

interface Point {
  date: string
  close: number
}

interface Found {
  rows: Point[]
  source: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_FROM = '2026-01-01'
const EARLIEST = '2015-01-01'
const UPSTREAM_TIMEOUT_MS = 8000
const UPSTREAM_REVALIDATE_S = 1800
const UA = 'Mozilla/5.0 (compatible; MustsemDashboard/1.0; +https://www.mustsem.co.kr)'

const todayKey = () => new Date().toISOString().slice(0, 10)
const unix = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / 1000)
const isDate = (value: string | null): value is string => Boolean(value && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const inRange = (rows: Point[], from: string, to: string) => rows.filter((row) => row.date >= from && row.date <= to)
const sortRows = (rows: Point[]) => rows.sort((a, b) => (a.date < b.date ? -1 : 1))

async function getText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    // 같은 원본 주소는 30분 동안 다시 부르지 않는다 (방문자가 많아도 원본 호출은 적게)
    next: { revalidate: UPSTREAM_REVALIDATE_S },
  })
  if (!response.ok) throw new Error(`upstream status ${response.status}`)
  return response.text()
}

/* ── Yahoo Finance: 주식·코인 공통 예비 경로 ───────────────────── */
async function fromYahoo(symbol: string, from: string, to: string): Promise<Point[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${unix(from)}&period2=${unix(to) + 86400}&interval=1d&events=history`
  const json = JSON.parse(await getText(url)) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> }
  }
  const result = json.chart?.result?.[0]
  const closes = result?.indicators?.quote?.[0]?.close
  if (!result || !Array.isArray(result.timestamp) || !Array.isArray(closes)) throw new Error('unexpected yahoo payload')
  const rows: Point[] = []
  result.timestamp.forEach((time, index) => {
    const close = closes[index]
    if (typeof close === 'number' && Number.isFinite(close) && close > 0) {
      rows.push({ date: new Date(time * 1000).toISOString().slice(0, 10), close })
    }
  })
  return inRange(sortRows(rows), from, to)
}

/* ── QQQ: Stooq 일별 CSV ───────────────────────────────────────── */
async function qqqFromStooq(from: string, to: string): Promise<Point[]> {
  const csv = await getText('https://stooq.com/q/d/l/?s=qqq.us&i=d')
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2 || !/^Date,Open/i.test(lines[0] ?? '')) throw new Error('unexpected stooq payload')
  const rows: Point[] = []
  for (const line of lines.slice(1)) {
    const [date = '', , , , close] = line.split(',')
    const value = Number(close)
    if (DATE_RE.test(date) && Number.isFinite(value) && value > 0) rows.push({ date, close: value })
  }
  return inRange(sortRows(rows), from, to)
}

/* ── BTC: CoinGecko ────────────────────────────────────────────── */
async function btcFromCoinGecko(from: string, to: string): Promise<Point[]> {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${unix(from)}&to=${unix(to) + 86400}`
  const json = JSON.parse(await getText(url)) as { prices?: Array<[number, number]> }
  if (!Array.isArray(json.prices)) throw new Error('unexpected coingecko payload')
  // [ms, price] → 날짜별 마지막 값
  const byDay = new Map<string, number>()
  for (const [ms, price] of json.prices) {
    if (Number.isFinite(price) && price > 0) byDay.set(new Date(ms).toISOString().slice(0, 10), price)
  }
  return inRange(sortRows(Array.from(byDay, ([date, close]) => ({ date, close }))), from, to)
}

async function firstOk(key: SeriesKey, attempts: Array<[string, () => Promise<Point[]>]>): Promise<Found | null> {
  for (const [source, load] of attempts) {
    try {
      const rows = await load()
      if (rows.length > 1) return { rows, source }
    } catch (error) {
      // 원문은 서버 로그에만 남기고 응답에는 싣지 않는다
      console.error(`[market-data] ${key} via ${source} failed:`, error instanceof Error ? error.message : error)
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const today = todayKey()
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const to = isDate(rawTo) && rawTo <= today ? rawTo : today
  const from = isDate(rawFrom) && rawFrom >= EARLIEST && rawFrom <= to ? rawFrom : DEFAULT_FROM <= to ? DEFAULT_FROM : to

  const [qqq, btc] = await Promise.all([
    firstOk('qqq', [
      ['Stooq', () => qqqFromStooq(from, to)],
      ['Yahoo Finance', () => fromYahoo('QQQ', from, to)],
    ]),
    firstOk('btc', [
      ['CoinGecko', () => btcFromCoinGecko(from, to)],
      ['Yahoo Finance', () => fromYahoo('BTC-USD', from, to)],
    ]),
  ])

  const data: Partial<Record<SeriesKey, Point[]>> = {}
  const sources: Partial<Record<SeriesKey, string>> = {}
  const missing: SeriesKey[] = []
  for (const [key, found] of [['qqq', qqq], ['btc', btc]] as const) {
    if (found) {
      data[key] = found.rows
      sources[key] = found.source
    } else missing.push(key)
  }

  const complete = missing.length === 0
  return Response.json(
    { updated: new Date().toISOString(), range: { from, to }, data, sources, missing },
    {
      status: Object.keys(data).length ? 200 : 502,
      headers: {
        // 정상일 때만 CDN 캐시(30분). 실패·부분 응답은 캐시하지 않는다
        'Cache-Control': complete ? 'public, s-maxage=1800, stale-while-revalidate=86400' : 'no-store',
      },
    },
  )
}
