/**
 * 이상거래 탐지: 실제 체인의 최근 거래를 읽어 규칙(src/lib/anomaly.ts)을 적용한다. 조회 전용.
 *
 * 읽는 것
 *   - 코인 전송: 최근 N개 블록 중 거래가 있는 블록의 거래 (값이 0인 컨트랙트 호출은 제외)
 *   - 토큰 전송: 최근 토큰 조회 구간의 Transfer 이벤트 (ERC-20은 수량, NFT는 1건으로 본다)
 * 대응(지갑 동결·블랙리스트)은 "권고"로만 돌려준다. 온체인 조치는 ComplianceGuard 컨트랙트 권한이 있어야 하며 여기서 실행하지 않는다.
 */
import { formatUnits } from 'ethers'
import { COMPLIANCE_GUARD_CONTRACTS, ERC20_READ_ABI } from '@/config/contracts'
import type { ChainNetwork } from '@/config/networks'
import { createDetector, type RiskAction, type RiskLevel } from '@/lib/anomaly'
import { GatewayError, cached, fromHex, readContracts, rpc, rpcBatch, toHex } from './rpc'

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const SCAN_BLOCKS = { min: 100, max: 5000, fallback: 2000 } as const
/** 토큰 Transfer 이벤트를 찾는 구간 (블록). 거래가 드문 체인이라 코인 전송보다 넓게 본다 */
const LOG_SPAN = 100_000
const MAX_EVENTS = 300
const MAX_ITEMS = 100

type Kind = 'coin' | 'token' | 'nft'

interface ChainEvent {
  kind: Kind
  block: number
  index: number
  hash: string
  from: string
  to: string
  amount: number
  amountText: string
  symbol: string
  contract: string | null
  ts: number
}

export interface ScanItem {
  kind: Kind
  block: number
  hash: string
  from: string
  to: string
  amount: string
  symbol: string
  contract: string | null
  /** ISO 시각 */
  at: string
  score: number
  level: RiskLevel
  reasons: string[]
  /** 권고 대응 (실행하지 않음) */
  recommended: RiskAction[]
}

export interface ScanResult {
  network: { key: string; name: string; chainId: number; symbol: string }
  head: number
  headAt: string
  /** 코인 전송을 본 블록 구간 */
  blocks: { from: number; to: number; withTransactions: number }
  /** 토큰 전송(Transfer 이벤트)을 본 블록 구간 */
  logs: { from: number; to: number }
  counts: { scanned: number; coin: number; token: number; nft: number; warn: number; critical: number }
  baselineReady: boolean
  /** 동결·블랙리스트를 온체인에 반영할 컨트랙트가 이 네트워크에 배포돼 있는지 */
  guardDeployed: boolean
  /** 최신순 */
  items: ScanItem[]
  scannedAt: string
}

interface RawTx {
  hash?: string
  from?: string
  to?: string | null
  value?: string
  transactionIndex?: string
}

interface RawBlock {
  number?: string
  timestamp?: string
  transactions?: RawTx[]
}

interface RawLog {
  address?: string
  topics?: string[]
  data?: string
  blockNumber?: string
  transactionHash?: string
  logIndex?: string
}

const topicAddress = (topic: string | undefined) => (topic && topic.length === 66 ? `0x${topic.slice(26)}` : '')
const short = (value: number) => (Number.isFinite(value) ? value : 0)

