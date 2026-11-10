/**
 * /api/v1 조회 API 처리기. 경로("chain/status")별로 체인을 읽어 결과를 만든다.
 *
 * 모두 조회 전용이다(서명 키 없음). 발행·전송 같은 쓰기 API는 여기 없고 카탈로그에 명세로만 있다.
 * 확장 컨트랙트(오라클·DID·브릿지 게이트웨이 등)는 배포 주소가 설정되기 전까지 contract_not_deployed로 답한다.
 */
import { formatUnits, keccak256, toUtf8Bytes } from 'ethers'
import {
  BRIDGE,
  BRIDGE_GATEWAY_ABI,
  BRIDGE_GATEWAY_CONTRACTS,
  DID_REGISTRY_ABI,
  DID_REGISTRY_CONTRACTS,
  ERC20_READ_ABI,
  NFT_ABI,
  NFT_CONTRACTS,
  PRICE_ORACLE_ABI,
  PRICE_ORACLE_CONTRACTS,
  RWA_ABI,
  RWA_CONTRACTS,
  RWA_VAULT_ABI,
  SBT_ABI,
  SBT_CONTRACTS,
} from '@/config/contracts'
import { getNetwork, type ChainNetwork } from '@/config/networks'
import { IPFS_GATEWAY } from '@/config/site'
import { loadSeries } from '@/server/market-data'
import { SCAN_BLOCKS, scanAnomalies } from './anomaly'
import { GatewayError, addressParam, cached, fromHex, hashParam, networkOf, readContracts, requireCode, rpcBatch, textParam, toHex, uintParam } from './rpc'

type Handler = (params: URLSearchParams) => Promise<unknown>

const networkInfo = (network: ChainNetwork) => ({ name: network.name, chainId: network.chainId, symbol: network.symbol })
const iso = (seconds: bigint | number) => new Date(Number(seconds) * 1000).toISOString()
const PAIR = /^[A-Z0-9]{2,10}\/[A-Z0-9]{2,10}$/
const BALANCE_ABI = ['function balanceOf(address owner) view returns (uint256)'] as const

/* ── 분석·체인 운영 ─────────────────────────────────────────────── */

const chainStatus: Handler = async (params) => {
  const network = networkOf(params)
  return cached(`status:${network.chainId}`, 5000, async () => {
    const SPAN = 100
    const [head, gas, peers] = await rpcBatch(network, [
      { method: 'eth_blockNumber', params: [] },
      { method: 'eth_gasPrice', params: [] },
      { method: 'net_peerCount', params: [] },
    ])
    const number = head?.ok ? fromHex(head.result) : Number.NaN
    if (!Number.isFinite(number)) throw new GatewayError('rpc_unavailable')
    const first = Math.max(0, number - SPAN)
    const outcomes = await rpcBatch(network, [
      { method: 'eth_getBlockByNumber', params: [toHex(number), false] },
      { method: 'eth_getBlockByNumber', params: [toHex(first), false] },
      ...Array.from({ length: number - first }, (_, i) => ({ method: 'eth_getBlockTransactionCountByNumber', params: [toHex(first + 1 + i)] })),
    ])
    const latest = outcomes[0]?.ok ? (outcomes[0].result as { timestamp?: string; gasLimit?: string; gasUsed?: string } | null) : null
    const oldest = outcomes[1]?.ok ? (outcomes[1].result as { timestamp?: string } | null) : null
    const latestTs = fromHex(latest?.timestamp)
    const oldestTs = fromHex(oldest?.timestamp)
    const seconds = latestTs - oldestTs
    const transactions = outcomes.slice(2).reduce((sum, outcome) => sum + (outcome.ok ? fromHex(outcome.result) || 0 : 0), 0)
    const gasPrice = gas?.ok && typeof gas.result === 'string' ? BigInt(gas.result) : null
    return {
      network: networkInfo(network),
      blockNumber: number,
      blockTime: Number.isFinite(latestTs) ? iso(latestTs) : null,
      /** 마지막 블록이 만들어진 뒤 지난 시간(초). 크면 체인이 멈춘 것이다 */
      secondsSinceLastBlock: Number.isFinite(latestTs) ? Math.max(0, Math.round(Date.now() / 1000 - latestTs)) : null,
      averageBlockSeconds: seconds > 0 ? Number((seconds / (number - first)).toFixed(2)) : null,
      recent: { blocks: number - first, transactions, tps: seconds > 0 ? Number((transactions / seconds).toFixed(4)) : null },
      gasPriceGwei: gasPrice === null ? null : formatUnits(gasPrice, 'gwei'),
      gasLimit: latest?.gasLimit ? String(fromHex(latest.gasLimit)) : null,
      peers: peers?.ok ? fromHex(peers.result) : null,
    }
  })
}

