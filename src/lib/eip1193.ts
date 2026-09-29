/**
 * 브라우저 지갑(EIP-1193) 최소 인터페이스와 탐색·네트워크 전환 도우미.
 * ethers에 의존하지 않으므로 모든 페이지의 헤더 지갑 버튼이 가볍게 쓸 수 있다.
 */
import { toChainHex, type ChainNetwork } from '@/config/networks'
import { isUserRejection } from './errors'

type Listener = (...args: never[]) => void

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
  on?(event: string, listener: Listener): void
  removeListener?(event: string, listener: Listener): void
}

interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: Eip1193Provider
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<Eip6963ProviderDetail>
  }
}

/**
 * 설치된 지갑을 찾는다. 여러 지갑이 설치된 환경에서도 충돌하지 않도록
 * EIP-6963 공지를 우선 사용하고(MetaMask 우선), 없으면 window.ethereum으로 되돌아간다.
 */
export function discoverProvider(waitMs = 250): Promise<Eip1193Provider | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    const announced: Eip6963ProviderDetail[] = []
    const onAnnounce = (event: CustomEvent<Eip6963ProviderDetail>) => {
      if (event.detail?.provider) announced.push(event.detail)
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))

    window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      const preferred = announced.find((d) => d.info.rdns === 'io.metamask') ?? announced[0]
      resolve(preferred?.provider ?? window.ethereum ?? null)
    }, waitMs)
  })
}

export async function readAccounts(provider: Eip1193Provider): Promise<string[]> {
  const result = await provider.request({ method: 'eth_accounts' })
  return Array.isArray(result) ? result.filter((a): a is string => typeof a === 'string') : []
}

export async function requestAccounts(provider: Eip1193Provider): Promise<string[]> {
  const result = await provider.request({ method: 'eth_requestAccounts' })
  return Array.isArray(result) ? result.filter((a): a is string => typeof a === 'string') : []
}

export async function readChainId(provider: Eip1193Provider): Promise<number | null> {
  const result = await provider.request({ method: 'eth_chainId' })
  if (typeof result !== 'string') return null
  const parsed = Number.parseInt(result, 16)
  return Number.isFinite(parsed) ? parsed : null
}

/** 지갑을 해당 네트워크로 전환한다. 지갑에 없는 체인이면 등록한 뒤 다시 전환한다. */
export async function switchToNetwork(provider: Eip1193Provider, network: ChainNetwork): Promise<void> {
  const chainId = toChainHex(network.chainId)
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (error) {
    if (isUserRejection(error)) throw error
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: network.name,
          rpcUrls: [network.rpcUrl],
          nativeCurrency: { name: network.symbol, symbol: network.symbol, decimals: 18 },
        },
      ],
    })
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  }
}

/** 지갑에 연결 권한 철회를 요청한다. 지원하지 않는 지갑이면 조용히 넘어간다. */
export async function revokeAccountPermission(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
  } catch {
    /* 미지원 지갑: 사이트 쪽 연결 상태만 해제한다 */
  }
}
