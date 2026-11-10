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
import { DEFAULT_FROM, EARLIEST, isDate, loadSeries, todayKey, type Point, type SeriesKey } from '@/server/market-data'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const today = todayKey()
  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  const to = isDate(rawTo) && rawTo <= today ? rawTo : today
  const from = isDate(rawFrom) && rawFrom >= EARLIEST && rawFrom <= to ? rawFrom : DEFAULT_FROM <= to ? DEFAULT_FROM : to

  const [qqq, btc] = await Promise.all([loadSeries('qqq', from, to), loadSeries('btc', from, to)])

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
