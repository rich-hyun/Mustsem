'use client'

/**
 * 실제 체인의 최근 거래에 이상거래 탐지 규칙을 적용한 결과 (/api/v1/anomaly/scan, 조회 전용).
 * 대응(지갑 동결·블랙리스트)은 권고로만 보여 준다. 온체인 조치는 ComplianceGuard 컨트랙트 배포와 권한이 필요하다.
 */
import { ArrowClockwiseIcon } from '@phosphor-icons/react/ssr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Metric, Spinner } from '@/components/ui/DataDisplay'
import { SelectField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import type { RiskAction, RiskLevel } from '@/lib/anomaly'
import { cx } from '@/lib/cx'
import { logDevError } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import styles from './network.module.css'

interface ScanItem {
  kind: 'coin' | 'token' | 'nft'
  block: number
  hash: string
  from: string
  to: string
  amount: string
  symbol: string
  at: string
  score: number
  level: RiskLevel
  reasons: string[]
  recommended: RiskAction[]
}

interface Scan {
  network: { name: string; chainId: number; symbol: string }
  head: number
  headAt: string
  blocks: { from: number; to: number; withTransactions: number }
  logs: { from: number; to: number }
  counts: { scanned: number; coin: number; token: number; nft: number; warn: number; critical: number }
  baselineReady: boolean
  guardDeployed: boolean
  items: ScanItem[]
  scannedAt: string
}

const LEVEL_LABEL: Record<RiskLevel, string> = { ok: '정상', warn: '경고', critical: '고위험', blocked: '차단' }
const ACTION_LABEL: Record<RiskAction, string> = { freeze: '지갑 동결', blacklist: '블랙리스트 등록' }
const KIND_LABEL: Record<ScanItem['kind'], string> = { coin: '코인', token: '토큰', nft: 'NFT' }
const WINDOWS = [
  { blocks: 500, label: '최근 500블록' },
  { blocks: 2000, label: '최근 2,000블록' },
  { blocks: 5000, label: '최근 5,000블록' },
]
const REFRESH_MS = 30_000
const CHART_MAX = 40

const shortAddress = (value: string) => (value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value)
const count = (value: number) => value.toLocaleString('ko-KR')
/** 소수는 6자리까지만 보인다 (표시용. 판정은 서버가 원래 값으로 한다) */
const trimAmount = (value: string) => {
  const [whole = '0', fraction = ''] = value.split('.')
  const digits = fraction.slice(0, 6).replace(/0+$/, '')
  return `${Number(whole).toLocaleString('ko-KR')}${digits ? `.${digits}` : ''}`
}

export function AnomalyLive() {
  const [blocks, setBlocks] = useState(2000)
  const [scan, setScan] = useState<Scan | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/anomaly/scan?chainId=7601&blocks=${blocks}`, { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: Scan } | null
      if (id !== requestId.current) return
      if (!response.ok || !body?.ok || !body.data) throw new Error(`scan status ${response.status}`)
      setScan(body.data)
      setFailed(false)
    } catch (caught) {
      logDevError('anomaly:scan', caught)
      if (id === requestId.current) setFailed(true)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [blocks])

  // 처음 한 번, 그 뒤로는 화면을 보고 있을 때만 30초마다 다시 읽는다
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const latest = scan?.items[0] ?? null
  const recommended = scan ? scan.items.filter((item) => item.recommended.length > 0).length : 0
  const chart = scan ? scan.items.slice(0, CHART_MAX).reverse() : []
  const minutes = scan ? Math.round(((scan.blocks.to - scan.blocks.from + 1) * 2) / 60) : 0

  return (
    <div className={styles.monitor}>
      <div className={styles.liveBar}>
        <p className={styles.liveSource} aria-live="polite">
          {scan ? (
            <>
              <strong>{scan.network.name} 메인넷</strong> (체인 ID {scan.network.chainId}) · 최신 블록 {count(scan.head)} ·{' '}
              <span className="keep">{formatDateTime(scan.scannedAt)} 조회</span>
            </>
          ) : failed ? (
            '네트워크에서 거래를 읽지 못했습니다.'
          ) : (
            '체인에서 최근 거래를 읽고 있습니다.'
          )}
        </p>
        <div className={styles.liveActions}>
          <SelectField id="anomaly-window" label="조회 구간" className={styles.liveWindow} value={String(blocks)} onChange={(event) => setBlocks(Number(event.target.value))}>
            {WINDOWS.map((option) => (
              <option key={option.blocks} value={option.blocks}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Spinner size={14} /> : <ArrowClockwiseIcon size={15} aria-hidden />} 새로 고침
          </Button>
        </div>
      </div>

      {failed && (
        <div role="alert">
          <Notice
            tone="danger"
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                다시 시도
              </Button>
            }
          >
            네트워크(RPC)가 응답하지 않아 거래를 읽지 못했습니다. 잠시 후 다시 시도하세요.
          </Notice>
        </div>
      )}

      <div className={styles.metrics}>
        <Metric label="검사 거래" value={scan ? count(scan.counts.scanned) : '-'} />
        <Metric label="경고" value={scan ? count(scan.counts.warn) : '-'} />
        <Metric label="고위험" value={scan ? count(scan.counts.critical) : '-'} />
        <Metric label="대응 권고" value={scan ? count(recommended) : '-'} />
        <Metric label="거래 있는 블록" value={scan ? count(scan.blocks.withTransactions) : '-'} />
      </div>

      <div className={styles.gauge}>
        <div
          className={styles.track}
          role="img"
          aria-label={`위험도 구간: 정상 0에서 49, 경고 50에서 79, 고위험 80에서 100. 가장 최근 거래 위험도 ${latest ? latest.score : '-'}`}
        >
          <span className={cx(styles.zone, styles.zoneOk)} style={{ flex: 50 }} />
          <span className={cx(styles.zone, styles.zoneWarn)} style={{ flex: 30 }} />
          <span className={cx(styles.zone, styles.zoneCrit)} style={{ flex: 20 }} />
          {latest && <i className={styles.marker} style={{ left: `${latest.score}%` }} aria-hidden />}
        </div>
        <div className={styles.zoneLabels} aria-hidden>
          <span style={{ flex: 50 }}>정상 0-49</span>
          <span style={{ flex: 30 }}>경고 50-79</span>
          <span style={{ flex: 20 }}>고위험 80-100</span>
        </div>
        <p className={styles.gaugeNow}>가장 최근 거래 위험도: {latest ? `${latest.score} (${LEVEL_LABEL[latest.level]})` : '-'}</p>
      </div>

      {chart.length > 0 && (
        <div className={styles.chart} role="img" aria-label="최근 거래 위험도 추이 (오래된 거래부터)">
          {chart.map((bar) => (
            <i key={`${bar.hash}-${bar.kind}-${bar.from}-${bar.to}`} className={styles[`bar_${bar.level}`]} style={{ height: `${Math.max(bar.score, 4)}%` }} title={`${bar.score} ${LEVEL_LABEL[bar.level]}`} />
          ))}
        </div>
      )}

      {scan && (
        <p className={styles.liveScope}>
          코인 전송은 블록 {count(scan.blocks.from)}~{count(scan.blocks.to)}(약 {count(minutes)}분) 구간에서 {count(scan.counts.coin)}건, 토큰·NFT 전송은 블록{' '}
          {count(scan.logs.from)}~{count(scan.logs.to)} 구간에서 {count(scan.counts.token + scan.counts.nft)}건을 읽었습니다.
          {!scan.baselineReady && ' 거래가 8건 미만인 자산은 금액 급증 기준(평균·표준편차)을 아직 만들 수 없어 나머지 규칙만 적용했습니다.'}
        </p>
      )}

      {scan && scan.items.length === 0 ? (
        <p className={styles.liveEmpty}>이 구간에는 체인에 기록된 전송이 없습니다. 조회 구간을 넓히거나, 거래가 생긴 뒤 새로 고쳐 보세요.</p>
      ) : (
        <ul className={styles.feed} aria-label="실제 거래 검사 기록 (최신순)">
          {(scan?.items ?? []).map((item, index) => (
            <li key={`${item.hash}-${index}`} className={styles[`row_${item.level}`]}>
              <span className={styles.meter} aria-hidden>
                <b style={{ width: `${item.score}%` }} />
              </span>
              <span className={styles.level}>{LEVEL_LABEL[item.level]}</span>
              <span className={styles.txText}>
                <span className="keep">{formatDateTime(item.at)}</span> · {KIND_LABEL[item.kind]} · <span title={item.from}>{shortAddress(item.from)}</span> →{' '}
                <span title={item.to}>{shortAddress(item.to)}</span> · {trimAmount(item.amount)} {item.symbol} · 블록 {count(item.block)}
                {item.reasons.length > 0 && ` · ${item.reasons.join(', ')}`}
                {item.recommended.length > 0 && ` ⇒ 권고: ${item.recommended.map((action) => ACTION_LABEL[action]).join(' + ')}`}
                {item.level !== 'ok' && ` (위험도 ${item.score})`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Notice tone="neutral">
        실제 체인을 읽기만 하는 화면입니다. 지갑 동결과 블랙리스트 등록은 권고로만 표시하며 이 화면에서 실행하지 않습니다.{' '}
        {scan?.guardDeployed
          ? '온체인 조치는 이 네트워크에 배포된 대응 컨트랙트(ComplianceGuard)의 운영 권한으로 실행합니다.'
          : '온체인 자동 대응은 대응 컨트랙트(ComplianceGuard)를 이 네트워크에 배포한 뒤 사용할 수 있습니다.'}
      </Notice>
    </div>
  )
}
