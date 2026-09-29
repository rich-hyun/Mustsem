'use client'

import type { ChainNetwork } from '@/config/networks'
import { Notice } from '@/components/ui/Notice'
import { useContractStatus } from './useContractStatus'

interface ContractNoticeProps {
  network: ChainNetwork
  /** 확인할 컨트랙트 — 하나라도 비어 있으면 안내한다 */
  contracts: Array<{ label: string; address: string }>
}

/**
 * 도구가 쓰는 컨트랙트가 네트워크에 없을 때만 보이는 안내.
 * 코드가 없는 주소로 보내는 트랜잭션은 자산 손실로 이어질 수 있어 실행 전에 알린다.
 */
export function ContractNotice({ network, contracts }: ContractNoticeProps) {
  const first = contracts[0]
  const second = contracts[1]
  const firstStatus = useContractStatus(network, first?.address)
  const secondStatus = useContractStatus(network, second?.address)

  const missing = [
    firstStatus === 'missing' ? first?.label : null,
    secondStatus === 'missing' ? second?.label : null,
  ].filter((label): label is string => Boolean(label))

  if (missing.length === 0) return null
  return (
    <Notice tone="danger" title="지금은 이 기능을 이용할 수 없습니다" live>
      {network.name} 네트워크에서 {missing.join('·')} 컨트랙트를 찾을 수 없습니다. 컨트랙트가 다시 배포되면 바로 이용할 수
      있으며, 그전에는 자산 보호를 위해 트랜잭션을 보내지 않습니다.
    </Notice>
  )
}