const anomalyScan: Handler = async (params) => {
  const network = networkOf(params)
  const requested = uintParam(params, 'blocks')
  const blocks = requested === null ? SCAN_BLOCKS.fallback : Number(requested)
  if (!Number.isInteger(blocks) || blocks < SCAN_BLOCKS.min || blocks > SCAN_BLOCKS.max) throw new GatewayError('bad_request')
  return scanAnomalies(network, blocks)
}

/* ── 토큰 ───────────────────────────────────────────────────────── */

const tokenStatus: Handler = async (params) => {
  const network = networkOf(params)
  const contract = await requireCode(network, addressParam(params, 'contract', true))
  const [name, symbol, decimals, supply] = await readContracts(
    network,
    (['name', 'symbol', 'decimals', 'totalSupply'] as const).map((fn) => ({ address: contract, abi: ERC20_READ_ABI, fn })),
  )
  if (!supply) throw new GatewayError('unsupported')
  const digits = typeof decimals?.[0] === 'bigint' ? Number(decimals[0]) : null
  const total = supply[0] as bigint
  return {
    network: networkInfo(network),
    contract,
    name: typeof name?.[0] === 'string' ? name[0] : null,
    symbol: typeof symbol?.[0] === 'string' ? symbol[0] : null,
    /** null이면 소수 자릿수가 없는 토큰(NFT 등)이다 */
    decimals: digits,
    totalSupply: digits === null ? total.toString() : formatUnits(total, digits),
    totalSupplyRaw: total.toString(),
  }
}

const nftLookup: Handler = async (params) => {
  const network = networkOf(params)
  const requested = addressParam(params, 'contract')
  const tokenId = uintParam(params, 'tokenId')
  const owner = addressParam(params, 'owner')
  if (tokenId === null && owner === null) throw new GatewayError('bad_request')
  const contract = await requireCode(network, requested ?? NFT_CONTRACTS[network.key])
  const [ownerOf, info, balance] = await readContracts(network, [
    { address: contract, abi: NFT_ABI, fn: 'ownerOf', args: [tokenId ?? 0n] },
    { address: contract, abi: NFT_ABI, fn: 'nftInfo', args: [tokenId ?? 0n] },
    { address: contract, abi: BALANCE_ABI, fn: 'balanceOf', args: [owner ?? '0x0000000000000000000000000000000000000001'] },
  ])
  if (tokenId !== null && !ownerOf) throw new GatewayError('not_found')
  return {
    network: networkInfo(network),
    contract,
    token:
      tokenId === null
        ? null
        : {
            tokenId: tokenId.toString(),
            owner: String(ownerOf?.[0] ?? ''),
            label: typeof info?.[0] === 'string' ? info[0] : null,
            metadata: typeof info?.[1] === 'string' ? info[1] : null,
          },
    holder: owner === null ? null : { address: owner, balance: balance ? String(balance[0]) : null },
  }
}

