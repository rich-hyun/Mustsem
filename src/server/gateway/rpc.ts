/**
 * 서버에서 체인을 읽는 JSON-RPC 도우미 (조회 전용, 서명 키 없음).
 *
 * - 요청마다 제한 시간을 두고, 여러 호출은 일괄 요청으로 묶는다.
 * - 같은 조회는 짧은 시간 메모리에 보관해 방문자가 많아도 RPC를 반복해서 부르지 않는다.
 * - RPC 주소·오류 원문은 응답에 싣지 않는다. 실패는 GatewayError 코드로만 알린다.
 */
import { Interface, type InterfaceAbi, type Result } from 'ethers'
import { findNetworkByChainId, type ChainNetwork } from '@/config/networks'

const RPC_TIMEOUT_MS = 8000
const BATCH_SIZE = 100

export type GatewayErrorCode =
  | 'bad_request'
  | 'unknown_network'
  | 'not_found'
  | 'contract_not_deployed'
  | 'rpc_unavailable'
  | 'upstream_unavailable'
  | 'unsupported'

const STATUS: Record<GatewayErrorCode, number> = {
  bad_request: 400,
  unknown_network: 400,
  not_found: 404,
  contract_not_deployed: 404,
  rpc_unavailable: 502,
  upstream_unavailable: 502,
  unsupported: 404,
}

export class GatewayError extends Error {
  readonly status: number
  constructor(readonly code: GatewayErrorCode) {
    super(code)
    this.name = 'GatewayError'
    this.status = STATUS[code]
  }
}

export interface RpcRequest {
  method: string
  params: unknown[]
}

interface RpcReply {
  id: number
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

/** 호출 하나의 결과: 값이거나, 노드가 돌려준 실행 오류(되돌림 등) */
export type RpcOutcome = { ok: true; result: unknown } | { ok: false; reverted: boolean }

async function post(network: ChainNetwork, body: unknown): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(network.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (error) {
    console.error(`[gateway] rpc ${network.key} unreachable:`, error instanceof Error ? error.name : 'error')
    throw new GatewayError('rpc_unavailable')
  }
  if (!response.ok) {
    console.error(`[gateway] rpc ${network.key} status ${response.status}`)
    throw new GatewayError('rpc_unavailable')
  }
  try {
    return await response.json()
  } catch {
    throw new GatewayError('rpc_unavailable')
  }
}

/** 여러 호출을 일괄 요청으로 보낸다 (100개씩). 결과는 요청 순서 그대로 */
export async function rpcBatch(network: ChainNetwork, requests: RpcRequest[]): Promise<RpcOutcome[]> {
  const outcomes: RpcOutcome[] = new Array<RpcOutcome>(requests.length)
  const chunks: Array<{ start: number; items: RpcRequest[] }> = []
  for (let start = 0; start < requests.length; start += BATCH_SIZE) chunks.push({ start, items: requests.slice(start, start + BATCH_SIZE) })
  await Promise.all(
    chunks.map(async ({ start, items }) => {
      const payload = items.map((item, index) => ({ jsonrpc: '2.0', id: index, method: item.method, params: item.params }))
      const replies = await post(network, payload)
      if (!Array.isArray(replies)) throw new GatewayError('rpc_unavailable')
      for (const reply of replies as RpcReply[]) {
        if (typeof reply?.id !== 'number' || reply.id < 0 || reply.id >= items.length) continue
        outcomes[start + reply.id] = reply.error
          ? // -32000/3: 실행 되돌림. 그 밖(메서드 없음 등)은 노드 문제로 본다
            { ok: false, reverted: reply.error.code === 3 || reply.error.code === -32000 || /revert/i.test(reply.error.message ?? '') }
          : { ok: true, result: reply.result }
      }
      for (let index = 0; index < items.length; index += 1) outcomes[start + index] ??= { ok: false, reverted: false }
    }),
  )
  return outcomes
}

export async function rpc(network: ChainNetwork, method: string, params: unknown[] = []): Promise<unknown> {
  const [outcome] = await rpcBatch(network, [{ method, params }])
  if (!outcome?.ok) throw new GatewayError('rpc_unavailable')
  return outcome.result
}

export const toHex = (value: number | bigint) => `0x${value.toString(16)}`
export const fromHex = (value: unknown): number => (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) ? Number.parseInt(value, 16) : Number.NaN)

