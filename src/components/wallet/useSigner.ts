'use client'

import type { JsonRpcSigner } from 'ethers'
import { useCallback, useEffect, useRef } from 'react'
import type { ChainNetwork } from '@/config/networks'
import { readChainId } from '@/lib/eip1193'
import { UserFacingError } from '@/lib/errors'
import { walletSigner } from '@/lib/web3'
import { useWallet } from './WalletProvider'

/**
 * 트랜잭션 직전에 부른다. 필요한 만큼만 지갑에 요청한다:
 * 연결 안 됨 → 연결 요청, 다른 체인 → 전환 요청, 그다음 서명자를 돌려준다.
 */
export function useSigner() {
  const wallet = useWallet()
  const latest = useRef(wallet)
  useEffect(() => {
    latest.current = wallet
  }, [wallet])

  return useCallback(async (network: ChainNetwork): Promise<JsonRpcSigner> => {
    const current = latest.current
    const provider = await current.getProvider()
    if (!provider) throw new UserFacingError('MetaMask 같은 브라우저 지갑이 필요합니다.')

    const account = current.account ?? (await current.connect({ silent: true }))
    if (!account) throw new UserFacingError('지갑을 연결해야 진행할 수 있습니다.')

    if ((await readChainId(provider)) !== network.chainId) {
      const switched = await current.switchNetwork(network, { silent: true })
      if (!switched) throw new UserFacingError(`지갑을 ${network.name} 네트워크로 전환해야 진행할 수 있습니다.`)
    }
    return walletSigner(provider, account)
  }, [])
}
