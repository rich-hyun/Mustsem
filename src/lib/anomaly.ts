/**
 * 이상거래 탐지 규칙 (v2). 화면의 시연과 서버의 실제 체인 조회(/api/v1/anomaly/scan)가 같은 규칙을 쓴다.
 *
 * 거래를 시간순으로 하나씩 넣으면 위험도(0~100)와 사유, 대응(지갑 동결·블랙리스트)을 돌려준다.
 * 규칙: 블랙리스트 주소 · 금액 급증(z-점수) · 단시간 반복 전송 · 신규 지갑 고액 전송 · 분산 송금 · 왕복 거래.
 * 여기서 정하는 "대응"은 탐지기 안의 목록에만 반영된다. 실제 온체인 조치는 ComplianceGuard 컨트랙트 권한이 있어야 한다.
 */
export type RiskLevel = 'ok' | 'warn' | 'critical' | 'blocked'
export type RiskAction = 'freeze' | 'blacklist'

export interface Tx {
  from: string
  to: string
  amount: number
  /** 밀리초 */
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
  burstWindowMs: 10_000,
  fanOutCount: 5,
  fanOutWindowMs: 60_000,
  roundTripWindowMs: 60_000,
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
  const recipients = new Map<string, Array<{ to: string; ts: number }>>()
  const lastPair = new Map<string, number>()
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

    // 분산 송금: 한 지갑이 짧은 시간에 여러 지갑으로 나눠 보낸다
    const sent = (recipients.get(tx.from) ?? []).filter((entry) => tx.ts - entry.ts <= RISK_RULES.fanOutWindowMs)
    sent.push({ to: tx.to, ts: tx.ts })
    recipients.set(tx.from, sent)
    const distinct = new Set(sent.map((entry) => entry.to)).size
    if (distinct >= RISK_RULES.fanOutCount) {
      score += 45
      reasons.push(`분산 송금 (${distinct}개 지갑)`)
    }

    // 왕복 거래: 방금 받은 상대에게 곧바로 되돌려 보낸다
    const back = lastPair.get(`${tx.to}>${tx.from}`)
    if (back !== undefined && tx.ts - back <= RISK_RULES.roundTripWindowMs && tx.from !== tx.to) {
      score += 35
      reasons.push('왕복 거래')
    }
    lastPair.set(`${tx.from}>${tx.to}`, tx.ts)

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

  return { evaluate, policy, frozen, blacklist, baselineReady: () => baseline() !== null }
}

export type Detector = ReturnType<typeof createDetector>
