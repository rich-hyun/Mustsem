'use client'

import { useEffect, useState } from 'react'
import type { ChainNetwork } from '@/config/networks'
import { contractStatus, type ContractStatus } from '@/lib/web3'

export type ContractCheck = ContractStatus | 'checking' | 'none'

/** 네트워크의 컨트랙트 주소에 코드가 있는지 확인한다 (주소가 없으면 'none') */
export function useContractStatus(network: ChainNetwork, address: string | null | undefined): ContractCheck {
  const [status, setStatus] = useState<ContractCheck>(address ? 'checking' : 'none')

  useEffect(() => {
    if (!address) {
      setStatus('none')
      return
    }
    let alive = true
    setStatus('checking')
    void contractStatus(network, address).then((result) => {
      if (alive) setStatus(result)
    })
    return () => {
      alive = false
    }
  }, [network, address])

  return status
}