const sbtVerify: Handler = async (params) => {
  const network = networkOf(params)
  const requested = addressParam(params, 'contract')
  const holder = addressParam(params, 'holder', true)
  const tokenId = uintParam(params, 'tokenId')
  const contract = await requireCode(network, requested ?? SBT_CONTRACTS[network.key])
  const [balance, ownerOf, unlocked, detail] = await readContracts(network, [
    { address: contract, abi: BALANCE_ABI, fn: 'balanceOf', args: [holder] },
    { address: contract, abi: SBT_ABI, fn: 'ownerOf', args: [tokenId ?? 0n] },
    { address: contract, abi: SBT_ABI, fn: 'isUnlocked', args: [tokenId ?? 0n] },
    { address: contract, abi: SBT_ABI, fn: 'sbts', args: [tokenId ?? 0n] },
  ])
  if (!balance) throw new GatewayError('unsupported')
  const count = balance[0] as bigint
  const ownsToken = tokenId === null ? null : Boolean(ownerOf) && String(ownerOf?.[0]).toLowerCase() === holder.toLowerCase()
  return {
    network: networkInfo(network),
    contract,
    holder,
    /** 보유 여부: tokenId를 주면 그 토큰의 보유자인지, 아니면 하나라도 가지고 있는지 */
    valid: ownsToken ?? count > 0n,
    balance: count.toString(),
    token:
      tokenId === null || !ownerOf
        ? null
        : {
            tokenId: tokenId.toString(),
            owner: String(ownerOf[0]),
            unlocked: unlocked ? Boolean(unlocked[0]) : null,
            guardian: detail ? String(detail[0]) : null,
            unlockTime: detail && (detail[1] as bigint) > 0n ? iso(detail[1] as bigint) : null,
            metadata: detail ? String(detail[2]) : null,
          },
  }
}

/* ── RWA ────────────────────────────────────────────────────────── */

const rwaCertificate: Handler = async (params) => {
  const network = networkOf(params)
  const requested = addressParam(params, 'contract')
  const tokenId = uintParam(params, 'tokenId', true)
  const contract = await requireCode(network, requested ?? RWA_CONTRACTS[network.key])
  const [ownerOf, uri] = await readContracts(network, [
    { address: contract, abi: RWA_ABI, fn: 'ownerOf', args: [tokenId] },
    { address: contract, abi: RWA_ABI, fn: 'tokenURI', args: [tokenId] },
  ])
  if (!ownerOf) throw new GatewayError('not_found')
  const reference = typeof uri?.[0] === 'string' ? uri[0] : null
  const cid = reference?.replace(/^ipfs:\/\//, '') ?? null
  return {
    network: networkInfo(network),
    contract,
    tokenId: tokenId.toString(),
    owner: String(ownerOf[0]),
    /** 원본 자료의 주소 (IPFS CID 또는 URI) */
    document: reference,
    documentUrl: cid && /^[A-Za-z0-9]{32,100}$/.test(cid) ? `${IPFS_GATEWAY}/${cid}` : null,
  }
}

const rwaHolders: Handler = async (params) => {
  const network = networkOf(params)
  const requested = addressParam(params, 'vault', true)
  const holder = addressParam(params, 'holder', true)
  const vault = await requireCode(network, requested)
  const [name, symbol, supply, distributed, rounds, info] = await readContracts(network, [
    { address: vault, abi: RWA_VAULT_ABI, fn: 'name' },
    { address: vault, abi: RWA_VAULT_ABI, fn: 'symbol' },
    { address: vault, abi: RWA_VAULT_ABI, fn: 'totalSupply' },
    { address: vault, abi: RWA_VAULT_ABI, fn: 'totalDistributed' },
    { address: vault, abi: RWA_VAULT_ABI, fn: 'distributionCount' },
    { address: vault, abi: RWA_VAULT_ABI, fn: 'holderInfo', args: [holder] },
  ])
  if (!info || !supply) throw new GatewayError('unsupported')
  return {
    network: networkInfo(network),
    vault,
    name: String(name?.[0] ?? ''),
    symbol: String(symbol?.[0] ?? ''),
    totalShares: formatUnits(supply[0] as bigint, 18),
    totalDistributed: distributed ? formatUnits(distributed[0] as bigint, 18) : null,
    distributions: rounds ? Number(rounds[0]) : null,
    holder: {
      address: holder,
      shares: formatUnits(info[0] as bigint, 18),
      sharePercent: Number(info[1] as bigint) / 100,
      withdrawable: formatUnits(info[2] as bigint, 18),
      withdrawn: formatUnits(info[3] as bigint, 18),
    },
  }
}

/* ── 오라클 ─────────────────────────────────────────────────────── */

/** 온체인 피드가 없을 때 쓰는 참고 시세 (일별 종가, /api/market-data와 같은 원본을 직접 부른다) */
const REFERENCE_PAIRS: Record<string, 'btc' | 'qqq'> = { 'BTC/USD': 'btc', 'QQQ/USD': 'qqq' }

async function referencePrice(pair: string) {
  const series = REFERENCE_PAIRS[pair]
  if (!series) throw new GatewayError('not_found')
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10)
  const found = await loadSeries(series, from, to)
  const last = found?.rows.at(-1)
  if (!last) throw new GatewayError('upstream_unavailable')
  return { price: String(last.close), date: last.date }
}

