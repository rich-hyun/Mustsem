'use client'

import { ArrowClockwiseIcon } from '@phosphor-icons/react/ssr'
import type { Chart as ChartInstance } from 'chart.js'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatedValue } from '@/components/motion/AnimatedValue'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/DataDisplay'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { logDevError } from '@/lib/errors'
import {
  BASE_INDEX,
  MARKET_FROM,
  MST_PREMIUM,
  cleanPoints,
  dateKo,
  lastDateOf,
  listDays,
  monthDay,
  resample,
  toDaily,
  todayKey,
  type Bucket,
  type Interval,
  type MarketKey,
  type MarketPoint,
  type RealKey,
} from '@/lib/market'
import styles from './dashboard.module.css'

interface SeriesMeta {
  key: MarketKey
  label: string
  color: string
  unit: string
  decimals: number
  width: number
  derived?: boolean
}

/* 표시 순서: MST → BTC → QQQ. BTC는 비트코인 고유색, QQQ는 파랑으로 구분한다 */
const SERIES: SeriesMeta[] = [
  { key: 'mst', label: 'MST 코인', color: '#077a64', unit: '$', decimals: 0, width: 2.6, derived: true },
  { key: 'btc', label: '비트코인 (BTC)', color: '#f7931a', unit: '$', decimals: 0, width: 1.8 },
  { key: 'qqq', label: 'QQQ (나스닥100 ETF)', color: '#3b6fd8', unit: '$', decimals: 2, width: 1.8 },
]
const REAL_KEYS: RealKey[] = ['btc', 'qqq']
/** 화면에 이름을 밝혀도 되는 시세 제공처 (그 밖의 값은 일반 명칭으로 바꾼다) */
const PROVIDERS = new Set(['CoinGecko', 'Stooq', 'Yahoo Finance'])
const TIMEOUT_MS = 12_000
const INTERVALS: { id: Interval; label: string }[] = [
  { id: 'day', label: '1일' },
  { id: 'week', label: '1주' },
  { id: 'month', label: '1달' },
]

interface Model {
  days: string[]
  daily: Partial<Record<MarketKey, number[]>>
  index: Partial<Record<MarketKey, number[]>>
  sources: Partial<Record<MarketKey, { name: string; lastDate: string | null }>>
  active: SeriesMeta[]
  missing: SeriesMeta[]
  newest: string | null
}

type Status = 'loading' | 'ready' | 'error'
type Found = Partial<Record<RealKey, { points: MarketPoint[]; source: string }>>

