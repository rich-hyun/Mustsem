'use client'

import { Contract } from 'ethers'
import { useState } from 'react'
import { SBT_ABI, SBT_CONTRACTS } from '@/config/contracts'
import { CodeOutput } from '@/components/tools/CodeOutput'
import { MintOutcome } from '@/components/tools/MintOutcome'
import { checkAddress, checkRequired } from '@/components/tools/validation'
import { WalletHint } from '@/components/tools/WalletHint'
import { useTx } from '@/components/tx/useTx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import type { KeyValueItem } from '@/components/ui/DataDisplay'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Tabs } from '@/components/ui/Tabs'
import { NetworkPicker } from '@/components/wallet/NetworkPicker'
import { useSigner } from '@/components/wallet/useSigner'
import { useWallet } from '@/components/wallet/WalletProvider'
import { sbtSolidity } from '@/lib/codegen'
import styles from '@/components/tools/Tool.module.css'
import parts from '@/components/tools/ToolParts.module.css'
import { assertDeployed } from '@/lib/web3'

type TabId = 'result' | 'solidity'
type FieldName = 'to' | 'name' | 'guardian'
type FieldErrors = Partial<Record<FieldName, string>>

/** unlockTime 0 = 영구 귀속, 메타데이터는 기존과 같이 빈 객체로 발급한다 */
const UNLOCK_TIME = 0n
const EMPTY_METADATA = '{}'

const isTab = (value: string): value is TabId => value === 'result' || value === 'solidity'

export function SbtTool() {
  const wallet = useWallet()
  const requireSigner = useSigner()
  const target = wallet.targetNetwork
  const contractAddress = SBT_CONTRACTS[target.key]

  const [to, setTo] = useState('')
  const [name, setName] = useState('')
  const [guardian, setGuardian] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [blocked, setBlocked] = useState<string | null>(null)

  const [tab, setTab] = useState<TabId>('result')
  const [solidity, setSolidity] = useState<{ code: string; network: string } | null>(null)
  const [details, setDetails] = useState<KeyValueItem[] | null>(null)
  const mintTx = useTx()

  const clearError = (field: FieldName) => setErrors((prev) => ({ ...prev, [field]: undefined }))

  const validate = () => {
    const recipient = checkAddress(to, '받는 지갑 주소')
    const label = checkRequired(name, 'SBT 이름을 입력하세요.')
    const guard = checkAddress(guardian, '가디언 주소')
    setErrors({
      to: recipient.ok ? undefined : recipient.message,
      name: label.ok ? undefined : label.message,
      guardian: guard.ok ? undefined : guard.message,
    })
    if (!recipient.ok || !label.ok || !guard.ok) return null
    return { to: recipient.value, name: label.value, guardian: guard.value }
  }

  const mint = async () => {
    setBlocked(null)
    const input = validate()
    if (!input) return
    if (!contractAddress) {
      setBlocked(`${target.name} 네트워크에는 아직 SBT 컨트랙트가 배포되지 않았습니다. 다른 네트워크를 선택하세요.`)
      return
    }
    const network = target
    setTab('result')
    setDetails(null)
    let predicted: string | null = null

    await mintTx.run(
      'SBT 발행',
      async () => {
        await assertDeployed(network, contractAddress, 'SBT')
        const signer = await requireSigner(network)
        const mintSbt = new Contract(contractAddress, SBT_ABI, signer).getFunction('mintSBT')
        const args = [input.to, input.name, input.guardian, UNLOCK_TIME, EMPTY_METADATA] as const
        // 이 네트워크는 이벤트 로그를 읽을 수 없어, 모의 실행으로 토큰 번호를 먼저 계산한다
        predicted = String(await mintSbt.staticCall(...args))
        setDetails([
          { label: 'Token ID', value: predicted },
          { label: '네트워크', value: `${network.name} (체인 ID ${network.chainId})` },
          {
            label: 'SBT 컨트랙트',
            value: contractAddress,
            mono: true,
            action: <CopyButton value={contractAddress} label="컨트랙트 주소 복사" iconOnly />,
          },
          { label: '받는 주소', value: input.to, mono: true },
          { label: '가디언', value: input.guardian, mono: true },
          { label: '이름', value: input.name },
        ])
        return mintSbt(...args)
      },
      { note: () => (predicted ? `Token ID ${predicted}` : undefined) },
    )
  }

  const generateSolidity = () => {
    const input = validate()
    if (!input) return
    setSolidity({
      code: sbtSolidity({ network: target, contract: contractAddress, to: input.to, label: input.name, guardian: input.guardian }),
      network: target.name,
    })
    setTab('solidity')
  }

  const account = wallet.status === 'connected' ? wallet.account : null
  const fillMine = (setter: (value: string) => void, field: FieldName) =>
    account ? (
      <button
        type="button"
        className={styles.maxButton}
        onClick={() => {
          setter(account)
          clearError(field)
        }}
      >
        내 주소
      </button>
    ) : undefined

  return (
    <div className={styles.main}>
      <Card>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>대상 네트워크</h2>
        </div>
        <NetworkPicker contracts={SBT_CONTRACTS} contractLabel="SBT 컨트랙트" />
      </Card>

      <div className={styles.split}>
        <Card elevation="raised" padding="lg">
          <div className={styles.stepHead}>
            <h2 className={styles.stepTitle}>발급 정보</h2>
          </div>
          <p className={styles.stepDesc}>
            SBT는 발급된 지갑에 영구 귀속되어 다른 지갑으로 옮길 수 없습니다. 받는 지갑과 이름, 가디언 지갑 1개를 지정하세요.
          </p>

          <div className={styles.form}>
            <TextField
              label="받는 지갑 주소"
              mono
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                clearError('to')
              }}
              error={errors.to}
              trailingWidth={72}
              trailing={fillMine(setTo, 'to')}
            />
            <TextField
              label="SBT 이름"
              autoComplete="off"
              placeholder="예: Certification"
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
              error={errors.name}
            />
            <TextField
              label="가디언 주소"
              mono
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={guardian}
              onChange={(event) => {
                setGuardian(event.target.value)
                clearError('guardian')
              }}
              error={errors.guardian}
              hint="가디언은 1명만 지정합니다."
              trailingWidth={72}
              trailing={fillMine(setGuardian, 'guardian')}
            />
          </div>

          <div className={parts.stack}>
            <WalletHint action="발급" />
            {blocked && (
              <Notice tone="warning" live>
                {blocked}
              </Notice>
            )}
          </div>

          <div className={parts.buttonRow}>
            <Button onClick={mint} loading={mintTx.busy}>
              SBT 발급
            </Button>
            <Button variant="secondary" onClick={generateSolidity}>
              Solidity 코드 생성
            </Button>
          </div>
        </Card>

        <Card padding="lg">
          <div className={styles.stepHead}>
            <h2 className={styles.stepTitle}>결과</h2>
          </div>
          <Tabs
            label="결과 보기"
            value={tab}
            onChange={(id) => isTab(id) && setTab(id)}
            items={[
              {
                id: 'result',
                label: '실행 결과',
                content: (
                  <MintOutcome
                    state={mintTx.state}
                    details={details}
                    emptyText="발급을 실행하면 트랜잭션 진행 상태와 토큰 번호가 여기에 표시됩니다."
                  />
                ),
              },
              {
                id: 'solidity',
                label: 'Solidity',
                content: (
                  <CodeOutput
                    code={solidity?.code ?? null}
                    title={`Solidity · ${solidity?.network ?? ''}`}
                    emptyText="세 항목을 입력하고 Solidity 코드 생성을 누르면 선택한 네트워크의 발급 코드가 표시됩니다."
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