const oraclePrice: Handler = async (params) => {
  const network = networkOf(params)
  const pair = textParam(params, 'pair', PAIR)
  const oracle = PRICE_ORACLE_CONTRACTS[network.key]
  if (oracle) {
    await requireCode(network, oracle)
    const [latest] = await readContracts(network, [{ address: oracle, abi: PRICE_ORACLE_ABI, fn: 'latestPrice', args: [pair] }])
    if (latest) {
      return {
        network: networkInfo(network),
        pair,
        source: 'onchain',
        contract: oracle,
        roundId: String(latest[0]),
        price: formatUnits(latest[1] as bigint, Number(latest[2])),
        decimals: Number(latest[2]),
        observedAt: iso(latest[3] as bigint),
        updatedAt: iso(latest[4] as bigint),
        stale: Boolean(latest[5]),
      }
    }
  }
  // 온체인에 이 피드의 가격이 아직 없다: 참고 시세를 돌려주고, 온체인 값이 아님을 응답에 밝힌다
  if (!REFERENCE_PAIRS[pair]) throw new GatewayError('not_found')
  const reference = await cached(`reference:${pair}`, 300_000, () => referencePrice(pair))
  return {
    network: networkInfo(network),
    pair,
    source: 'reference',
    contract: oracle,
    notice: oracle
      ? '이 피드는 PriceOracle 컨트랙트에 아직 등록되거나 기록되지 않았습니다. 온체인 값이 아니라 외부 시세의 일별 종가입니다.'
      : 'PriceOracle 컨트랙트가 이 네트워크에 배포되기 전입니다. 온체인 값이 아니라 외부 시세의 일별 종가입니다.',
    price: reference.price,
    observedAt: `${reference.date}T00:00:00.000Z`,
  }
}

const oracleHistory: Handler = async (params) => {
  const network = networkOf(params)
  const pair = textParam(params, 'pair', PAIR)
  const roundId = uintParam(params, 'roundId', true)
  const oracle = await requireCode(network, PRICE_ORACLE_CONTRACTS[network.key])
  const [feed, round] = await readContracts(network, [
    { address: oracle, abi: PRICE_ORACLE_ABI, fn: 'getFeed', args: [pair] },
    { address: oracle, abi: PRICE_ORACLE_ABI, fn: 'getRound', args: [pair, roundId] },
  ])
  if (!feed || !round) throw new GatewayError('not_found')
  return {
    network: networkInfo(network),
    pair,
    contract: oracle,
    roundId: roundId.toString(),
    latestRound: String(feed[2]),
    price: formatUnits(round[0] as bigint, Number(feed[0])),
    observedAt: iso(round[1] as bigint),
    updatedAt: iso(round[2] as bigint),
    reporter: String(round[3]),
  }
}

/* ── 브릿지 ─────────────────────────────────────────────────────── */

const bridgeRoutes: Handler = async () => {
  const source = getNetwork(BRIDGE.network)
  const target = getNetwork(BRIDGE.destinationNetwork)
  return {
    /** 지금 운영 중인 경로 (릴레이 방식 브릿지, /bridge 화면이 쓰는 컨트랙트) */
    routes: [
      {
        source: networkInfo(source),
        target: networkInfo(target),
        sourceToken: { symbol: `w${source.symbol}`, address: BRIDGE.wrappedToken },
        targetToken: { symbol: `w${target.symbol}`, address: BRIDGE.destinationToken },
        requester: BRIDGE.requester,
        type: 'relay',
      },
    ],
    /** 서명 정족수 방식 게이트웨이(BridgeGateway)의 네트워크별 배포 주소. null이면 배포 전 */
    gateways: Object.fromEntries(Object.entries(BRIDGE_GATEWAY_CONTRACTS).map(([key, address]) => [key, address])),
  }
}

