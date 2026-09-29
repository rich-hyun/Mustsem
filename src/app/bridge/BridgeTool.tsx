'use client'

import { ArrowClockwiseIcon } from '@phosphor-icons/react/ssr'
import { Contract } from 'ethers'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BRIDGE, BRIDGE_REQUEST_ABI, WRAPPED_NATIVE_ABI } from '@/config/contracts'
import { getNetwork } from '@/config/networks'
import { ContractNotice } from '@/components/tools/ContractNotice'
import { IDLE_READING, formatReading, loadingFrom, settleReading, type Reading } from '@/components/tools/readings'
import { ToolStep, ToolSteps } from '@/components/tools/ToolStep'
import { TxStatus } from '@/components/tx/TxStatus'
import { useTx } from '@/components/tx/useTx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { KeyValueList, Metric } from '@/components/ui/DataDisplay'
import { TextField } from '@/components/ui/Field'
import { NetworkGate } from '@/components/wallet/NetworkGate'
import { useSigner } from '@/components/wallet/useSigner'
import { useWallet } from '@/components/wallet/WalletProvider'
import { parseAmount, sanitizeAmountInput, toInputAmount } from '@/lib/amount'
import { formatDateTime } from '@/lib/format'
import { assertDeployed, readProvider, withTimeout } from '@/lib/web3'
import styles from '@/components/tools/Tool.module.css'

const SOURCE = getNetwork(BRIDGE.network)
const DESTINATION = getNetwork(BRIDGE.destinationNetwork)

interface Balances {
  native: Reading
  wrapped: Reading
  allowance: Reading
  destination: Reading
  checkedAt: number | null
}

const EMPTY_BALANCES: Balances = {
  native: IDLE_READING,
  wrapped: IDLE_READING,
  allowance: IDLE_READING,
  destination: IDLE_READING,
  checkedAt: null,
}

