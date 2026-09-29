'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import type { ContractMap } from '@/config/contracts'
import { NETWORKS, findNetworkByChainId } from '@/config/networks'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, KeyValueList } from '@/components/ui/DataDisplay'
import { useContractStatus } from '@/components/tools/useContractStatus'
import { useWallet } from './WalletProvider'
import styles from './NetworkPicker.module.css'

interface NetworkPickerProps {
  contracts: ContractMap
  /** 정보 목록에 표시할 컨트랙트 이름 (예: 'NFT 컨트랙트') */
  contractLabel: string
}

/**
 * 도구의 대상 네트워크 선택. 클릭하면 연결된 지갑도 함께 전환을 요청하고,
 * 화살표 키로 고를 때는 전환 요청 없이 선택만 옮긴다(키 입력마다 지갑 창이 뜨지 않게).
 */
export function NetworkPicker({ contracts, contractLabel }: NetworkPickerProps) {
  const wallet = useWallet()
  const target = wallet.targetNetwork
  const contract = contracts[target.key]
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const [switching, setSwitching] = useState(false)

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = NETWORKS.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
      : null
    if (next === null) return
    event.preventDefault()
    const network = NETWORKS[next]
    if (!network) return
    void wallet.setTargetNetwork(network.key, { switchWallet: false })
    refs.current[next]?.focus()
  }

  const codeStatus = useContractStatus(target, contract)
  const connected = wallet.status === 'connected'
  const walletNetwork = findNetworkByChainId(wallet.chainId)
  const mismatch = connected && wallet.chainId !== target.chainId

  return (
    <div className={styles.picker}>
      <div className={styles.options} role="radiogroup" aria-label="대상 네트워크">
        {NETWORKS.map((network, index) => {
          const selected = network.key === target.key
          return (
            <button
              key={network.key}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={styles.option}
              onClick={() => void wallet.setTargetNetwork(network.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className={styles.name}>{network.name}</span>
              <span className={styles.meta}>
                {network.symbol} · {network.chainId}
              </span>
              {(!contracts[network.key] || (connected && wallet.chainId === network.chainId)) && (
                <span className={styles.tags}>
                  {!contracts[network.key] && <Badge tone="warning">미배포</Badge>}
                  {connected && wallet.chainId === network.chainId && <Badge tone="accent">지갑</Badge>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {mismatch && (
        <div className={styles.mismatch} role="status">
          <span>
            지갑은 지금 {walletNetwork ? walletNetwork.name : `체인 ID ${wallet.chainId ?? '-'}`}에 있습니다. 발행하려면 {target.name}로
            전환하세요.
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={switching}
            onClick={async () => {
              setSwitching(true)
              try {
                await wallet.switchNetwork(target)
              } finally {
                setSwitching(false)
              }
            }}
          >
            {target.name}로 전환
          </Button>
        </div>
      )}

      <KeyValueList
        items={[
          { label: '체인 ID', value: target.chainId },
          { label: '심볼', value: target.symbol },
          { label: 'RPC URL', value: target.rpcUrl, mono: true, action: <CopyButton value={target.rpcUrl} label="RPC 주소 복사" iconOnly /> },
          {
            label: contractLabel,
            value: contract ?? '이 네트워크에는 아직 배포되지 않았습니다',
            mono: Boolean(contract),
            action: contract ? (
              <>
                {codeStatus === 'missing' && <Badge tone="danger">컨트랙트 없음</Badge>}
                {codeStatus === 'unknown' && <Badge tone="neutral">네트워크 응답 없음</Badge>}
                <CopyButton value={contract} label="컨트랙트 주소 복사" iconOnly />
              </>
            ) : undefined,
          },
        ]}
      />
    </div>
  )
}