async function scan(network: ChainNetwork, blocks: number): Promise<ScanResult> {
  const head = fromHex(await rpc(network, 'eth_blockNumber'))
  if (!Number.isFinite(head)) throw new GatewayError('rpc_unavailable')
  const fromBlock = Math.max(0, head - blocks + 1)
  const logFrom = Math.max(0, head - LOG_SPAN + 1)

  // 1) 거래가 있는 블록만 골라낸다 (빈 블록 본문을 내려받지 않는다)
  const numbers = Array.from({ length: head - fromBlock + 1 }, (_, i) => fromBlock + i)
  const [countOutcomes, logsOutcome, headBlock] = await Promise.all([
    rpcBatch(
      network,
      numbers.map((number) => ({ method: 'eth_getBlockTransactionCountByNumber', params: [toHex(number)] })),
    ),
    rpcBatch(network, [{ method: 'eth_getLogs', params: [{ fromBlock: toHex(logFrom), toBlock: toHex(head), topics: [TRANSFER_TOPIC] }] }]),
    rpc(network, 'eth_getBlockByNumber', [toHex(head), false]) as Promise<RawBlock | null>,
  ])
  const busy = numbers.filter((_, i) => {
    const outcome = countOutcomes[i]
    return outcome?.ok && fromHex(outcome.result) > 0
  })

  const logs = (logsOutcome[0]?.ok && Array.isArray(logsOutcome[0].result) ? (logsOutcome[0].result as RawLog[]) : []).slice(-MAX_EVENTS)
  const logBlocks = [...new Set(logs.map((log) => fromHex(log.blockNumber)).filter(Number.isFinite))]

  // 2) 거래가 있는 블록 본문과, 로그가 속한 블록의 시각
  const needFull = busy.slice(-MAX_EVENTS)
  const needTime = logBlocks.filter((number) => !needFull.includes(number))
  const blockOutcomes = await rpcBatch(network, [
    ...needFull.map((number) => ({ method: 'eth_getBlockByNumber', params: [toHex(number), true] })),
    ...needTime.map((number) => ({ method: 'eth_getBlockByNumber', params: [toHex(number), false] })),
  ])
  const timeOf = new Map<number, number>()
  const events: ChainEvent[] = []
  blockOutcomes.forEach((outcome, i) => {
    if (!outcome.ok || !outcome.result) return
    const block = outcome.result as RawBlock
    const number = fromHex(block.number)
    const ts = fromHex(block.timestamp) * 1000
    if (!Number.isFinite(number) || !Number.isFinite(ts)) return
    timeOf.set(number, ts)
    if (i >= needFull.length) return
    for (const tx of block.transactions ?? []) {
      let value: bigint
      try {
        value = BigInt(tx.value ?? '0x0')
      } catch {
        continue
      }
      // 값이 0이면 컨트랙트 호출이다. 토큰 이동은 Transfer 이벤트에서 따로 잡는다
      if (value === 0n || !tx.from || !tx.to || !tx.hash) continue
      const text = formatUnits(value, 18)
      events.push({
        kind: 'coin',
        block: number,
        index: short(fromHex(tx.transactionIndex)),
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to.toLowerCase(),
        amount: Number(text),
        amountText: text,
        symbol: network.symbol,
        contract: null,
        ts,
      })
    }
  })

  // 3) 토큰 전송: 컨트랙트별 소수 자릿수와 기호
  const contracts = [...new Set(logs.map((log) => (log.address ?? '').toLowerCase()).filter(Boolean))]
  const meta = new Map<string, { decimals: number; symbol: string }>()
  if (contracts.length > 0) {
    const reads = await readContracts(
      network,
      contracts.flatMap((address) => [
        { address, abi: ERC20_READ_ABI, fn: 'decimals' },
        { address, abi: ERC20_READ_ABI, fn: 'symbol' },
      ]),
    )
    contracts.forEach((address, i) => {
      const decimals = reads[i * 2]?.[0]
      const symbol = reads[i * 2 + 1]?.[0]
      meta.set(address, {
        decimals: typeof decimals === 'bigint' && decimals <= 36n ? Number(decimals) : 18,
        symbol: typeof symbol === 'string' && symbol.length <= 12 ? symbol : 'TOKEN',
      })
    })
  }
  for (const log of logs) {
    const number = fromHex(log.blockNumber)
    const ts = timeOf.get(number)
    const address = (log.address ?? '').toLowerCase()
    const topics = log.topics ?? []
    if (ts === undefined || !address || !log.transactionHash || topics.length < 3) continue
    const from = topicAddress(topics[1])
    const to = topicAddress(topics[2])
    const info = meta.get(address) ?? { decimals: 18, symbol: 'TOKEN' }
    const isNft = topics.length === 4
    let amountText = '1'
    if (!isNft) {
      try {
        amountText = formatUnits(BigInt(log.data && log.data !== '0x' ? log.data : '0x0'), info.decimals)
      } catch {
        continue
      }
    }
    events.push({
      kind: isNft ? 'nft' : 'token',
      block: number,
      index: 10_000 + short(fromHex(log.logIndex)),
      hash: log.transactionHash,
      from,
      to,
      amount: Number(amountText),
      amountText,
      symbol: info.symbol,
      contract: address,
      ts,
    })
  }

  // 4) 시간순으로 규칙 적용. 자산 종류가 다르면 금액 기준도 달라야 하므로 탐지기를 자산별로 둔다
  events.sort((a, b) => a.block - b.block || a.index - b.index)
  const detectors = new Map<string, ReturnType<typeof createDetector>>()
  const items: ScanItem[] = []
  const counts = { scanned: events.length, coin: 0, token: 0, nft: 0, warn: 0, critical: 0 }
  let baselineReady = false
  for (const event of events) {
    const key = event.contract ?? 'coin'
    let detector = detectors.get(key)
    if (!detector) {
      detector = createDetector()
      detectors.set(key, detector)
    }
    const result = detector.evaluate({ from: event.from, to: event.to, amount: event.amount, ts: event.ts })
    baselineReady ||= detector.baselineReady()
    counts[event.kind] += 1
    if (result.level === 'warn') counts.warn += 1
    if (result.level === 'critical' || result.level === 'blocked') counts.critical += 1
    items.push({
      kind: event.kind,
      block: event.block,
      hash: event.hash,
      from: event.from,
      to: event.to,
      amount: event.amountText,
      symbol: event.symbol,
      contract: event.contract,
      at: new Date(event.ts).toISOString(),
      score: result.score,
      level: result.level,
      reasons: result.reasons,
      recommended: result.actions,
    })
  }

  let guardDeployed = false
  const guard = COMPLIANCE_GUARD_CONTRACTS[network.key]
  if (guard) {
    const code = await rpc(network, 'eth_getCode', [guard, 'latest']).catch(() => '0x')
    guardDeployed = typeof code === 'string' && code !== '0x'
  }

  const headTs = fromHex(headBlock?.timestamp) * 1000
  return {
    network: { key: network.key, name: network.name, chainId: network.chainId, symbol: network.symbol },
    head,
    headAt: Number.isFinite(headTs) ? new Date(headTs).toISOString() : new Date().toISOString(),
    blocks: { from: fromBlock, to: head, withTransactions: busy.length },
    logs: { from: logFrom, to: head },
    counts,
    baselineReady,
    guardDeployed,
    items: items.reverse().slice(0, MAX_ITEMS),
    scannedAt: new Date().toISOString(),
  }
}

/** 같은 네트워크·구간의 조회는 20초 동안 재사용한다 */
export function scanAnomalies(network: ChainNetwork, blocks: number): Promise<ScanResult> {
  return cached(`anomaly:${network.chainId}:${blocks}`, 20_000, () => scan(network, blocks))
}
