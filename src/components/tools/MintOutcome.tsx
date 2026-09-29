'use client'

import { ReceiptIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { TxStatus } from '@/components/tx/TxStatus'
import type { TxState } from '@/components/tx/useTx'
import { KeyValueList, type KeyValueItem } from '@/components/ui/DataDisplay'
import { EmptyState } from './CodeOutput'
import parts from './ToolParts.module.css'

interface MintOutcomeProps {
  state: TxState
  /** 발행 대상 요약 (토큰 번호·컨트랙트 등) — 트랜잭션을 보내기 직전에 채운다 */
  details: KeyValueItem[] | null
  emptyText: ReactNode
}

/** 발행 결과 패널: 진행 상태 + 발행 요약 */
export function MintOutcome({ state, details, emptyText }: MintOutcomeProps) {
  if (state.phase === 'idle' && !details) {
    return <EmptyState icon={<ReceiptIcon size={28} aria-hidden />}>{emptyText}</EmptyState>
  }
  // 실패하면 발행되지 않은 토큰 번호가 남지 않도록 요약을 숨긴다
  return (
    <div className={parts.outcome}>
      <TxStatus state={state} />
      {details && state.phase !== 'failed' && <KeyValueList items={details} />}
    </div>
  )
}
