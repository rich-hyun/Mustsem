/**
 * 체인 네트워크 설정 — RPC·체인 ID가 바뀌면 이 파일만 수정한다.
 * 선택 목록은 Mustsem을 맨 앞에, 나머지는 이름순으로 둔다.
 */
export type NetworkKey = 'mustsem' | 'jkk-tmz' | 'kukminbank' | 'mdpcd' | 'nabizam'

export interface ChainNetwork {
  key: NetworkKey
  name: string
  chainId: number
  rpcUrl: string
  symbol: string
}

export const NETWORKS: readonly ChainNetwork[] = [
  { key: 'mustsem', name: 'Mustsem', chainId: 7601, rpcUrl: 'https://block.mustree.kr', symbol: 'MST' },
  { key: 'jkk-tmz', name: 'JKK-TMZ', chainId: 7707, rpcUrl: 'https://jkk.mst2.site', symbol: 'TMZ' },
  { key: 'kukminbank', name: 'KukminBank', chainId: 1213, rpcUrl: 'https://rpc.mstblock.com', symbol: 'KBB' },
  { key: 'mdpcd', name: 'MDPCD', chainId: 7603, rpcUrl: 'https://mdpcd.mst2.site', symbol: 'MDP' },
  { key: 'nabizam', name: 'NABIZAM', chainId: 7602, rpcUrl: 'https://nbmst.mst2.site', symbol: 'NBZ' },
]

export const DEFAULT_NETWORK_KEY: NetworkKey = 'mustsem'

export function getNetwork(key: NetworkKey): ChainNetwork {
  const network = NETWORKS.find((n) => n.key === key)
  if (!network) throw new Error(`Unknown network: ${key}`)
  return network
}

export function findNetworkByChainId(chainId: number | null | undefined): ChainNetwork | undefined {
  if (chainId == null) return undefined
  return NETWORKS.find((n) => n.chainId === chainId)
}

export function isNetworkKey(value: unknown): value is NetworkKey {
  return typeof value === 'string' && NETWORKS.some((n) => n.key === value)
}

export const toChainHex = (chainId: number) => `0x${chainId.toString(16)}`
