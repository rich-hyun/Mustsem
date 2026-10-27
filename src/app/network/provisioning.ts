import { NETWORKS } from '@/config/networks'
import { API_BASE } from '@/config/site'

/** 정책: 예치 MST 1 : 네이티브 코인 1000 */
export const COIN_PER_MST = 1000

export type Consensus = 'ibft' | 'qbft' | 'clique'

export interface ProvisionInput {
  company: string
  contact: string
  netName: string
  symbol: string
  mstAmount: string
  validators: string
  consensus: Consensus
  governanceToken: boolean
  anomaly: boolean
  autoFreeze: boolean
  autoBlacklist: boolean
  memo: string
}

export type ProvisionErrors = Partial<Record<keyof ProvisionInput, string>>

export interface NetworkSpec {
  company: string
  contact: string
  name: string
  symbol: string
  chainId: number
  consensus: Consensus
  validators: number
  collateralMst: number
  supply: number
  governanceToken: boolean
  anomaly: { enabled: boolean; freeze: boolean; blacklist: boolean }
  memo: string
  rpcUrl: string
  genesis: Record<string, unknown>
}

/** 개설 API가 응답해 실제로 만들어졌다면 `live`, 아니면 사양만 보여 주는 `demo` */
export interface ProvisionOutcome {
  mode: 'live' | 'demo'
  rpcUrl: string
  chainId: number
}

/** 이미 쓰는 체인 ID(운영 네트워크 + 주요 공용 체인)와 겹치지 않게 한다 */
const RESERVED_CHAIN_IDS = [1, 5, 56, 137, ...NETWORKS.map((n) => n.chainId)]

export function calcSupply(mst: string | number): number {
  const n = Math.floor(Number(mst))
  return Number.isFinite(n) && n >= 1 ? n * COIN_PER_MST : 0
}

/** 네트워크명으로 결정되는 chainId (10000~59999). 겹치면 다음 값으로 이동한다. */
export function allocChainId(name: string, taken: readonly number[] = []): number {
  const used = new Set([...RESERVED_CHAIN_IDS, ...taken])
  let hash = 2166136261
  for (const ch of name) {
    hash ^= ch.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619) >>> 0
  }
  let id = 10000 + (hash % 50000)
  while (used.has(id)) id = id >= 59999 ? 10000 : id + 1
  return id
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'net'
}

export function validateInput(v: ProvisionInput): ProvisionErrors {
  const errors: ProvisionErrors = {}
  if (!v.company.trim()) errors.company = '회사명을 입력하세요.'
  const contact = v.contact.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(contact)) {
    errors.contact = '이메일 또는 연락처 형식이 올바르지 않습니다.'
  }
  if (!/^[A-Za-z][A-Za-z0-9 _-]{1,23}$/.test(v.netName.trim())) {
    errors.netName = '영문으로 시작하는 2~24자로 입력하세요. (영문, 숫자, 공백, -, _)'
  }
  if (!/^[A-Z]{2,5}$/.test(v.symbol.trim())) errors.symbol = '영문 대문자 2~5자로 입력하세요.'
  const mst = v.mstAmount.trim()
  if (!mst) errors.mstAmount = '예치할 MST 수량을 입력하세요.'
  else if (!/^\d+$/.test(mst) || Number(mst) < 1) errors.mstAmount = '1 이상의 정수로 입력하세요.'
  const validators = Number(v.validators)
  if (!Number.isInteger(validators) || validators < 1 || validators > 21) errors.validators = '1~21 사이의 정수로 입력하세요.'
  return errors
}

/** 검증을 통과한 입력으로 체인 사양(제네시스 포함)을 만든다 */
export function buildSpec(v: ProvisionInput): NetworkSpec {
  const name = v.netName.trim()
  const supply = calcSupply(v.mstAmount)
  const chainId = allocChainId(name)
  const validators = Number(v.validators)
  return {
    company: v.company.trim(),
    contact: v.contact.trim(),
    name,
    symbol: v.symbol.trim(),
    chainId,
    consensus: v.consensus,
    validators,
    collateralMst: Number(v.mstAmount),
    supply,
    governanceToken: v.governanceToken,
    anomaly: { enabled: v.anomaly, freeze: v.anomaly && v.autoFreeze, blacklist: v.anomaly && v.autoBlacklist },
    memo: v.memo.trim(),
    rpcUrl: `https://${slugify(name)}.mst2.site`,
    genesis: {
      config: { chainId, [v.consensus]: { blockperiod: 2, epoch: 30000 } },
      gasLimit: '0x1c9c380',
      alloc: { '0x<treasury>': { balance: `0x${(BigInt(supply) * 10n ** 18n).toString(16)}` } },
      extraData: `validators:${validators}`,
    },
  }
}

export const STEPS = [
  '입력값 검증 · 체인 ID 할당',
  'MST 담보 락업 확인 (1:1000)',
  '제네시스 블록 · 체인 설정 생성',
  '검증자 노드 배포',
  'RPC 엔드포인트 개설',
  '이상탐지 정책 적용 · 헬스체크',
] as const

