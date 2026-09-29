/**
 * ethers 기반 읽기·서명 도우미 — 지갑 도구 페이지에서만 import한다(라우트 단위로 분리됨).
 */
import { BrowserProvider, FetchRequest, JsonRpcProvider, type JsonRpcSigner, type Provider } from 'ethers'
import type { ChainNetwork } from '@/config/networks'
import type { Eip1193Provider } from './eip1193'
import { UserFacingError } from './errors'

const RPC_TIMEOUT_MS = 8_000
const rpcProviders = new Map<number, JsonRpcProvider>()

/**
 * 지갑 없이 체인을 직접 읽는 공용 RPC 프로바이더.
 * 네트워크 자동 감지를 끄고(staticNetwork) 응답 제한 시간을 두어,
 * RPC가 멈춰 있어도 무한 재시도 없이 TIMEOUT 오류로 끝나게 한다.
 */
export function rpcProvider(network: ChainNetwork): JsonRpcProvider {
  let provider = rpcProviders.get(network.chainId)
  if (!provider) {
    const request = new FetchRequest(network.rpcUrl)
    request.timeout = RPC_TIMEOUT_MS
    provider = new JsonRpcProvider(request, network.chainId, { staticNetwork: true, batchMaxCount: 1 })
    rpcProviders.set(network.chainId, provider)
  }
  return provider
}

/**
 * 읽기용 프로바이더. 지갑이 같은 체인에 있으면 지갑 경로를 쓰고(지갑의 RPC 설정을 따름),
 * 아니면 공용 RPC로 직접 읽는다.
 */
export function readProvider(
  network: ChainNetwork,
  wallet: { provider: Eip1193Provider | null; chainId: number | null },
): Provider {
  if (wallet.provider && wallet.chainId === network.chainId) {
    return new BrowserProvider(wallet.provider, network.chainId)
  }
  return rpcProvider(network)
}

/** 서명자 — 체인 전환 이후에도 안전하도록 매번 새 BrowserProvider로 만든다 */
export async function walletSigner(provider: Eip1193Provider, account: string): Promise<JsonRpcSigner> {
  return new BrowserProvider(provider, 'any').getSigner(account)
}

/** 일정 시간 안에 끝나지 않는 읽기 요청을 TIMEOUT 오류로 정리한다 */
export function withTimeout<T>(promise: Promise<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export type ContractStatus = 'present' | 'missing' | 'unknown'

const CODE_CACHE_MS = 60_000
const codeCache = new Map<string, { at: number; present: boolean }>()

/**
 * 해당 네트워크의 주소에 컨트랙트 코드가 있는지 공용 RPC로 확인한다.
 * 'missing'은 RPC가 빈 코드(0x)를 돌려준 확정 상태, 'unknown'은 RPC 무응답 등으로 확인하지 못한 상태.
 */
export async function contractStatus(network: ChainNetwork, address: string): Promise<ContractStatus> {
  const key = `${network.chainId}:${address.toLowerCase()}`
  const cached = codeCache.get(key)
  if (cached && Date.now() - cached.at < CODE_CACHE_MS) return cached.present ? 'present' : 'missing'
  try {
    const code = await withTimeout(rpcProvider(network).getCode(address))
    const present = code !== '0x'
    codeCache.set(key, { at: Date.now(), present })
    return present ? 'present' : 'missing'
  } catch {
    return 'unknown'
  }
}

/**
 * 쓰기 트랜잭션 직전 확인. 코드가 없는 주소로 보내면 컨트랙트 호출이 아니라
 * 단순 송금이 되어 자산이 그 주소로 넘어가므로, 확정적으로 비어 있을 때 막는다.
 */
export async function assertDeployed(network: ChainNetwork, address: string, label: string): Promise<void> {
  if ((await contractStatus(network, address)) === 'missing') {
    throw new UserFacingError(
      `지금 ${network.name} 네트워크에서 ${label} 컨트랙트를 찾을 수 없어 실행하지 않았습니다. 컨트랙트 배포 상태를 확인한 뒤 다시 시도하세요.`,
    )
  }
}
