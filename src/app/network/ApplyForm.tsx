'use client'

import { CheckCircleIcon, CircleNotchIcon, CircleIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useState, type SubmitEvent } from 'react'
import type { ChainNetwork } from '@/config/networks'
import { Button } from '@/components/ui/Button'
import { KeyValueList } from '@/components/ui/DataDisplay'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useWallet } from '@/components/wallet/WalletProvider'
import { cx } from '@/lib/cx'
import {
  STEPS,
  buildSpec,
  calcSupply,
  provision,
  slugify,
  validateInput,
  type Consensus,
  type NetworkSpec,
  type ProvisionErrors,
  type ProvisionInput,
  type ProvisionOutcome,
  type StepState,
} from './provisioning'
import styles from './network.module.css'

const EMPTY: ProvisionInput = {
  company: '',
  contact: '',
  netName: '',
  symbol: '',
  mstAmount: '',
  validators: '4',
  consensus: 'ibft',
  governanceToken: false,
  anomaly: true,
  autoFreeze: true,
  autoBlacklist: true,
  memo: '',
}

const CONSENSUS_LABEL: Record<Consensus, string> = { ibft: 'IBFT 2.0', qbft: 'QBFT', clique: 'Clique (PoA)' }
const idleSteps = (): StepState[] => STEPS.map(() => 'wait')
const fmt = (n: number) => n.toLocaleString('ko-KR')

/**
 * 네트워크 자동 개설 폼. 입력을 검증해 체인 사양을 만들고 단계별로 개설을 진행한다.
 * 개설 API가 응답하지 않으면 시연 모드로 사양만 보여 주며, 그 사실을 결과에 표시한다.
 */
