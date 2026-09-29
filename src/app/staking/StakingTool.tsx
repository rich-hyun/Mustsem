'use client'

import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react/ssr'
import { Contract } from 'ethers'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { STAKING, STAKING_ABI, STAKING_TERMS, WRAPPED_NATIVE_ABI } from '@/config/contracts'
import { getNetwork } from '@/config/networks'
import { IDLE_READING, formatReading, loadingFrom, settleReading, type Reading } from '@/components/tools/readings'
import { ToolStep, ToolSteps } from '@/components/tools/ToolStep'
import { TxStatus } from '@/components/tx/TxStatus'
import { useTx } from '@/components/tx/useTx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, KeyValueList, Metric } from '@/components/ui/DataDisplay'
import { TextField } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { ContractNotice } from '@/components/tools/ContractNotice'
import { NetworkGate } from '@/components/wallet/NetworkGate'
import { useSigner } from '@/components/wallet/useSigner'
import { useWallet } from '@/components/wallet/WalletProvider'
import { parseAmount, sanitizeAmountInput, toInputAmount } from '@/lib/amount'
import { formatDateTime } from '@/lib/format'
import { assertDeployed, readProvider, withTimeout } from '@/lib/web3'
import styles from '@/components/tools/Tool.module.css'
import parts from '@/components/tools/ToolParts.module.css'
import local from './Staking.module.css'

const NETWORK = getNetwork(STAKING.network)
const SYMBOL = NETWORK.symbol
const { aprPercent: APR, claimIntervalDays: CLAIM_DAYS } = STAKING_TERMS

interface StakingData {
  native: Reading
  wrapped: Reading
  allowance: Reading
  staked: Reading
  pending: Reading
  /** 마지막 보상 수령 시각(초). 0이면 아직 받은 적 없음 */
  lastClaim: bigint | null
  /** 보상 수령 최소 간격(초) */
  interval: bigint | null
  checkedAt: number | null
}

const EMPTY_DATA: StakingData = {
  native: IDLE_READING,
  wrapped: IDLE_READING,
  allowance: IDLE_READING,
  staked: IDLE_READING,
  pending: IDLE_READING,
  lastClaim: null,
  interval: null,
  checkedAt: null,
}

/** stakes()처럼 튜플을 돌려주는 조회에서 한 칸만 꺼내 settle 결과 형태로 바꾼다 */
function pick(result: PromiseSettledResult<unknown>, index: number): PromiseSettledResult<unknown> {
  if (result.status !== 'fulfilled') return result
  const tuple = result.value as ArrayLike<unknown> | null | undefined
  return { status: 'fulfilled', value: tuple?.[index] }
}

function bigintOf(result: PromiseSettledResult<unknown>): bigint | null {
  return result.status === 'fulfilled' && typeof result.value === 'bigint' ? result.value : null
}

/** 수량 입력칸 하나의 값·오류 상태 */
function useAmountField() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  return {
    value,
    error,
    setError,
    change: (next: string) => {
      setValue(sanitizeAmountInput(next))
      setError(null)
    },
    fill: (amount: bigint) => {
      setValue(toInputAmount(amount))
      setError(null)
    },
  }
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className={parts.inlineError} role="alert">
      <WarningCircleIcon size={15} weight="fill" aria-hidden />
      {message}
    </p>
  )
}