/* ── 컨트랙트 읽기 ─────────────────────────────────────────────── */

export interface ContractRead {
  address: string
  abi: InterfaceAbi
  fn: string
  args?: unknown[]
}

/** 읽기 결과: 값(Result) 또는 되돌림/실패(null) */
export async function readContracts(network: ChainNetwork, reads: ContractRead[]): Promise<Array<Result | null>> {
  const interfaces = reads.map((read) => new Interface(read.abi))
  const outcomes = await rpcBatch(
    network,
    reads.map((read, index) => ({
      method: 'eth_call',
      params: [{ to: read.address, data: interfaces[index]?.encodeFunctionData(read.fn, read.args ?? []) }, 'latest'],
    })),
  )
  return outcomes.map((outcome, index) => {
    const read = reads[index]
    const iface = interfaces[index]
    if (!outcome.ok || !read || !iface || typeof outcome.result !== 'string' || outcome.result === '0x') return null
    try {
      return iface.decodeFunctionResult(read.fn, outcome.result)
    } catch {
      return null
    }
  })
}

/** 주소에 컨트랙트 코드가 있는지. 없으면 contract_not_deployed */
export async function requireCode(network: ChainNetwork, address: string | null): Promise<string> {
  if (!address) throw new GatewayError('contract_not_deployed')
  const code = await cached(`code:${network.chainId}:${address.toLowerCase()}`, 60_000, () => rpc(network, 'eth_getCode', [address, 'latest']))
  if (typeof code !== 'string' || code === '0x') throw new GatewayError('contract_not_deployed')
  return address
}

/* ── 짧은 메모리 보관 ──────────────────────────────────────────── */

const store = new Map<string, { at: number; value: Promise<unknown> }>()
const STORE_MAX = 500

/** 같은 key의 조회를 ttl 동안 재사용한다 (진행 중인 조회도 함께 쓴다). 실패한 조회는 보관하지 않는다 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>
  if (store.size >= STORE_MAX) {
    const cutoff = Date.now() - 60_000
    for (const [name, entry] of store) if (entry.at < cutoff) store.delete(name)
    if (store.size >= STORE_MAX) store.clear()
  }
  const value = load()
  store.set(key, { at: Date.now(), value })
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key)
  })
  return value
}

/* ── 입력 검증 ─────────────────────────────────────────────────── */

export function networkOf(params: URLSearchParams): ChainNetwork {
  const raw = params.get('chainId')
  if (raw === null || raw === '') {
    const fallback = findNetworkByChainId(7601)
    if (!fallback) throw new GatewayError('unknown_network')
    return fallback
  }
  if (!/^\d{1,10}$/.test(raw)) throw new GatewayError('bad_request')
  const network = findNetworkByChainId(Number(raw))
  if (!network) throw new GatewayError('unknown_network')
  return network
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const HASH32 = /^0x[0-9a-fA-F]{64}$/

/** 주소 파라미터. required가 아니고 비어 있으면 null */
export function addressParam(params: URLSearchParams, name: string, required: true): string
export function addressParam(params: URLSearchParams, name: string, required?: false): string | null
export function addressParam(params: URLSearchParams, name: string, required = false): string | null {
  const value = params.get(name)?.trim() ?? ''
  if (!value) {
    if (required) throw new GatewayError('bad_request')
    return null
  }
  if (!ADDRESS.test(value)) throw new GatewayError('bad_request')
  return value
}

export function hashParam(params: URLSearchParams, name: string): string {
  const value = params.get(name)?.trim() ?? ''
  if (!HASH32.test(value)) throw new GatewayError('bad_request')
  return value
}

/** 0 이상의 정수 (토큰 ID, 라운드 등). required가 아니고 비어 있으면 null */
export function uintParam(params: URLSearchParams, name: string, required: true): bigint
export function uintParam(params: URLSearchParams, name: string, required?: false): bigint | null
export function uintParam(params: URLSearchParams, name: string, required = false): bigint | null {
  const value = params.get(name)?.trim() ?? ''
  if (!value) {
    if (required) throw new GatewayError('bad_request')
    return null
  }
  if (!/^\d{1,78}$/.test(value)) throw new GatewayError('bad_request')
  return BigInt(value)
}

export function textParam(params: URLSearchParams, name: string, pattern: RegExp): string {
  const value = params.get(name)?.trim() ?? ''
  if (!pattern.test(value)) throw new GatewayError('bad_request')
  return value
}