export function BridgeTool() {
  const wallet = useWallet()
  const requireSigner = useSigner()
  const account = wallet.status === 'connected' ? wallet.account : null

  const [balances, setBalances] = useState<Balances>(EMPTY_BALANCES)
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)

  const [wrapAmount, setWrapAmount] = useState('')
  const [wrapError, setWrapError] = useState<string | null>(null)
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgeError, setBridgeError] = useState<string | null>(null)

  const wrapTx = useTx()
  const approveTx = useTx()
  const requestTx = useTx()

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    if (!account) {
      setBalances(EMPTY_BALANCES)
      return
    }
    setLoading(true)
    setBalances((prev) => ({
      ...prev,
      native: loadingFrom(prev.native),
      wrapped: loadingFrom(prev.wrapped),
      allowance: loadingFrom(prev.allowance),
      destination: loadingFrom(prev.destination),
    }))

    const walletState = { provider: wallet.provider, chainId: wallet.chainId }
    const sourceReader = readProvider(SOURCE, walletState)
    const destinationReader = readProvider(DESTINATION, walletState)
    const wrapped = new Contract(BRIDGE.wrappedToken, WRAPPED_NATIVE_ABI, sourceReader)
    const destination = new Contract(BRIDGE.destinationToken, WRAPPED_NATIVE_ABI, destinationReader)

    const [native, wrappedBalance, allowance, destinationBalance] = await Promise.allSettled([
      withTimeout(sourceReader.getBalance(account)),
      withTimeout(wrapped.getFunction('balanceOf')(account)),
      withTimeout(wrapped.getFunction('allowance')(account, BRIDGE.requester)),
      withTimeout(destination.getFunction('balanceOf')(account)),
    ])
    if (seq !== requestSeq.current) return // 더 최근 조회가 시작됐다

    setBalances((prev) => ({
      native: settleReading(native, prev.native),
      wrapped: settleReading(wrappedBalance, prev.wrapped),
      allowance: settleReading(allowance, prev.allowance),
      destination: settleReading(destinationBalance, prev.destination),
      checkedAt: Date.now(),
    }))
    setLoading(false)
  }, [account, wallet.provider, wallet.chainId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const parsedBridge = parseAmount(bridgeAmount)
  const approvedEnough =
    parsedBridge.ok && balances.allowance.value !== undefined && balances.allowance.value >= parsedBridge.value

  const wrap = async () => {
    const parsed = parseAmount(wrapAmount)
    if (!parsed.ok) return setWrapError(parsed.message)
    if (balances.native.value !== undefined && parsed.value > balances.native.value) {
      return setWrapError('보유한 TMZ보다 많습니다.')
    }
    setWrapError(null)
    await wrapTx.run(
      'TMZ → wTMZ 래핑',
      async () => {
        await assertDeployed(SOURCE, BRIDGE.wrappedToken, 'wTMZ')
        const signer = await requireSigner(SOURCE)
        return new Contract(BRIDGE.wrappedToken, WRAPPED_NATIVE_ABI, signer).getFunction('deposit')({ value: parsed.value })
      },
      { onConfirmed: refresh },
    )
  }

  const approve = async () => {
    if (!parsedBridge.ok) return setBridgeError(parsedBridge.message)
    if (balances.wrapped.value !== undefined && parsedBridge.value > balances.wrapped.value) {
      return setBridgeError('보유한 wTMZ보다 많습니다.')
    }
    setBridgeError(null)
    const amount = parsedBridge.value
    await approveTx.run(
      'wTMZ 사용 승인',
      async () => {
        await assertDeployed(SOURCE, BRIDGE.wrappedToken, 'wTMZ')
        const signer = await requireSigner(SOURCE)
        return new Contract(BRIDGE.wrappedToken, WRAPPED_NATIVE_ABI, signer).getFunction('approve')(BRIDGE.requester, amount)
      },
      { onConfirmed: refresh },
    )
  }

  const request = async () => {
    if (!parsedBridge.ok) return setBridgeError(parsedBridge.message)
    if (balances.allowance.value !== undefined && parsedBridge.value > balances.allowance.value) {
      return setBridgeError('먼저 2단계에서 이 수량 이상을 승인하세요.')
    }
    setBridgeError(null)
    const amount = parsedBridge.value
    await requestTx.run(
      'wTMZ → wMST 브릿지 요청',
      async () => {
        await assertDeployed(SOURCE, BRIDGE.requester, '브릿지 요청')
        await assertDeployed(DESTINATION, BRIDGE.destinationToken, 'wMST')
        const signer = await requireSigner(SOURCE)
        const recipient = await signer.getAddress()
        return new Contract(BRIDGE.requester, BRIDGE_REQUEST_ABI, signer).getFunction('request')(amount, recipient)
      },
      { onConfirmed: refresh, note: () => '릴레이 처리 후 Mustsem 체인으로 wMST가 지급됩니다' },
    )
  }

  const anyError = [balances.native, balances.wrapped, balances.destination].some((r) => r.state === 'error')

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <NetworkGate network={SOURCE} />
        <ContractNotice
          network={SOURCE}
          contracts={[
            { label: 'wTMZ', address: BRIDGE.wrappedToken },
            { label: '브릿지 요청', address: BRIDGE.requester },
          ]}
        />
        <h2 className="sr-only">브릿지 실행 단계</h2>
        <ToolSteps label="브릿지 실행 단계">
          <ToolStep
            index={1}
            title="래핑"
            meta="TMZ → wTMZ"
            done={wrapTx.state.phase === 'confirmed'}
            description="브릿지에 사용할 wTMZ를 얻기 위해 TMZ를 1:1로 래핑합니다. 이미 wTMZ가 있다면 2단계로 넘어가세요."
          >
            <div className={styles.formRow}>
              <TextField
                label="래핑 수량"
                inputMode="decimal"
                autoComplete="off"
                placeholder="예: 1"
                value={wrapAmount}
                onChange={(event) => {
                  setWrapAmount(sanitizeAmountInput(event.target.value))
                  setWrapError(null)
                }}
                error={wrapError}
                labelAside={account ? `보유 ${formatReading(balances.native)} TMZ` : undefined}
                trailing="TMZ"
                trailingWidth={40}
              />
              <Button onClick={wrap} loading={wrapTx.busy}>
                wTMZ로 래핑
              </Button>
            </div>
            <TxStatus state={wrapTx.state} />
          </ToolStep>

          <ToolStep
            index={2}
            title="승인"
            meta="wTMZ 사용 승인"
            done={approvedEnough || approveTx.state.phase === 'confirmed'}
            description="브릿지 컨트랙트가 요청한 수량의 wTMZ를 가져갈 수 있도록 승인합니다."
          >
            <div className={styles.formRow}>
              <TextField
                label="브릿지 수량"
                inputMode="decimal"
                autoComplete="off"
                placeholder="예: 1"
                value={bridgeAmount}
                onChange={(event) => {
                  setBridgeAmount(sanitizeAmountInput(event.target.value))
                  setBridgeError(null)
                }}
                error={bridgeError}
                labelAside={account ? `승인됨 ${formatReading(balances.allowance)} wTMZ` : undefined}
                trailingWidth={96}
                trailing={
                  <>
                    <span>wTMZ</span>
                    {balances.wrapped.value !== undefined && balances.wrapped.value > 0n && (
                      <button
                        type="button"
                        className={styles.maxButton}
                        onClick={() => {
                          setBridgeAmount(toInputAmount(balances.wrapped.value ?? 0n))
                          setBridgeError(null)
                        }}
                      >
                        최대
                      </button>
                    )}
                  </>
                }
              />
              <Button variant="secondary" onClick={approve} loading={approveTx.busy}>
                승인
              </Button>
            </div>
            <TxStatus state={approveTx.state} />
          </ToolStep>

          <ToolStep
            index={3}
            title="브릿지 요청"
            meta="wTMZ → wMST"
            done={requestTx.state.phase === 'confirmed'}
            description="승인한 수량으로 브릿지를 요청합니다. 릴레이가 요청을 처리하면 Mustsem 체인의 같은 주소로 wMST가 지급됩니다."
          >
            <div className={styles.summary}>
              <KeyValueList
                items={[
                  { label: '요청 수량', value: parsedBridge.ok ? `${bridgeAmount} wTMZ` : '2단계에서 수량을 입력하세요' },
                  { label: '받는 주소', value: account ?? '지갑 연결 후 표시', mono: Boolean(account) },
                  { label: '도착 네트워크', value: `${DESTINATION.name} (체인 ID ${DESTINATION.chainId})` },
                ]}
              />
            </div>
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <Button onClick={request} loading={requestTx.busy}>
                브릿지 요청
              </Button>
            </div>
            <TxStatus state={requestTx.state} />
          </ToolStep>
        </ToolSteps>
      </div>

      <aside className={styles.aside} aria-label="잔액과 컨트랙트 정보">
        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>지갑 잔액</h2>
            <button type="button" className={styles.iconButton} onClick={() => void refresh()} disabled={!account || loading} aria-label="잔액 새로고침">
              <ArrowClockwiseIcon className={loading ? styles.spinning : undefined} size={16} aria-hidden />
            </button>
          </div>
          {account ? (
            <div className={styles.metrics}>
              <Metric label={`TMZ · ${SOURCE.name}`} value={formatReading(balances.native)} unit="TMZ" />
              <Metric label={`wTMZ · ${SOURCE.name}`} value={formatReading(balances.wrapped)} unit="wTMZ" />
              <Metric label={`wMST · ${DESTINATION.name}`} value={formatReading(balances.destination)} unit="wMST" />
            </div>
          ) : (
            <p className={styles.panelNote} style={{ marginTop: 0 }}>
              지갑을 연결하면 체인별 잔액을 보여 드립니다.
            </p>
          )}
          {anyError && <p className={styles.panelNote}>일부 잔액을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 새로고침하세요.</p>}
          {balances.checkedAt && (
            <p className={styles.panelNote}>
              wMST는 {DESTINATION.name} 체인에서 따로 조회합니다 · {formatDateTime(balances.checkedAt)} 기준
            </p>
          )}
        </Card>

        <Card>
          <details className={styles.details} style={{ borderTop: 0, paddingTop: 0 }}>
            <summary>컨트랙트 정보</summary>
            <KeyValueList
              stacked
              items={[
                { label: `wTMZ · ${SOURCE.name}`, value: BRIDGE.wrappedToken, mono: true, action: <CopyButton value={BRIDGE.wrappedToken} label="주소 복사" iconOnly /> },
                { label: `브릿지 요청 · ${SOURCE.name}`, value: BRIDGE.requester, mono: true, action: <CopyButton value={BRIDGE.requester} label="주소 복사" iconOnly /> },
                { label: `wMST · ${DESTINATION.name}`, value: BRIDGE.destinationToken, mono: true, action: <CopyButton value={BRIDGE.destinationToken} label="주소 복사" iconOnly /> },
              ]}
            />
          </details>
        </Card>
      </aside>
    </div>
  )
}
