'use client'

import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import { Spinner } from '@/components/ui/DataDisplay'
import { cx } from '@/lib/cx'
import type { TxState } from './useTx'
import styles from './TxStatus.module.css'

function HashRow({ hash }: { hash: string }) {
  return (
    <span className={styles.hashRow}>
      <span className={styles.hash}>TX {hash}</span>
      <CopyButton value={hash} label="해시 복사" iconOnly />
    </span>
  )
}

export function TxStatus({ state, idleHint }: { state: TxState; idleHint?: ReactNode }) {
  switch (state.phase) {
    case 'idle':
      return idleHint ? <p className={styles.hint}>{idleHint}</p> : null
    case 'signing':
      return (
        <div key="signing" className={cx(styles.status, styles.working)} role="status">
          <Spinner size={16} />
          <div className={styles.body}>
            <span className={styles.title}>지갑에서 요청을 확인하세요</span>
          </div>
        </div>
      )
    case 'pending':
      return (
        <div key="pending" className={cx(styles.status, styles.working)} role="status">
          <Spinner size={16} />
          <div className={styles.body}>
            <span className={styles.title}>블록에 기록되기를 기다리는 중</span>
            <HashRow hash={state.hash} />
          </div>
        </div>
      )
    case 'confirmed':
      return (
        <div key="confirmed" className={cx(styles.status, styles.done)} role="status">
          <CheckCircleIcon className={styles.icon} size={18} weight="fill" aria-hidden />
          <div className={styles.body}>
            <span className={styles.title}>
              완료 · 블록 #{state.blockNumber.toLocaleString('ko-KR')}
              {state.note ? ` · ${state.note}` : ''}
            </span>
            <HashRow hash={state.hash} />
          </div>
        </div>
      )
    case 'failed':
      return (
        <div key="failed" className={cx(styles.status, styles.failed)} role="alert">
          <XCircleIcon className={styles.icon} size={18} weight="fill" aria-hidden />
          <div className={styles.body}>
            <span className={cx(styles.title, styles.message)}>{state.message}</span>
            {state.hash && <HashRow hash={state.hash} />}
          </div>
        </div>
      )
  }
}