export type StepState = 'wait' | 'run' | 'done'

interface ProvisionResponse {
  rpcUrl?: string
  chainId?: number
}

async function requestProvision(spec: NetworkSpec, timeoutMs: number): Promise<ProvisionResponse | null> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}/network/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
      signal: ctl.signal,
    })
    if (!res.ok) return null
    return (await res.json()) as ProvisionResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 개설을 실행한다. 개설 API가 응답하면 그 결과를 쓰고, 응답이 없으면 시연 모드로 사양만 보여 준다.
 * 어느 쪽인지는 반환값의 `mode`로 구분하며, 화면에서 반드시 사용자에게 알린다.
 */
export async function provision(
  spec: NetworkSpec,
  onStep: (index: number, state: StepState) => void,
  options: { stepDelayMs?: number; timeoutMs?: number; skipApi?: boolean } = {},
): Promise<ProvisionOutcome> {
  const { stepDelayMs = 450, timeoutMs = 4000, skipApi = false } = options
  onStep(0, 'run')
  const live = skipApi ? null : await requestProvision(spec, timeoutMs)
  const mode = live ? 'live' : 'demo'
  for (let i = 0; i < STEPS.length; i++) {
    onStep(i, 'run')
    await new Promise((r) => setTimeout(r, mode === 'demo' ? stepDelayMs : Math.min(stepDelayMs, 200)))
    onStep(i, 'done')
  }
  return { mode, rpcUrl: live?.rpcUrl ?? spec.rpcUrl, chainId: live?.chainId ?? spec.chainId }
}

/* ── 이상거래 탐지 ──────────────────────────────────────────────── */

export type RiskLevel = 'ok' | 'warn' | 'critical' | 'blocked'
export type RiskAction = 'freeze' | 'blacklist'

export interface Tx {
  from: string
  to: string
  amount: number
  ts: number
  newWallet?: boolean
}

export interface RiskResult {
  score: number
  level: RiskLevel
  reasons: string[]
  actions: RiskAction[]
}

/** 위험도 구간: 0~49 정상, 50~79 경고, 80~100 고위험 */
export const RISK_RULES = {
  zThreshold: 3,
  burstCount: 5,
  burstWindowMs: 10000,
  scoreAlert: 50,
  scoreAction: 80,
} as const

export interface DetectorPolicy {
  freeze: boolean
  blacklist: boolean
}

export function createDetector(initial: { blacklist?: string[]; policy?: Partial<DetectorPolicy> } = {}) {
  const policy: DetectorPolicy = { freeze: true, blacklist: true, ...initial.policy }
  const amounts: number[] = []
  const recent = new Map<string, number[]>()
  const frozen = new Set<string>()
  const blacklist = new Set<string>(initial.blacklist ?? [])

  function baseline() {
    if (amounts.length < 8) return null
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length) || 1
    return { mean, sd }
  }

  function evaluate(tx: Tx): RiskResult {
    if (frozen.has(tx.from)) return { score: 100, level: 'blocked', reasons: ['동결된 지갑'], actions: [] }
    const reasons: string[] = []
    let score = 0

    if (blacklist.has(tx.to) || blacklist.has(tx.from)) {
      score += 70
      reasons.push('블랙리스트 주소 거래')
    }

    const base = baseline()
    if (base) {
      const z = (tx.amount - base.mean) / base.sd
      if (z > RISK_RULES.zThreshold) {
        score += Math.min(70, 30 + (z - RISK_RULES.zThreshold) * 8)
        reasons.push(`금액 급증 (z=${z.toFixed(1)})`)
      }
    }

    const times = (recent.get(tx.from) ?? []).filter((t) => tx.ts - t <= RISK_RULES.burstWindowMs)
    times.push(tx.ts)
    recent.set(tx.from, times)
    if (times.length >= RISK_RULES.burstCount) {
      score += 55
      reasons.push(`단시간 반복 전송 (${times.length}회)`)
    }

    if (tx.newWallet && base && tx.amount > base.mean + 2 * base.sd) {
      score += 20
      reasons.push('신규 지갑 고액 전송')
    }

    score = Math.min(100, Math.round(score))
    const level: RiskLevel = score >= RISK_RULES.scoreAction ? 'critical' : score >= RISK_RULES.scoreAlert ? 'warn' : 'ok'
    const actions: RiskAction[] = []
    if (level === 'critical') {
      if (policy.freeze && !frozen.has(tx.from)) {
        frozen.add(tx.from)
        actions.push('freeze')
      }
      if (policy.blacklist && !blacklist.has(tx.from)) {
        blacklist.add(tx.from)
        actions.push('blacklist')
      }
    }
    if (level === 'ok') {
      amounts.push(tx.amount) // 정상 거래만 기준 분포에 반영
      if (amounts.length > 200) amounts.shift()
    }
    return { score, level, reasons, actions }
  }

  return { evaluate, policy, frozen, blacklist }
}

export type Detector = ReturnType<typeof createDetector>
