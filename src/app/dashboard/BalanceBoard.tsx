'use client'

import { ArrowClockwiseIcon } from '@phosphor-icons/react/ssr'
import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/config/site'
import { AnimatedValue } from '@/components/motion/AnimatedValue'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { Metric } from '@/components/ui/DataDisplay'
import { Table, cell } from '@/components/ui/Table'
import { logDevError } from '@/lib/errors'
import { formatDateTime, formatNumber } from '@/lib/format'
import styles from './dashboard.module.css'

interface BalanceRow {
  label: string
  address: string
  balance: number | null
}

type LoadStatus = 'loading' | 'ready' | 'error'

const TIMEOUT_MS = 10_000
const SKELETON_ROWS = 4

/** 값이 들어오면 세어 올리고, 보조기술에는 최종값만 읽힌다 */
function CountedValue({ value }: { value: string }) {
  return (
    <>
      <AnimatedValue value={value} />
      <span className="sr-only">{value}</span>
    </>
  )
}

/** 서버 응답을 믿지 않고 형태를 확인한다. data가 배열이 아니면 형식 오류로 본다. */
function parseBalances(json: unknown): { rows: BalanceRow[]; updated: string | null } {
  if (!json || typeof json !== 'object') throw new Error('invalid response')
  const record = json as Record<string, unknown>
  if (!Array.isArray(record.data)) throw new Error('invalid response')

  const rows = record.data.map((item): BalanceRow => {
    const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : '-'
    const address = typeof entry.address === 'string' && entry.address.trim() ? entry.address.trim() : '-'
    const balance = typeof entry.balance === 'number' && Number.isFinite(entry.balance) ? entry.balance : null
    return { label, address, balance }
  })
  const updated = typeof record.updated === 'string' && !Number.isNaN(Date.parse(record.updated)) ? record.updated : null
  return { rows, updated }
}

export function BalanceBoard() {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [rows, setRows] = useState<BalanceRow[] | null>(null)
  const [updated, setUpdated] = useState<string | null>(null)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return // 중복 요청 방지
    inFlight.current = true
    setStatus('loading')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(`${API_BASE}/api/balances`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const parsed = parseBalances(await response.json())
      setRows(parsed.rows)
      setUpdated(parsed.updated)
      setStatus('ready')
    } catch (error) {
      logDevError('dashboard:balances', error)
      setStatus('error') // 직전 조회 결과가 있으면 그대로 둔다
    } finally {
      window.clearTimeout(timer)
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasRows = rows !== null && rows.length > 0
  const total = rows?.reduce((sum, row) => sum + (row.balance ?? 0), 0) ?? null
  const updatedText = updated ? formatDateTime(updated) : null

  let statusText: string
  if (status === 'loading') statusText = rows ? '최신 잔액을 불러오는 중…' : '잔액 데이터를 불러오는 중…'
  else if (status === 'error') statusText = hasRows ? '연결 오류 · 직전 조회 결과를 표시하고 있습니다' : '연결 오류 · 잔액 데이터를 불러오지 못했습니다'
  else if (!hasRows) statusText = '연결됨 · 표시할 데이터 없음'
  else statusText = updatedText ? `정상 · 마지막 업데이트 ${updatedText}` : '조회 완료 · 서버 업데이트 시각 없음'

  return (
    <>
      <Card className={styles.summary}>
        <div className={styles.toolbar}>
          <div className={styles.status} data-state={status}>
            <span className={styles.dot} aria-hidden />
            <div>
              <span className={styles.statusLabel}>데이터 상태</span>
              <p className={styles.statusText} role="status" aria-live="polite" aria-atomic="true">
                {statusText}
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={status === 'loading'} aria-controls="balance-rows">
            {status !== 'loading' && <ArrowClockwiseIcon size={15} aria-hidden />}
            새로고침
          </Button>
        </div>
        <div className={styles.metrics}>
          <Metric
            label="운영 지갑 수"
            value={rows ? <CountedValue value={rows.length.toLocaleString('ko-KR')} /> : '-'}
            unit={rows ? '개' : undefined}
            muted={!rows}
          />
          <Metric
            label="총 잔액"
            value={total !== null && hasRows ? <CountedValue value={formatNumber(total, 3)} /> : '-'}
            unit={hasRows ? 'MST' : undefined}
            muted={!hasRows}
          />
        </div>
      </Card>

      <Table caption="MST 네트워크 주요 운영 지갑의 구분, 주소, 잔액" stackOnMobile className={styles.table}>
        <thead>
          <tr>
            <th scope="col">구분</th>
            <th scope="col">주소</th>
            <th scope="col" className={cell.numeric}>
              잔액 (MST)
            </th>
          </tr>
        </thead>
        <tbody id="balance-rows" className={styles.rows} aria-busy={status === 'loading'}>
          {hasRows ? (
            rows.map((row, index) => (
              <tr key={`${row.address}-${index}`}>
                <td className={cell.strong} data-label="구분">
                  {row.label}
                </td>
                <td data-label="주소">
                  <span className={styles.addressWrap}>
                    <span className={styles.address} tabIndex={0} title="마우스를 올리거나 포커스하면 주소가 표시됩니다">
                      {row.address}
                    </span>
                    {row.address !== '-' && <CopyButton value={row.address} label="주소 복사" iconOnly />}
                  </span>
                </td>
                <td className={`${cell.numeric} ${styles.balance}`} data-label="잔액 (MST)">
                  {row.balance === null ? '-' : formatNumber(row.balance, 3)}
                </td>
              </tr>
            ))
          ) : status === 'loading' ? (
            // 결과와 같은 모양의 뼈대 행 (상태 문구는 위 상태 줄이 읽어 준다)
            Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={`skeleton-${index}`} className={styles.skeletonRow} aria-hidden>
                <td data-label="구분">
                  <span className={styles.bone} style={{ width: '46%' }} />
                </td>
                <td data-label="주소">
                  <span className={styles.bone} style={{ width: '72%' }} />
                </td>
                <td className={cell.numeric} data-label="잔액 (MST)">
                  <span className={styles.bone} style={{ width: '58%', marginLeft: 'auto' }} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className={styles.stateCell}>
                {status === 'error' && (
                  <>
                    <strong>잔액 데이터를 불러오지 못했습니다.</strong>
                    잠시 후 새로고침을 눌러 다시 시도하세요.
                  </>
                )}
                {status === 'ready' && '표시할 잔액 데이터가 없습니다.'}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <p className={styles.hint}>* 보안을 위해 지갑 주소가 흐림 처리되어 있습니다. 마우스를 올리거나 포커스하면 확인할 수 있습니다.</p>
    </>
  )
}