const TRANSFER_STATUS = ['none', 'pending', 'refunded'] as const

const bridgeTransferStatus: Handler = async (params) => {
  const network = networkOf(params)
  const transferId = hashParam(params, 'transferId')
  const gateway = await requireCode(network, BRIDGE_GATEWAY_CONTRACTS[network.key])
  const [transfer] = await readContracts(network, [{ address: gateway, abi: BRIDGE_GATEWAY_ABI, fn: 'getTransfer', args: [transferId] }])
  if (!transfer || Number(transfer[7]) === 0) throw new GatewayError('not_found')
  return {
    network: networkInfo(network),
    gateway,
    transferId,
    status: TRANSFER_STATUS[Number(transfer[7])] ?? 'none',
    sender: String(transfer[0]),
    token: String(transfer[1]),
    amountRaw: String(transfer[2]),
    feeRaw: String(transfer[3]),
    targetChainId: Number(transfer[4]),
    recipient: String(transfer[5]),
    createdAt: iso(transfer[6] as bigint),
  }
}

/* ── DID ────────────────────────────────────────────────────────── */

const didResolve: Handler = async (params) => {
  const network = networkOf(params)
  const did = textParam(params, 'did', /^did:[a-z0-9]{1,16}:[A-Za-z0-9._:%-]{1,120}$/)
  const registry = await requireCode(network, DID_REGISTRY_CONTRACTS[network.key])
  const didHash = keccak256(toUtf8Bytes(did))
  const [identity] = await readContracts(network, [{ address: registry, abi: DID_REGISTRY_ABI, fn: 'resolve', args: [didHash] }])
  if (!identity) throw new GatewayError('not_found')
  return {
    network: networkInfo(network),
    registry,
    did,
    didHash,
    controller: String(identity[0]),
    documentURI: String(identity[1]),
    createdAt: iso(identity[2] as bigint),
    updatedAt: iso(identity[3] as bigint),
    active: Boolean(identity[4]),
  }
}

const didVerify: Handler = async (params) => {
  const network = networkOf(params)
  const credentialHash = hashParam(params, 'credentialHash')
  const registry = await requireCode(network, DID_REGISTRY_CONTRACTS[network.key])
  const [credential] = await readContracts(network, [{ address: registry, abi: DID_REGISTRY_ABI, fn: 'verifyCredential', args: [credentialHash] }])
  if (!credential) throw new GatewayError('unsupported')
  const issuedAt = credential[3] as bigint
  if (issuedAt === 0n) throw new GatewayError('not_found')
  const expiresAt = credential[4] as bigint
  return {
    network: networkInfo(network),
    registry,
    credentialHash,
    valid: Boolean(credential[0]),
    issuerDidHash: String(credential[1]),
    subjectDidHash: String(credential[2]),
    issuedAt: iso(issuedAt),
    expiresAt: expiresAt === 0n ? null : iso(expiresAt),
    revoked: Boolean(credential[5]),
  }
}

/** 경로 → 처리기. 카탈로그(src/content/api-catalog.ts)의 tryIt과 짝을 이룬다 */
export const GET_HANDLERS: Record<string, Handler> = {
  'chain/status': chainStatus,
  'anomaly/scan': anomalyScan,
  'tokens/status': tokenStatus,
  nfts: nftLookup,
  'sbts/verify': sbtVerify,
  'rwa/certificate': rwaCertificate,
  'rwa/holders': rwaHolders,
  'oracle/prices': oraclePrice,
  'oracle/prices/history': oracleHistory,
  'bridge/routes': bridgeRoutes,
  'bridge/transfers/status': bridgeTransferStatus,
  'did/resolve': didResolve,
  'did/credentials/verify': didVerify,
}
