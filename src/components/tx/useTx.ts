'use client'

import type { TransactionReceipt, TransactionResponse } from 'ethers'
import { useCallback, useState } from 'react'
import { useWallet } from '@/components/wallet/WalletProvider'
import { describeError, logDevError, UserFacingError } from '@/lib/errors'

export type TxState =
  | { phase: 'idle' }
  | { phase: 'signing' }
  | { phase: 'pending'; hash: string }
  | { phase: 'confirmed'; hash: string; blockNumber: number; note?: string }
  | { phase: 'failed'; message: string; hash?: string }

interface RunOptions {
  /** 기록 완료 후 실행 — 잔액 새로고침 등. 여기서 난 오류는 트랜잭션 결과에 영향을 주지 않는다 */
  onConfirmed?: (receipt: TransactionReceipt) => void | Promise<void>
  /** 완료 표시에 덧붙일 문구 (예: 예상 토큰 번호) */
  note?: (receipt: TransactionReceipt) => string | undefined
}

/**
 * 트랜잭션 한 건의 진행 상태: 지갑 확인 대기 → 블록 기록 대기 → 완료 / 실패.
 * 보낸 트랜잭션은 헤더 지갑 메뉴의 '이 세션의 트랜잭션'에도 남는다.
 */
export function useTx() {
  const { addActivity, updateActivity } = useWallet()
  const [state, setState] = useState<TxState>({ phase: 'idle' })

  const run = useCallback(
    async (label: string, send: () => Promise<TransactionResponse>, options: RunOptions = {}) => {
      setState({ phase: 'signing' })
      let activityId: string | null = null
      let hash: string | undefined
      try {
        const tx = await send()
        hash = tx.hash
        activityId = addActivity({ label, hash: tx.hash, chainId: Number(tx.chainId), status: 'pending' })
        setState({ phase: 'pending', hash: tx.hash })

        const receipt = await tx.wait()
        if (!receipt) throw new UserFacingError('트랜잭션 결과를 확인하지 못했습니다. 잠시 후 잔액을 새로고침하세요.')
        updateActivity(activityId, 'confirmed')
        setState({ phase: 'confirmed', hash: receipt.hash, blockNumber: receipt.blockNumber, note: options.note?.(receipt) })

        try {
          await options.onConfirmed?.(receipt)
        } catch (error) {
          logDevError(`${label}:after`, error)
        }
        return receipt
      } catch (error) {
        logDevError(label, error)
        if (activityId) updateActivity(activityId, 'failed')
        setState({ phase: 'failed', message: describeError(error), hash })
        return null
      }
    },
    [addActivity, updateActivity],
  )

  const reset = useCallback(() => setState({ phase: 'idle' }), [])
  const busy = state.phase === 'signing' || state.phase === 'pending'

  return { state, busy, run, reset, setState }
}
