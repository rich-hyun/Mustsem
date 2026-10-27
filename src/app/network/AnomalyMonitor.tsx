'use client'

import { PauseIcon, PlayIcon } from '@phosphor-icons/react/ssr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Metric } from '@/components/ui/DataDisplay'
import { cx } from '@/lib/cx'
import { createDetector, type Detector, type RiskLevel, type RiskResult, type Tx } from './provisioning'
import styles from './network.module.css'

interface FeedItem {
  id: number
  tx: Tx
  tag?: string
  result: RiskResult
}

const LEVEL_LABEL: Record<RiskLevel, string> = { ok: '정상', warn: '경고', critical: '고위험', blocked: '차단' }
const ACTION_LABEL = { freeze: '지갑 동결', blacklist: '블랙리스트 등록' } as const
const FEED_MAX = 30
const CHART_MAX = 40

const randomAddress = () => `0x${Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0').toUpperCase()}`
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')

/**
 * 온체인 이상거래 탐지 시연. 위험도를 초록(정상) · 주황(경고) · 빨강(고위험) 구간으로 시각화한다.
 * 거래는 화면 안에서 만든 가상 데이터이며 실제 체인 데이터가 아니다.
 */
export function AnomalyMonitor() {
  const detector = useRef<Detector | null>(null)
  const idRef = useRef(0)
  const burstRef = useRef(0)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [chart, setChart] = useState<Array<{ id: number; score: number; level: RiskLevel }>>([])
  const [latest, setLatest] = useState<RiskResult | null>(null)
  const [counts, setCounts] = useState({ total: 0, warn: 0, critical: 0, frozen: 0, blacklist: 0 })
  const [running, setRunning] = useState(true)
  const [freeze, setFreeze] = useState(true)
  const [blacklist, setBlacklist] = useState(true)

  const push = useCallback((tx: Tx, tag?: string) => {
    const det = detector.current
    if (!det) return
    const result = det.evaluate(tx)
    const id = ++idRef.current
    setFeed((prev) => [{ id, tx, tag, result }, ...prev].slice(0, FEED_MAX))
    setChart((prev) => [...prev, { id, score: result.score, level: result.level }].slice(-CHART_MAX))
    setLatest(result)
    setCounts((c) => ({
      total: c.total + 1,
      warn: c.warn + (result.level === 'warn' ? 1 : 0),
      critical: c.critical + (result.level === 'critical' || result.level === 'blocked' ? 1 : 0),
      frozen: det.frozen.size,
      blacklist: det.blacklist.size,
    }))
  }, [])

  const normalTx = useCallback((): Tx => ({ from: randomAddress(), to: randomAddress(), amount: 50 + Math.random() * 150, ts: Date.now() }), [])

  // 탐지기 준비와 기준 분포 학습(정상 거래 12건)
  useEffect(() => {
    detector.current = createDetector({ blacklist: ['0xBAD0'] })
    for (let i = 0; i < 12; i++) push(normalTx())
  }, [push, normalTx])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => push(normalTx()), 1500)
    return () => clearInterval(timer)
  }, [running, push, normalTx])

  useEffect(() => {
    if (detector.current) detector.current.policy.freeze = freeze
  }, [freeze])
  useEffect(() => {
    if (detector.current) detector.current.policy.blacklist = blacklist
  }, [blacklist])

  const injectSpike = () => push({ from: '0xA11CE', to: randomAddress(), amount: 25000, ts: Date.now(), newWallet: true }, '고액 급증')
  const injectBurst = () => {
    const from = `0xB0B${burstRef.current++ % 10}`
    for (let i = 0; i < 6; i++) push({ from, to: randomAddress(), amount: 120, ts: Date.now() }, '반복 전송')
  }
  const injectBlacklist = () => push({ from: randomAddress(), to: '0xBAD0', amount: 300, ts: Date.now() }, '블랙리스트')

  return (
    <div className={styles.monitor}>
      <div className={styles.metrics}>
        <Metric label="검사 거래" value={counts.total} />
        <Metric label="경고" value={counts.warn} />
        <Metric label="고위험" value={counts.critical} />
        <Metric label="동결 지갑" value={counts.frozen} />
        <Metric label="블랙리스트" value={counts.blacklist} />
      </div>

      <div className={styles.gauge}>
        <div className={styles.track} role="img" aria-label={`위험도 구간: 정상 0에서 49, 경고 50에서 79, 고위험 80에서 100. 최근 거래 위험도 ${latest ? latest.score : '-'}`}>
          <span className={cx(styles.zone, styles.zoneOk)} style={{ flex: 50 }} />
          <span className={cx(styles.zone, styles.zoneWarn)} style={{ flex: 30 }} />
          <span className={cx(styles.zone, styles.zoneCrit)} style={{ flex: 20 }} />
          <i className={styles.marker} style={{ left: `${latest?.score ?? 0}%` }} aria-hidden />
        </div>
        <div className={styles.zoneLabels} aria-hidden>
          <span style={{ flex: 50 }}>정상 0-49</span>
          <span style={{ flex: 30 }}>경고 50-79</span>
          <span style={{ flex: 20 }}>고위험 80-100</span>
        </div>
        <p className={styles.gaugeNow} aria-live="polite">
          최근 거래 위험도: {latest ? `${latest.score} (${LEVEL_LABEL[latest.level]})` : '-'}
        </p>
      </div>

      <div className={styles.chart} role="img" aria-label="최근 거래 위험도 추이">
        {chart.map((bar) => (
          <i key={bar.id} className={styles[`bar_${bar.level}`]} style={{ height: `${Math.max(bar.score, 4)}%` }} title={`${bar.score} ${LEVEL_LABEL[bar.level]}`} />
        ))}
      </div>

      <div className={styles.controls}>
        <Button type="button" variant="secondary" size="sm" onClick={injectSpike}>
          고액 급증 주입
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={injectBurst}>
          반복 전송 주입
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={injectBlacklist}>
          블랙리스트 거래 주입
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRunning((r) => !r)}>
          {running ? <PauseIcon size={16} aria-hidden /> : <PlayIcon size={16} aria-hidden />}
          {running ? '일시정지' : '재개'}
        </Button>
      </div>
      <div className={styles.controls}>
        <label className={styles.check}>
          <input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} />
          <span>고위험 시 지갑 자동 동결</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={blacklist} onChange={(e) => setBlacklist(e.target.checked)} />
          <span>고위험 시 블랙리스트 자동 등록</span>
        </label>
      </div>

      <ul className={styles.feed} aria-label="거래 검사 기록">
        {feed.map(({ id, tx, tag, result }) => (
          <li key={id} className={styles[`row_${result.level}`]}>
            <span className={styles.meter} aria-hidden>
              <b style={{ width: `${result.score}%` }} />
            </span>
            <span className={styles.level}>{LEVEL_LABEL[result.level]}</span>
            <span className={styles.txText}>
              {tx.from} → {tx.to} · {fmt(tx.amount)} MST
              {tag && ` [${tag}]`}
              {result.reasons.length > 0 && ` · ${result.reasons.join(', ')}`}
              {result.actions.length > 0 && ` ⇒ ${result.actions.map((a) => ACTION_LABEL[a]).join(' + ')}`}
              {result.level !== 'ok' && ` (위험도 ${result.score})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
