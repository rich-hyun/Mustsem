'use client'

import { ArrowSquareOutIcon } from '@phosphor-icons/react/ssr'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { useWallet } from '@/components/wallet/WalletProvider'

/**
 * 네트워크를 고르는 발행 도구(NFT·SBT·RWA)의 지갑 준비 안내.
 * 네트워크 불일치는 NetworkPicker가 알려 주므로 여기서는 설치·연결만 다룬다.
 * action: 안내 문구의 동사 (예: '발행' → "발행하려면 …")
 */
export function WalletHint({ action = '발행' }: { action?: string }) {
  const wallet = useWallet()

  if (wallet.status === 'unavailable') {
    return (
      <Notice
        tone="neutral"
        actions={
          <Button href="https://metamask.io/download/" variant="secondary" size="sm" target="_blank" rel="noopener noreferrer">
            MetaMask 설치 안내
            <ArrowSquareOutIcon size={14} aria-hidden />
          </Button>
        }
      >
        지갑 없이 코드 생성만 사용할 수 있습니다. {action}하려면 MetaMask 같은 브라우저 지갑이 필요합니다.
      </Notice>
    )
  }

  if (wallet.status === 'disconnected' || wallet.status === 'connecting') {
    return (
      <Notice
        tone="info"
        actions={
          <Button size="sm" loading={wallet.status === 'connecting'} onClick={() => void wallet.connect()}>
            지갑 연결
          </Button>
        }
      >
        {action}하려면 지갑을 연결하세요.
      </Notice>
    )
  }

  return null
}
