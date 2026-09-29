'use client'

/**
 * 사이트 전역 지갑 상태.
 * - 헤더에서 한 번 연결하면 페이지를 옮겨도 유지되고, 새로고침 시 이전 연결을 조용히 복원한다.
 * - targetNetwork: NFT·SBT·RWA처럼 네트워크를 고르는 도구의 대상 네트워크.
 *   지갑이 알려진 네트워크로 바뀌면 함께 따라간다.
 * - activity: 이 세션에서 보낸 트랜잭션 기록(최근 8건).
 * ethers에 의존하지 않는다 — 서명이 필요한 페이지만 ethers를 불러온다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DEFAULT_NETWORK_KEY,
  findNetworkByChainId,
  getNetwork,
  isNetworkKey,
  type ChainNetwork,
  type NetworkKey,
} from '@/config/networks'
import {
  discoverProvider,
  readAccounts,
  readChainId,
  requestAccounts,
  revokeAccountPermission,
  switchToNetwork,
  type Eip1193Provider,
} from '@/lib/eip1193'
import { describeError, isUserRejection, logDevError } from '@/lib/errors'

export type WalletStatus = 'detecting' | 'unavailable' | 'disconnected' | 'connecting' | 'connected'

export interface WalletActivity {
  id: string
  label: string
  hash: string
  chainId: number
  status: 'pending' | 'confirmed' | 'failed'
  at: number
}

interface WalletContextValue {
  status: WalletStatus
  provider: Eip1193Provider | null
  account: string | null
  chainId: number | null
  /** 지갑이 현재 연결된 체인이 사이트가 아는 네트워크일 때 */
  network: ChainNetwork | undefined
  targetNetwork: ChainNetwork
  /** switchWallet: 연결된 지갑도 함께 전환 요청 (기본 true — 키보드 탐색 중에는 false) */
  setTargetNetwork: (key: NetworkKey, options?: { switchWallet?: boolean }) => Promise<void>
  /** 탐색이 끝난 지갑 프로바이더 (상태 갱신을 기다리지 않고 바로 쓸 때) */
  getProvider: () => Promise<Eip1193Provider | null>
  /** silent: 헤더 안내 문구를 띄우지 않는다 (호출한 화면이 직접 안내할 때) */
  connect: (options?: { silent?: boolean }) => Promise<string | null>
  disconnect: () => Promise<void>
  switchNetwork: (network: ChainNetwork, options?: { silent?: boolean }) => Promise<boolean>
  /** 지갑 수준의 안내 문구(연결 거절 등) */
  notice: string | null
  clearNotice: () => void
  activity: WalletActivity[]
  addActivity: (entry: Omit<WalletActivity, 'id' | 'at'>) => string
  updateActivity: (id: string, status: WalletActivity['status']) => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const CONNECTED_FLAG = 'mustsem.wallet.connected'