export function StakingTool() {
  const wallet = useWallet()
  const requireSigner = useSigner()
  const account = wallet.status === 'connected' ? wallet.account : null

  const [data, setData] = useState<StakingData>(EMPTY_DATA)
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)

  const [wrapTab, setWrapTab] = useState<'wrap' | 'unwrap'>('wrap')
  const wrapField = useAmountField()
  const unwrapField = useAmountField()
  const stakeField = useAmountField()
  const unstakeField = useAmountField()
  const [stakeError, setStakeError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [exitError, setExitError] = useState<string | null>(null)

  const wrapTx = useTx()
  const unwrapTx = useTx()
  const approveTx = useTx()
  const stakeTx = useTx()
  const unstakeTx = useTx()
  const claimTx = useTx()
  const exitTx = useTx()

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    if (!account) {
      setData(EMPTY_DATA)
      return
    }
    setLoading(true)
    setData((prev) => ({
      ...prev,
      native: loadingFrom(prev.native),
      wrapped: loadingFrom(prev.wrapped),
      allowance: loadingFrom(prev.allowance),
      staked: loadingFrom(prev.staked),
      pending: loadingFrom(prev.pending),
    }))

    const reader = readProvider(NETWORK, { provider: wallet.provider, chainId: wallet.chainId })
    const token = new Contract(STAKING.wrappedToken, WRAPPED_NATIVE_ABI, reader)
    const staking = new Contract(STAKING.staking, STAKING_ABI, reader)

    const [native, wrapped, allowance, stake, pending, interval] = await Promise.allSettled([
      withTimeout(reader.getBalance(account)),
      withTimeout(token.getFunction('balanceOf')(account)),
      withTimeout(token.getFunction('allowance')(account, STAKING.staking)),
      withTimeout(staking.getFunction('stakes')(account)),
      withTimeout(staking.getFunction('pendingReward')(account)),
      withTimeout(staking.getFunction('minClaimInterval')()),
    ])
    if (seq !== requestSeq.current) return // 더 최근 조회가 시작됐다

    setData((prev) => ({
      native: settleReading(native, prev.native),
      wrapped: settleReading(wrapped, prev.wrapped),
      allowance: settleReading(allowance, prev.allowance),
      // stakes(user) = [amount, accrued, lastUpdate, lastClaimTime]
      staked: settleReading(pick(stake, 0), prev.staked),
      pending: settleReading(pending, prev.pending),
      lastClaim: bigintOf(pick(stake, 3)) ?? prev.lastClaim,
      interval: bigintOf(interval) ?? prev.interval,
      checkedAt: Date.now(),
    }))
    setLoading(false)
  }, [account, wallet.provider, wallet.chainId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const parsedStake = parseAmount(stakeField.value)
  const approvedEnough = parsedStake.ok && data.allowance.value !== undefined && data.allowance.value >= parsedStake.value

  const nextClaimAt =
    data.lastClaim !== null && data.lastClaim > 0n && data.interval !== null ? Number((data.lastClaim + data.interval) * 1000n) : null
  const claimLocked = nextClaimAt !== null && Date.now() < nextClaimAt

  /* ── MST ↔ wMST ────────────────────────────────────────────────── */
  const wrap = async () => {
    const parsed = parseAmount(wrapField.value)
    if (!parsed.ok) return wrapField.setError(parsed.message)
    if (data.native.value !== undefined && parsed.value > data.native.value) return wrapField.setError(`보유한 ${SYMBOL}보다 많습니다.`)
    await wrapTx.run(
      `${SYMBOL} → wMST 래핑`,
      async () => {
        await assertDeployed(NETWORK, STAKING.wrappedToken, 'wMST')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.wrappedToken, WRAPPED_NATIVE_ABI, signer).getFunction('deposit')({ value: parsed.value })
      },
      { onConfirmed: refresh },
    )
  }

  const unwrap = async () => {
    const parsed = parseAmount(unwrapField.value)
    if (!parsed.ok) return unwrapField.setError(parsed.message)
    if (data.wrapped.value !== undefined && parsed.value > data.wrapped.value) return unwrapField.setError('보유한 wMST보다 많습니다.')
    await unwrapTx.run(
      `wMST → ${SYMBOL} 언래핑`,
      async () => {
        await assertDeployed(NETWORK, STAKING.wrappedToken, 'wMST')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.wrappedToken, WRAPPED_NATIVE_ABI, signer).getFunction('withdraw')(parsed.value)
      },
      { onConfirmed: refresh },
    )
  }

  /* ── 스테이킹 ──────────────────────────────────────────────────── */
  const approve = async () => {
    if (!parsedStake.ok) return stakeField.setError(parsedStake.message)
    if (data.wrapped.value !== undefined && parsedStake.value > data.wrapped.value) return stakeField.setError('보유한 wMST보다 많습니다.')
    const amount = parsedStake.value
    await approveTx.run(
      'wMST 스테이킹 승인',
      async () => {
        await assertDeployed(NETWORK, STAKING.wrappedToken, 'wMST')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.wrappedToken, WRAPPED_NATIVE_ABI, signer).getFunction('approve')(STAKING.staking, amount)
      },
      { onConfirmed: refresh },
    )
  }

  const stake = async () => {
    setStakeError(null)
    if (!parsedStake.ok) return setStakeError('1단계에서 스테이킹 수량을 입력하세요.')
    if (data.wrapped.value !== undefined && parsedStake.value > data.wrapped.value) return setStakeError('보유한 wMST보다 많습니다.')
    if (data.allowance.value !== undefined && parsedStake.value > data.allowance.value) {
      return setStakeError('먼저 1단계에서 이 수량 이상을 승인하세요.')
    }
    const amount = parsedStake.value
    await stakeTx.run(
      'wMST 스테이킹',
      async () => {
        await assertDeployed(NETWORK, STAKING.staking, '스테이킹')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.staking, STAKING_ABI, signer).getFunction('stake')(amount)
      },
      { onConfirmed: refresh },
    )
  }

  /* ── 관리 ──────────────────────────────────────────────────────── */
  const unstake = async () => {
    const parsed = parseAmount(unstakeField.value)
    if (!parsed.ok) return unstakeField.setError(parsed.message)
    if (data.staked.value !== undefined && parsed.value > data.staked.value) return unstakeField.setError('스테이킹 중인 수량보다 많습니다.')
    await unstakeTx.run(
      'wMST 언스테이킹',
      async () => {
        await assertDeployed(NETWORK, STAKING.staking, '스테이킹')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.staking, STAKING_ABI, signer).getFunction('withdraw')(parsed.value)
      },
      { onConfirmed: refresh },
    )
  }

  const claim = async () => {
    setClaimError(null)
    if (claimLocked && nextClaimAt !== null) {
      return setClaimError(`다음 보상은 ${formatDateTime(nextClaimAt)} 이후에 받을 수 있습니다.`)
    }
    await claimTx.run(
      `${SYMBOL} 보상 받기`,
      async () => {
        await assertDeployed(NETWORK, STAKING.staking, '스테이킹')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.staking, STAKING_ABI, signer).getFunction('claim')()
      },
      { onConfirmed: refresh },
    )
  }

  const exit = async () => {
    setExitError(null)
    if (data.staked.value === 0n) return setExitError('스테이킹 중인 wMST가 없습니다.')
    await exitTx.run(
      '전체 인출',
      async () => {
        await assertDeployed(NETWORK, STAKING.staking, '스테이킹')
        const signer = await requireSigner(NETWORK)
        return new Contract(STAKING.staking, STAKING_ABI, signer).getFunction('exit')()
      },
      { onConfirmed: refresh },
    )
  }

  /* ── 표시용 ────────────────────────────────────────────────────── */
  const amountTrailing = (unit: string, max: bigint | undefined, onMax: (amount: bigint) => void): ReactNode => (
    <>
      <span>{unit}</span>
      {max !== undefined && max > 0n && (
        <button type="button" className={styles.maxButton} onClick={() => onMax(max)}>
          최대
        </button>
      )}
    </>
  )
  const trailingWidth = (max: bigint | undefined) => (max !== undefined && max > 0n ? 100 : 48)

  const lastClaimText =
    data.lastClaim === null || data.lastClaim === 0n ? '-' : formatDateTime(Number(data.lastClaim * 1000n))
  const nextClaimValue: ReactNode =
    nextClaimAt === null ? (
      '-'
    ) : (
      <>
        {formatDateTime(nextClaimAt)}
        {!claimLocked && (
          <Badge tone="success" pill>
            수령 가능
          </Badge>
        )}
      </>
    )
  const claimWhenText = !account
    ? '지갑 연결 후 표시'
    : nextClaimAt === null
      ? data.lastClaim === 0n
        ? '아직 받은 보상 기록이 없습니다'
        : ''
      : claimLocked
        ? `다음 수령 가능 ${formatDateTime(nextClaimAt)}`
        : '지금 받을 수 있습니다'

  const anyError = [data.native, data.wrapped, data.staked, data.pending].some((reading) => reading.state === 'error')

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <NetworkGate network={NETWORK} />
        <ContractNotice
          network={NETWORK}
          contracts={[
            { label: 'wMST', address: STAKING.wrappedToken },
            { label: '스테이킹', address: STAKING.staking },
          ]}
        />

        <Card elevation="raised" padding="lg">
          <div className={styles.stepHead}>
            <h2 className={styles.stepTitle}>{SYMBOL} ↔ wMST</h2>
            <span className={styles.stepMeta}>1 : 1 교환</span>
          </div>
          <Tabs
            label="래핑 방향"
            value={wrapTab}
            onChange={(id) => (id === 'wrap' || id === 'unwrap') && setWrapTab(id)}
            items={[
              {
                id: 'wrap',
                label: '래핑',
                content: (
                  <>
                    <p className={local.tabDesc}>
                      {SYMBOL}를 예치하고 같은 수량의 wMST를 받습니다. 스테이킹에는 wMST를 사용합니다.
                    </p>
                    <div className={styles.formRow}>
                      <TextField
                        label="래핑 수량"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="예: 10"
                        value={wrapField.value}
                        onChange={(event) => wrapField.change(event.target.value)}
                        error={wrapField.error}
                        labelAside={account ? `보유 ${formatReading(data.native)} ${SYMBOL}` : undefined}
                        trailing={SYMBOL}
                        trailingWidth={44}
                      />
                      <Button onClick={wrap} loading={wrapTx.busy}>
                        wMST로 래핑
                      </Button>
                    </div>
                    <TxStatus state={wrapTx.state} />
                  </>
                ),
              },
              {
                id: 'unwrap',
                label: '언래핑',
                content: (
                  <>
                    <p className={local.tabDesc}>보유한 wMST를 돌려주고 같은 수량의 {SYMBOL}를 돌려받습니다.</p>
                    <div className={styles.formRow}>
                      <TextField
                        label="언래핑 수량"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="예: 5"
                        value={unwrapField.value}
                        onChange={(event) => unwrapField.change(event.target.value)}
                        error={unwrapField.error}
                        labelAside={account ? `보유 ${formatReading(data.wrapped)} wMST` : undefined}
                        trailing={amountTrailing('wMST', data.wrapped.value, unwrapField.fill)}
                        trailingWidth={trailingWidth(data.wrapped.value)}
                      />
                      <Button variant="secondary" onClick={unwrap} loading={unwrapTx.busy}>
                        {SYMBOL}로 언래핑
                      </Button>
                    </div>
                    <TxStatus state={unwrapTx.state} />
                  </>
                ),
              },
            ]}
          />
        </Card>

        <div className={local.groupHead}>
          <h2 className={local.groupTitle}>wMST 스테이킹</h2>
          <p className={local.groupDesc}>
            승인한 수량만큼 wMST를 예치합니다. 예치한 wMST에는 연 {APR}% 비율로 {SYMBOL} 보상이 쌓이고, {CLAIM_DAYS}일마다 받을 수
            있습니다.
          </p>
        </div>
        <ToolSteps label="스테이킹 단계">
          <ToolStep
            index={1}
            title="승인"
            meta="wMST 사용 승인"
            done={approvedEnough || approveTx.state.phase === 'confirmed'}
            description="스테이킹 컨트랙트가 예치할 wMST를 가져갈 수 있도록 승인합니다."
          >
            <div className={styles.formRow}>
              <TextField
                label="스테이킹 수량"
                inputMode="decimal"
                autoComplete="off"
                placeholder="예: 100"
                value={stakeField.value}
                onChange={(event) => {
                  stakeField.change(event.target.value)
                  setStakeError(null)
                }}
                error={stakeField.error}
                labelAside={account ? `승인됨 ${formatReading(data.allowance)} wMST` : undefined}
                trailing={amountTrailing('wMST', data.wrapped.value, stakeField.fill)}
                trailingWidth={trailingWidth(data.wrapped.value)}
              />
              <Button variant="secondary" onClick={approve} loading={approveTx.busy}>
                승인
              </Button>
            </div>
            <TxStatus state={approveTx.state} />
          </ToolStep>

          <ToolStep
            index={2}
            title="스테이킹"
            meta="wMST 예치"
            done={stakeTx.state.phase === 'confirmed'}
            description="승인한 수량을 스테이킹 컨트랙트에 예치합니다."
          >
            <div className={styles.summary}>
              <KeyValueList
                items={[
                  { label: '스테이킹 수량', value: parsedStake.ok ? `${stakeField.value} wMST` : '1단계에서 수량을 입력하세요' },
                  { label: '보유 wMST', value: account ? `${formatReading(data.wrapped)} wMST` : '지갑 연결 후 표시' },
                  { label: '현재 스테이킹', value: account ? `${formatReading(data.staked)} wMST` : '지갑 연결 후 표시' },
                ]}
              />
            </div>
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <Button onClick={stake} loading={stakeTx.busy}>
                스테이킹
              </Button>
            </div>
            <InlineError message={stakeError} />
            <TxStatus state={stakeTx.state} />
          </ToolStep>
        </ToolSteps>

        <Card elevation="raised" padding="lg">
          <div className={styles.stepHead}>
            <h2 className={styles.stepTitle}>스테이킹 관리</h2>
          </div>
          <div className={local.manage}>
            <section className={local.manageItem} aria-labelledby="staking-unstake">
              <h3 id="staking-unstake" className={local.manageTitle}>
                언스테이킹
              </h3>
              <p className={local.manageDesc}>스테이킹한 wMST 중 원하는 수량을 인출합니다.</p>
              <div className={styles.formRow}>
                <TextField
                  label="언스테이킹 수량"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="예: 50"
                  value={unstakeField.value}
                  onChange={(event) => unstakeField.change(event.target.value)}
                  error={unstakeField.error}
                  labelAside={account ? `스테이킹 중 ${formatReading(data.staked)} wMST` : undefined}
                  trailing={amountTrailing('wMST', data.staked.value, unstakeField.fill)}
                  trailingWidth={trailingWidth(data.staked.value)}
                />
                <Button variant="secondary" onClick={unstake} loading={unstakeTx.busy}>
                  언스테이킹
                </Button>
              </div>
              <TxStatus state={unstakeTx.state} />
            </section>

            <section className={local.manageItem} aria-labelledby="staking-claim">
              <h3 id="staking-claim" className={local.manageTitle}>
                보상 받기
              </h3>
              <p className={local.manageDesc}>
                쌓인 {SYMBOL} 보상을 받습니다. 마지막으로 받은 뒤 {CLAIM_DAYS}일이 지나야 다시 받을 수 있습니다.
              </p>
              <div className={local.claimRow}>
                <div className={local.claimInfo}>
                  <span className={local.claimLabel}>받을 보상</span>
                  <span className={local.claimAmount}>
                    {account ? formatReading(data.pending) : '-'}
                    <small>{SYMBOL}</small>
                  </span>
                  {claimWhenText && <span className={local.claimWhen}>{claimWhenText}</span>}
                </div>
                <Button onClick={claim} loading={claimTx.busy}>
                  보상 받기
                </Button>
              </div>
              <InlineError message={claimError} />
              <TxStatus state={claimTx.state} />
            </section>

            <section className={local.manageItem} aria-labelledby="staking-exit">
              <h3 id="staking-exit" className={local.manageTitle}>
                전체 인출
              </h3>
              <p className={local.manageDesc}>스테이킹한 wMST를 모두 인출하고, 받을 수 있는 보상이 있으면 함께 받습니다.</p>
              <Button variant="secondary" onClick={exit} loading={exitTx.busy}>
                전체 인출
              </Button>
              <InlineError message={exitError} />
              <TxStatus state={exitTx.state} />
            </section>
          </div>
        </Card>
      </div>

      <aside className={styles.aside} aria-label="잔액과 스테이킹 현황">
        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>잔액·스테이킹 현황</h2>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => void refresh()}
              disabled={!account || loading}
              aria-label="잔액 새로고침"
            >
              <ArrowClockwiseIcon className={loading ? styles.spinning : undefined} size={16} aria-hidden />
            </button>
          </div>
          {account ? (
            <>
              <div className={styles.metrics}>
                <Metric label={`${SYMBOL} · ${NETWORK.name}`} value={formatReading(data.native)} unit={SYMBOL} />
                <Metric label="wMST" value={formatReading(data.wrapped)} unit="wMST" />
                <Metric label="스테이킹 중" value={formatReading(data.staked)} unit="wMST" />
                <Metric label="받을 보상" value={formatReading(data.pending)} unit={SYMBOL} />
              </div>
              <div className={styles.divider} style={{ margin: '18px 0' }} />
              <KeyValueList
                items={[
                  { label: '마지막 보상 수령', value: lastClaimText },
                  { label: '다음 수령 가능', value: nextClaimValue },
                ]}
              />
            </>
          ) : (
            <p className={styles.panelNote} style={{ marginTop: 0 }}>
              지갑을 연결하면 잔액과 스테이킹 현황을 보여 드립니다.
            </p>
          )}
          {anyError && <p className={styles.panelNote}>일부 정보를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 새로고침하세요.</p>}
          {data.checkedAt && <p className={styles.panelNote}>{formatDateTime(data.checkedAt)} 기준</p>}
        </Card>

        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>상품 조건</h2>
          </div>
          <KeyValueList
            items={[
              { label: '연 보상률(APR)', value: `${APR}%` },
              { label: '보상 수령 주기', value: `${CLAIM_DAYS}일` },
              { label: '보상 토큰', value: SYMBOL },
            ]}
          />
          <p className={styles.panelNote}>보상 {SYMBOL}는 rewardWallet에서 transferFrom 방식으로 지급됩니다.</p>
        </Card>

        <Card>
          <details className={styles.details} style={{ borderTop: 0, paddingTop: 0 }}>
            <summary>컨트랙트 정보</summary>
            <KeyValueList
              stacked
              items={[
                {
                  label: `wMST · ${NETWORK.name}`,
                  value: STAKING.wrappedToken,
                  mono: true,
                  action: <CopyButton value={STAKING.wrappedToken} label="주소 복사" iconOnly />,
                },
                {
                  label: `스테이킹 · ${NETWORK.name}`,
                  value: STAKING.staking,
                  mono: true,
                  action: <CopyButton value={STAKING.staking} label="주소 복사" iconOnly />,
                },
              ]}
            />
          </details>
        </Card>
      </aside>
    </div>
  )
}