const formatIndex = (value: number) => value.toFixed(1)
const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const formatRaw = (series: SeriesMeta, value: number | undefined) =>
  value === undefined
    ? '-'
    : `${series.unit}${value.toLocaleString('ko-KR', { minimumFractionDigits: series.decimals, maximumFractionDigits: series.decimals })}`

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/** 1) 같은 사이트의 시세 함수 → 2) 비트코인만 CoinGecko 직접 조회 */
async function loadSeries(from: string, to: string, signal: AbortSignal): Promise<Found> {
  const found: Found = {}
  try {
    const json = await fetchJson(`/api/market-data?from=${from}&to=${to}`, signal)
    const record = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
    const data = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : {}
    const sources = record.sources && typeof record.sources === 'object' ? (record.sources as Record<string, unknown>) : {}
    for (const key of REAL_KEYS) {
      const points = cleanPoints(data[key])
      const source = sources[key]
      if (points) found[key] = { points, source: typeof source === 'string' && PROVIDERS.has(source) ? source : '시세 제공처' }
    }
  } catch (error) {
    logDevError('dashboard:market-data', error)
  }

  if (!found.btc && !signal.aborted) {
    try {
      const fromTs = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)
      const toTs = Math.floor(Date.parse(`${to}T00:00:00Z`) / 1000) + 86400
      const json = await fetchJson(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTs}&to=${toTs}`,
        signal,
      )
      const prices = json && typeof json === 'object' ? (json as { prices?: unknown }).prices : null
      if (Array.isArray(prices)) {
        const byDay = new Map<string, number>()
        for (const entry of prices) {
          if (Array.isArray(entry) && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
            byDay.set(new Date(entry[0]).toISOString().slice(0, 10), entry[1])
          }
        }
        const points = cleanPoints(Array.from(byDay, ([date, close]) => ({ date, close })).sort((a, b) => (a.date < b.date ? -1 : 1)))
        if (points) found.btc = { points, source: 'CoinGecko' }
      }
    } catch (error) {
      logDevError('dashboard:coingecko', error)
    }
  }
  return found
}

function buildModel(found: Found, from: string, to: string): Model | null {
  const btc = found.btc
  if (!btc) return null
  const days = listDays(from, to)
  const model: Model = { days, daily: {}, index: {}, sources: {}, active: [], missing: [], newest: null }
  for (const key of REAL_KEYS) {
    const entry = found[key]
    if (!entry) continue
    const values = toDaily(entry.points, days)
    const base = values[0] || 1
    model.daily[key] = values
    model.index[key] = values.map((value) => (value / base) * BASE_INDEX)
    model.sources[key] = { name: entry.source, lastDate: lastDateOf(entry.points, to) }
  }
  // MST = 비트코인 × (1 + 1%)
  model.daily.mst = (model.daily.btc ?? []).map((value) => value * (1 + MST_PREMIUM))
  model.index.mst = (model.index.btc ?? []).map((value) => value * (1 + MST_PREMIUM))
  model.sources.mst = { name: `비트코인 시세 × ${1 + MST_PREMIUM} (파생 계산)`, lastDate: model.sources.btc?.lastDate ?? null }
  model.active = SERIES.filter((series) => model.daily[series.key])
  model.missing = SERIES.filter((series) => !model.daily[series.key])
  model.newest =
    REAL_KEYS.map((key) => model.sources[key]?.lastDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .pop() ?? null
  return model
}

export function MarketChart() {
  const [status, setStatus] = useState<Status>('loading')
  const [model, setModel] = useState<Model | null>(null)
  const [unit, setUnit] = useState<Interval>('day')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartInstance<'line'> | null>(null)
  const modelRef = useRef<Model | null>(null)
  const bucketsRef = useRef<Bucket[]>([])
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    setStatus('loading')
    try {
      const to = todayKey()
      const next = buildModel(await loadSeries(MARKET_FROM, to, controller.signal), MARKET_FROM, to)
      // 더 새 요청이 시작됐으면 이 결과는 버린다 (시간 초과로 끊긴 경우는 오류로 보여 준다)
      if (controllerRef.current !== controller) return
      modelRef.current = next
      setModel(next)
      setStatus(next ? 'ready' : 'error')
    } finally {
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => controllerRef.current?.abort()
  }, [load])

  // 차트 라이브러리는 이 화면에서만, 데이터가 준비된 뒤에 불러온다
  useEffect(() => {
    if (!model) return
    let cancelled = false
    const draw = async () => {
      const { Chart, CategoryScale, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip } = await import('chart.js')
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      Chart.register(CategoryScale, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip)

      const buckets = resample(model.days, unit)
      bucketsRef.current = buckets
      const labels = buckets.map((bucket) => bucket.label)
      const datasets = model.active.map((series) => ({
        label: series.label,
        data: buckets.map((bucket) => Number((model.index[series.key]?.[bucket.index] ?? 0).toFixed(2))),
        borderColor: series.color,
        backgroundColor: series.color,
        borderWidth: series.width,
        pointRadius: unit === 'day' ? 0 : 3,
        pointHoverRadius: 5,
        tension: 0.25,
      }))

      if (chartRef.current) {
        chartRef.current.data.labels = labels
        chartRef.current.data.datasets = datasets
        chartRef.current.update()
        return
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const root = getComputedStyle(document.documentElement)
      const token = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback
      const ink = token('--ink-3', '#5b6778')
      const line = token('--line', '#e2e7ee')
      const family = token('--font-sans', 'sans-serif')

      chartRef.current = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: reduced ? false : { duration: 700, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, color: ink, font: { family, size: 12, weight: 600 } },
            },
            tooltip: {
              backgroundColor: '#0a1628',
              titleColor: '#ffffff',
              bodyColor: '#d5dce8',
              padding: 12,
              cornerRadius: 8,
              boxPadding: 4,
              usePointStyle: true,
              titleFont: { family, size: 12, weight: 650 },
              bodyFont: { family, size: 12 },
              callbacks: {
                title: (items) => bucketsRef.current[items[0]?.dataIndex ?? 0]?.title ?? '',
                label: (item) => {
                  const current = modelRef.current
                  const series = current?.active[item.datasetIndex]
                  const bucket = bucketsRef.current[item.dataIndex]
                  if (!current || !series || !bucket) return ''
                  return ` ${series.label}: ${formatIndex(item.parsed.y ?? 0)} (${formatRaw(series, current.daily[series.key]?.[bucket.index])})`
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { color: line },
              ticks: { color: ink, maxTicksLimit: 12, maxRotation: 0, autoSkip: true, font: { family, size: 11 } },
            },
            y: {
              title: { display: true, text: '지수 (2026.01.01 = 100)', color: ink, font: { family, size: 12 } },
              grid: { color: line },
              border: { display: false },
              ticks: { color: ink, font: { family, size: 11 }, callback: (value) => Number(value).toFixed(0) },
            },
          },
        },
      })
    }
    void draw().catch((error) => {
      logDevError('dashboard:chart', error)
      if (!cancelled) setStatus('error')
    })
    return () => {
      cancelled = true
    }
  }, [model, unit])

  useEffect(
    () => () => {
      chartRef.current?.destroy()
      chartRef.current = null
    },
    [],
  )

  const newestText = model?.newest ? dateKo(model.newest) : null
  let statusText: string
  if (status === 'loading') statusText = model ? '최신 시세를 다시 불러오는 중…' : '실제 시세를 불러오는 중…'
  else if (status === 'error' || !model) statusText = '연결 오류 · 시세를 불러오지 못했습니다'
  else if (model.missing.length) statusText = `일부 누락 (${model.missing.map((series) => series.label).join(', ')})`
  else statusText = newestText ? `정상 · 최근 데이터 ${newestText}` : '정상'
  const dotState = status === 'ready' && model && model.missing.length ? 'error' : status

  return (
    <div className={styles.market}>
      <div className={styles.marketToolbar}>
        <div className={styles.status} data-state={dotState}>
          <span className={styles.dot} aria-hidden />
          <div>
            <span className={styles.statusLabel}>데이터 상태</span>
            <p className={styles.statusText} role="status" aria-live="polite" aria-atomic="true">
              {statusText}
            </p>
          </div>
        </div>
        <SegmentedControl options={INTERVALS} value={unit} onChange={setUnit} label="보기 단위" />
      </div>

      <Card padding="none" className={styles.marketCard}>
        <div className={styles.marketStats} aria-label="기간 내 가치 변화 요약">
          {model
            ? model.active.map((series) => {
                const index = model.index[series.key] ?? []
                const raw = model.daily[series.key] ?? []
                const source = model.sources[series.key]
                const last = index[index.length - 1] ?? BASE_INDEX
                const change = last - BASE_INDEX
                return (
                  <div key={series.key} className={styles.marketStat}>
                    <span className={styles.marketName}>
                      <span className={styles.swatch} style={{ '--swatch': series.color } as CSSProperties} aria-hidden />
                      {series.label}
                    </span>
                    <span className={styles.marketValue}>
                      <AnimatedValue value={formatIndex(last)} />
                      <span className="sr-only">지수 {formatIndex(last)}</span>
                      <span className={styles.marketChange} data-dir={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}>
                        {formatPct(change)}
                      </span>
                    </span>
                    <span className={styles.marketRaw}>
                      {formatRaw(series, raw[0])} → {formatRaw(series, raw[raw.length - 1])}
                    </span>
                    <span className={styles.marketSource}>
                      <Badge tone={series.derived ? 'info' : 'accent'} pill>
                        {series.derived ? '파생 (BTC × 1.01)' : '실제 시세'}
                      </Badge>
                      {source?.lastDate ? `최신 데이터 ${monthDay(source.lastDate)}` : ''}
                    </span>
                  </div>
                )
              })
            : SERIES.map((series) => (
                <div key={series.key} className={styles.marketStat} aria-hidden>
                  <span className={styles.bone} style={{ width: '44%' }} />
                  <span className={styles.bone} style={{ width: '62%', height: 22 }} />
                  <span className={styles.bone} style={{ width: '70%' }} />
                </div>
              ))}
        </div>

        <div className={styles.chartWrap}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="MST 코인, 비트코인, QQQ의 2026년 가치 변화 비교 선 그래프. 요약 수치는 그래프 위 표에 있습니다."
          />
          {status !== 'ready' && !model && (
            <div className={styles.chartState}>
              {status === 'loading' ? (
                <span className={styles.chartSkeleton} aria-hidden />
              ) : (
                <div className={styles.chartError}>
                  <strong>시세를 불러오지 못했습니다.</strong>
                  <span>잠시 후 다시 시도하세요.</span>
                  <Button variant="secondary" size="sm" onClick={() => void load()}>
                    <ArrowClockwiseIcon size={15} aria-hidden />
                    다시 시도
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <p className={styles.hint}>
        * 2026년 1월 1일 가치를 100으로 놓은 지수로 환산해 표시합니다. MST 코인은 비트코인 시세보다 1% 높은 가치로 계산한 파생 지수입니다.
        그래프 위에 마우스를 올리면 실제 시세도 확인할 수 있습니다.
      </p>

      {model && (
        <div className={styles.sources}>
          <p>
            {model.missing.length
              ? `※ ${model.missing.map((series) => series.label).join(', ')} 시세를 불러오지 못해 그래프에서 제외되었습니다. 나머지는 실제 시세입니다.`
              : '※ 비트코인과 QQQ는 실제 시세이며, 페이지를 열 때마다 최신 데이터를 다시 불러옵니다. MST 코인은 비트코인 시세 × 1.01로 계산합니다.'}
          </p>
          <ul>
            {model.active.map((series) => {
              const source = model.sources[series.key]
              return (
                <li key={series.key}>
                  {series.label}: {source?.name ?? '시세 제공처'}
                  {source?.lastDate ? `, 최신 데이터 ${dateKo(source.lastDate)}` : ''}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