const TARGET_KEY = 'mustsem.wallet.target'
const MAX_ACTIVITY = 8

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* 저장소를 쓸 수 없는 환경(비공개 창 등)에서는 기억하지 않는다 */
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>('detecting')
  const [provider, setProvider] = useState<Eip1193Provider | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [targetKey, setTargetKey] = useState<NetworkKey>(DEFAULT_NETWORK_KEY)
  const [notice, setNotice] = useState<string | null>(null)
  const [activity, setActivity] = useState<WalletActivity[]>([])
  const discovery = useRef<Promise<Eip1193Provider | null> | null>(null)

  const followChain = useCallback((nextChainId: number | null) => {
    setChainId(nextChainId)
    const known = findNetworkByChainId(nextChainId)
    if (known) {
      setTargetKey(known.key)
      writeStorage(TARGET_KEY, known.key)
    }
  }, [])

  // 지갑 탐색 + 이전 연결 복원 + 이벤트 구독
  useEffect(() => {
    let cancelled = false
    const storedTarget = readStorage(TARGET_KEY)
    if (isNetworkKey(storedTarget)) setTargetKey(storedTarget)

    discovery.current ??= discoverProvider()
    let detach: (() => void) | undefined

    discovery.current.then(async (found) => {
      if (cancelled) return
      if (!found) {
        setStatus('unavailable')
        return
      }
      setProvider(found)

      const onAccountsChanged = (accounts: string[]) => {
        const next = accounts[0] ?? null
        setAccount(next)
        setStatus(next ? 'connected' : 'disconnected')
        writeStorage(CONNECTED_FLAG, next ? '1' : null)
      }
      const onChainChanged = (hex: string) => {
        const parsed = Number.parseInt(hex, 16)
        followChain(Number.isFinite(parsed) ? parsed : null)
      }
      found.on?.('accountsChanged', onAccountsChanged)
      found.on?.('chainChanged', onChainChanged)
      detach = () => {
        found.removeListener?.('accountsChanged', onAccountsChanged)
        found.removeListener?.('chainChanged', onChainChanged)
      }

      try {
        const [currentChain, accounts] = await Promise.all([
          readChainId(found),
          readStorage(CONNECTED_FLAG) === '1' ? readAccounts(found) : Promise.resolve([]),
        ])
        if (cancelled) return
        followChain(currentChain)
        const restored = accounts[0] ?? null
        setAccount(restored)
        setStatus(restored ? 'connected' : 'disconnected')
        if (!restored) writeStorage(CONNECTED_FLAG, null)
      } catch (error) {
        logDevError('wallet:restore', error)
        if (!cancelled) setStatus('disconnected')
      }
    })

    return () => {
      cancelled = true
      detach?.()
    }
  }, [followChain])

  const getProvider = useCallback(() => (discovery.current ??= discoverProvider()), [])

  const connect = useCallback(async ({ silent = false }: { silent?: boolean } = {}): Promise<string | null> => {
    setNotice(null)
    const found = await getProvider()
    if (!found) {
      setStatus('unavailable')
      if (!silent) setNotice('MetaMask 같은 브라우저 지갑을 설치한 뒤 다시 시도하세요.')
      return null
    }
    setStatus('connecting')
    try {
      const accounts = await requestAccounts(found)
      const next = accounts[0] ?? null
      followChain(await readChainId(found))
      setAccount(next)
      setStatus(next ? 'connected' : 'disconnected')
      writeStorage(CONNECTED_FLAG, next ? '1' : null)
      return next
    } catch (error) {
      logDevError('wallet:connect', error)
      setStatus('disconnected')
      if (!silent) setNotice(isUserRejection(error) ? '지갑 연결을 취소했습니다.' : describeError(error))
      return null
    }
  }, [getProvider, followChain])

  const disconnect = useCallback(async () => {
    if (provider) await revokeAccountPermission(provider)
    setAccount(null)
    setStatus(provider ? 'disconnected' : 'unavailable')
    writeStorage(CONNECTED_FLAG, null)
  }, [provider])

  const switchNetwork = useCallback(
    async (network: ChainNetwork, { silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
      setNotice(null)
      const found = await getProvider()
      if (!found) {
        if (!silent) setNotice('MetaMask 같은 브라우저 지갑을 설치한 뒤 다시 시도하세요.')
        return false
      }
      try {
        await switchToNetwork(found, network)
        followChain(await readChainId(found))
        return true
      } catch (error) {
        logDevError('wallet:switch', error)
        if (!silent) {
          setNotice(isUserRejection(error) ? '네트워크 전환을 취소했습니다.' : '네트워크를 전환하지 못했습니다. 지갑 상태를 확인하세요.')
        }
        return false
      }
    },
    [getProvider, followChain],
  )

  const setTargetNetwork = useCallback(
    async (key: NetworkKey, { switchWallet = true }: { switchWallet?: boolean } = {}) => {
      setTargetKey(key)
      writeStorage(TARGET_KEY, key)
      const network = getNetwork(key)
      // 선택기가 불일치를 직접 안내하므로 헤더 알림은 띄우지 않는다
      if (switchWallet && status === 'connected' && chainId !== network.chainId) {
        await switchNetwork(network, { silent: true })
      }
    },
    [status, chainId, switchNetwork],
  )

  const clearNotice = useCallback(() => setNotice(null), [])

  const addActivity = useCallback((entry: Omit<WalletActivity, 'id' | 'at'>) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    setActivity((list) => [{ ...entry, id, at: Date.now() }, ...list].slice(0, MAX_ACTIVITY))
    return id
  }, [])

  const updateActivity = useCallback((id: string, nextStatus: WalletActivity['status']) => {
    setActivity((list) => list.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)))
  }, [])

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      provider,
      account,
      chainId,
      network: findNetworkByChainId(chainId),
      targetNetwork: getNetwork(targetKey),
      setTargetNetwork,
      getProvider,
      connect,
      disconnect,
      switchNetwork,
      notice,
      clearNotice,
      activity,
      addActivity,
      updateActivity,
    }),
    [status, provider, account, chainId, targetKey, setTargetNetwork, getProvider, connect, disconnect, switchNetwork, notice, clearNotice, activity, addActivity, updateActivity],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used inside <WalletProvider>')
  return context
}
