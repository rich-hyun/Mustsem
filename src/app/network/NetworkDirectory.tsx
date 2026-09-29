'use client'

import { PlusIcon } from '@phosphor-icons/react/ssr'
import { useState } from 'react'
import { NETWORKS, type ChainNetwork } from '@/config/networks'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge } from '@/components/ui/DataDisplay'
import { Table, cell } from '@/components/ui/Table'
import { useWallet } from '@/components/wallet/WalletProvider'
import styles from './network.module.css'

/** 지원 네트워크 목록 — 지갑에 없는 체인은 등록한 뒤 전환한다 */
export function NetworkDirectory() {
  const wallet = useWallet()
  const [pending, setPending] = useState<number | null>(null)
  const walletReady = wallet.status !== 'unavailable'

  const addToWallet = async (network: ChainNetwork) => {
    setPending(network.chainId)
    try {
      await wallet.switchNetwork(network)
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <Table caption="MUSTSEM 지원 네트워크의 이름, 체인 ID, 심볼, RPC 주소" stackOnMobile>
        <thead>
          <tr>
            <th scope="col">네트워크</th>
            <th scope="col">체인 ID</th>
            <th scope="col">심볼</th>
            <th scope="col">RPC URL</th>
            <th scope="col">
              <span className="sr-only">지갑</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {NETWORKS.map((network) => {
            const current = wallet.status === 'connected' && wallet.chainId === network.chainId
            return (
              <tr key={network.key}>
                <td data-label="네트워크" className={cell.strong}>
                  {network.name}
                  {current && (
                    <Badge tone="accent" className={styles.walletHere}>
                      지갑 연결됨
                    </Badge>
                  )}
                </td>
                <td data-label="체인 ID" className={cell.numeric}>
                  {network.chainId}
                </td>
                <td data-label="심볼">{network.symbol}</td>
                <td data-label="RPC URL">
                  <span className={styles.rpcCell}>
                    <span className={styles.rpc}>{network.rpcUrl}</span>
                    <CopyButton value={network.rpcUrl} label={`${network.name} RPC 주소 복사`} iconOnly />
                  </span>
                </td>
                <td data-label="지갑" className={cell.numeric}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!walletReady || current}
                    loading={pending === network.chainId}
                    onClick={() => void addToWallet(network)}
                  >
                    <PlusIcon size={14} weight="bold" aria-hidden />
                    {current ? '사용 중' : '지갑에 추가'}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <p className={styles.directoryNote}>
        {walletReady
          ? '지갑에 추가를 누르면 해당 체인을 지갑에 등록하고 전환합니다. 이미 등록된 체인은 바로 전환됩니다.'
          : 'MetaMask 같은 브라우저 지갑이 있으면 이 목록에서 체인을 바로 등록할 수 있습니다.'}
      </p>
    </>
  )
}