export function ApplyForm() {
  const wallet = useWallet()
  const [values, setValues] = useState<ProvisionInput>(EMPTY)
  const [errors, setErrors] = useState<ProvisionErrors>({})
  const [steps, setSteps] = useState<StepState[]>(idleSteps)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState<{ spec: NetworkSpec; outcome: ProvisionOutcome } | null>(null)
  const [walletNote, setWalletNote] = useState<string | null>(null)

  const update = <K extends keyof ProvisionInput>(key: K, value: ProvisionInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const supply = calcSupply(values.mstAmount)

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (running) return
    const nextErrors = validateInput(values)
    setErrors(nextErrors)
    const firstInvalid = (Object.keys(nextErrors) as Array<keyof ProvisionInput>)[0]
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }
    const spec = buildSpec(values)
    setDone(null)
    setWalletNote(null)
    setRunning(true)
    setSteps(idleSteps())
    const outcome = await provision(spec, (index, state) =>
      setSteps((prev) => prev.map((s, i) => (i === index ? state : s))),
    )
    setDone({ spec, outcome })
    setRunning(false)
  }

  const downloadGenesis = (spec: NetworkSpec) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(spec.genesis, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(spec.name)}-genesis.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const addToWallet = async (spec: NetworkSpec, outcome: ProvisionOutcome) => {
    // 지갑 등록에는 key를 쓰지 않는다. 운영 목록에 없는 신규 체인이라 타입만 맞춘다.
    const network = { key: 'mustsem', name: spec.name, chainId: outcome.chainId, rpcUrl: outcome.rpcUrl, symbol: spec.symbol } as ChainNetwork
    const ok = await wallet.switchNetwork(network)
    setWalletNote(ok ? '네트워크가 지갑에 추가되었습니다.' : null)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate aria-describedby="apply-lead">
      <div className={styles.row}>
        <TextField
          label="회사명"
          name="company"
          autoComplete="organization"
          placeholder="예: (주)머스트셈테크"
          maxLength={100}
          value={values.company}
          onChange={(e) => update('company', e.target.value)}
          error={errors.company}
          required
        />
        <TextField
          label="연락처 / 이메일"
          name="contact"
          autoComplete="email"
          placeholder="예: 010-1234-5678 또는 example@company.com"
          maxLength={120}
          value={values.contact}
          onChange={(e) => update('contact', e.target.value)}
          error={errors.contact}
          required
        />
      </div>
      <div className={styles.row}>
        <TextField
          label="네트워크명 (영문)"
          name="netName"
          autoComplete="off"
          placeholder="예: AcmeChain"
          maxLength={24}
          value={values.netName}
          onChange={(e) => update('netName', e.target.value)}
          error={errors.netName}
          required
        />
        <TextField
          label="코인 심볼"
          name="symbol"
          autoComplete="off"
          placeholder="예: ACM"
          maxLength={5}
          value={values.symbol}
          onChange={(e) => update('symbol', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          error={errors.symbol}
          required
        />
      </div>
      <TextField
        label="예치할 MST 수량"
        name="mstAmount"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 1000"
        value={values.mstAmount}
        onChange={(e) => update('mstAmount', e.target.value.replace(/[^\d]/g, ''))}
        error={errors.mstAmount}
        hint={
          supply
            ? `${fmt(Number(values.mstAmount))} MST를 담보로 ${fmt(supply)} ${values.symbol || '코인'}이 발행됩니다.`
            : '예치한 MST를 담보로 1:1000 비율의 네이티브 코인이 발행됩니다.'
        }
        trailing="MST"
        trailingWidth={40}
        required
      />
      <div className={styles.row}>
        <SelectField label="합의 알고리즘" name="consensus" value={values.consensus} onChange={(e) => update('consensus', e.target.value as Consensus)}>
          {(Object.keys(CONSENSUS_LABEL) as Consensus[]).map((key) => (
            <option key={key} value={key}>
              {CONSENSUS_LABEL[key]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="검증자 노드 수"
          name="validators"
          inputMode="numeric"
          autoComplete="off"
          value={values.validators}
          onChange={(e) => update('validators', e.target.value.replace(/[^\d]/g, ''))}
          error={errors.validators}
          hint="1~21개"
          required
        />
      </div>

      <fieldset className={styles.options}>
        <legend>옵션</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={values.governanceToken} onChange={(e) => update('governanceToken', e.target.checked)} />
          <span>거버넌스 토큰(GT) 추가 발행</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={values.anomaly} onChange={(e) => update('anomaly', e.target.checked)} />
          <span>온체인 이상거래 탐지 적용</span>
        </label>
        <label className={cx(styles.check, styles.sub)}>
          <input type="checkbox" checked={values.autoFreeze} disabled={!values.anomaly} onChange={(e) => update('autoFreeze', e.target.checked)} />
          <span>고위험 거래 시 지갑 자동 동결</span>
        </label>
        <label className={cx(styles.check, styles.sub)}>
          <input type="checkbox" checked={values.autoBlacklist} disabled={!values.anomaly} onChange={(e) => update('autoBlacklist', e.target.checked)} />
          <span>고위험 거래 시 블랙리스트 자동 등록</span>
        </label>
      </fieldset>

      <TextAreaField
        label="기타 요청사항"
        name="memo"
        optional
        rows={3}
        maxLength={1000}
        placeholder="도메인 등 추가 요청사항을 입력하세요."
        value={values.memo}
        onChange={(e) => update('memo', e.target.value)}
      />

      <div className={styles.submitRow}>
        <Button type="submit" size="lg" block loading={running}>
          네트워크 자동 개설
        </Button>
        <p className={styles.privacyNote}>
          입력하신 정보는 네트워크 개설 안내에만 사용됩니다. <Link href="/privacy">개인정보처리방침</Link>
        </p>
      </div>

      {(running || done) && (
        <ol className={styles.progress} aria-label="개설 진행 상황" aria-live="polite">
          {STEPS.map((label, i) => (
            <li key={label} className={styles[`step_${steps[i]}`]}>
              {steps[i] === 'done' ? (
                <CheckCircleIcon size={18} weight="fill" aria-hidden />
              ) : steps[i] === 'run' ? (
                <CircleNotchIcon size={18} className={styles.spin} aria-hidden />
              ) : (
                <CircleIcon size={18} aria-hidden />
              )}
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {done && (
        <div className={styles.result}>
          <Notice tone={done.outcome.mode === 'live' ? 'success' : 'warning'} title={`${done.spec.name} 네트워크 ${done.outcome.mode === 'live' ? '개설 완료' : '사양 생성 완료'}`} live>
            {done.outcome.mode === 'live'
              ? '네트워크가 개설되었습니다. 아래 정보를 지갑에 등록해 사용하세요.'
              : '현재는 시연 모드입니다. 개설 서버와 연결되지 않아 실제 노드는 생성되지 않았고, 아래는 자동 생성된 사양입니다.'}
          </Notice>
          <KeyValueList
            items={[
              { label: '체인 ID', value: done.outcome.chainId, mono: true },
              { label: 'RPC', value: done.outcome.rpcUrl, mono: true },
              { label: '심볼', value: done.spec.symbol },
              { label: '합의', value: `${CONSENSUS_LABEL[done.spec.consensus]} · 검증자 ${done.spec.validators}개` },
              { label: '발행량', value: `${fmt(done.spec.supply)} ${done.spec.symbol} (담보 ${fmt(done.spec.collateralMst)} MST)` },
              { label: '거버넌스 토큰', value: done.spec.governanceToken ? '발행' : '미발행' },
              {
                label: '이상탐지',
                value: done.spec.anomaly.enabled
                  ? `적용 (${[done.spec.anomaly.freeze && '자동 동결', done.spec.anomaly.blacklist && '블랙리스트 등록'].filter(Boolean).join(', ') || '알림만'})`
                  : '미적용',
              },
            ]}
          />
          <div className={styles.resultActions}>
            {done.outcome.mode === 'live' && (
              <Button type="button" onClick={() => addToWallet(done.spec, done.outcome)}>
                지갑에 추가
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => downloadGenesis(done.spec)}>
              genesis.json 받기
            </Button>
          </div>
          {walletNote && <p className={styles.privacyNote}>{walletNote}</p>}
        </div>
      )}
    </form>
  )
}
