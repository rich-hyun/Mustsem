'use client'

import { ArrowSquareOutIcon } from '@phosphor-icons/react/ssr'
import { useState } from 'react'
import { findNetworkByChainId, type ChainNetwork } from '@/config/networks'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/DataDisplay'
import { Notice } from '@/components/ui/Notice'
import { shortenAddress } from '@/lib/format'
import { useWallet } from './WalletProvider'
import styles from './NetworkGate.module.css'

/**
 * 도구 상단의 준비 상태 안내. 지갑 설치 → 연결 → 네트워크 전환 중
 * 지금 필요한 한 단계만 보여 준다. 준비가 끝나면 한 줄 요약으로 줄어든다.
 */
export function NetworkGate({ network }: { network: ChainNetwork }) {
  const wallet = useWallet()
  const [working, setWorking] = useState(false)

  const act = async (action: () => Promise<unknown>) => {
    setWorking(true)
    try {
      await action()
    } finally {
      setWorking(false)
    }
  }

  if (wallet.status === 'detecting') {
    return (
      <div className={styles.checking} role="status">
        <Spinner size={16} />
        지갑을 확인하는 중…
      </div>
    )
  }

  if (wallet.status === 'unavailable') {
    return (
      <Notice
        tone="warning"
        title="브라우저 지갑이 필요합니다"
        actions={
          <Button href="https://metamask.io/download/" variant="secondary" size="sm" target="_blank" rel="noopener noreferrer">
            MetaMask 설치 안내
            <ArrowSquareOutIcon size={14} aria-hidden />
          </Button>
        }
      >
        조회는 지갑 없이도 할 수 있지만, 트랜잭션을 보내려면 MetaMask 같은 지갑이 필요합니다.
      </Notice>
    )
  }

  if (wallet.status !== 'connected' || !wallet.account) {
    return (
      <Notice
        tone="info"
        title="지갑을 연결하세요"
        actions={
          <Button size="sm" loading={working || wallet.status === 'connecting'} onClick={() => act(() => wallet.connect())}>
            지갑 연결
          </Button>
        }
      >
        연결하면 {network.name} 잔액을 불러오고 트랜잭션을 보낼 수 있습니다.
      </Notice>
    )
  }

  if (wallet.chainId !== network.chainId) {
    const current = findNetworkByChainId(wallet.chainId)
    return (
      <Notice
        tone="warning"
        title="네트워크를 전환하세요"
        actions={
          <Button size="sm" loading={working} onClick={() => act(() => wallet.switchNetwork(network))}>
            {network.name}로 전환
          </Button>
        }
      >
        이 도구는 {network.name}(체인 ID {network.chainId})에서 동작합니다. 지금 지갑은{' '}
        {current ? `${current.name} 네트워크` : `체인 ID ${wallet.chainId ?? '-'}`}에 있습니다.
      </Notice>
    )
  }

  return (
    <div className={styles.ready} role="status">
      <span className={styles.dot} aria-hidden />
      {network.name} 연결됨
      <span className={styles.account}>{shortenAddress(wallet.account)}</span>
    </div>
  )
}
