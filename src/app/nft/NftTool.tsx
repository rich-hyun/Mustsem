'use client'

import { Contract } from 'ethers'
import { useState } from 'react'
import { NFT_ABI, NFT_CONTRACTS } from '@/config/contracts'
import { CodeOutput } from '@/components/tools/CodeOutput'
import { MintOutcome } from '@/components/tools/MintOutcome'
import { checkAddress, checkJson, checkRequired } from '@/components/tools/validation'
import { WalletHint } from '@/components/tools/WalletHint'
import { useTx } from '@/components/tx/useTx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import type { KeyValueItem } from '@/components/ui/DataDisplay'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Tabs } from '@/components/ui/Tabs'
import { NetworkPicker } from '@/components/wallet/NetworkPicker'
import { useSigner } from '@/components/wallet/useSigner'
import { useWallet } from '@/components/wallet/WalletProvider'
import { nftPython, nftSolidity } from '@/lib/codegen'
import styles from '@/components/tools/Tool.module.css'
import parts from '@/components/tools/ToolParts.module.css'
import { assertDeployed } from '@/lib/web3'

type TabId = 'result' | 'solidity' | 'python'
type FieldName = 'to' | 'name' | 'metadata'
type FieldErrors = Partial<Record<FieldName, string>>

interface GeneratedCode {
  code: string
  network: string
}

const isTab = (value: string): value is TabId => value === 'result' || value === 'solidity' || value === 'python'

export function NftTool() {
  const wallet = useWallet()
  const requireSigner = useSigner()
  const target = wallet.targetNetwork
  const contractAddress = NFT_CONTRACTS[target.key]

  const [to, setTo] = useState('')
  const [name, setName] = useState('')
  const [metadata, setMetadata] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [blocked, setBlocked] = useState<string | null>(null)

  const [tab, setTab] = useState<TabId>('result')
  const [solidity, setSolidity] = useState<GeneratedCode | null>(null)
  const [python, setPython] = useState<GeneratedCode | null>(null)
  const [pythonNote, setPythonNote] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)
  const [details, setDetails] = useState<KeyValueItem[] | null>(null)
  const mintTx = useTx()

  const clearError = (field: FieldName) => setErrors((prev) => ({ ...prev, [field]: undefined }))

  /** 세 입력을 한 번에 검증하고, 틀린 칸마다 오류를 표시한다 */
  const validate = () => {
    const recipient = checkAddress(to, '받는 지갑 주소')
    const label = checkRequired(name, 'NFT 이름을 입력하세요.')
    const json = checkJson(metadata)
    setErrors({
      to: recipient.ok ? undefined : recipient.message,
      name: label.ok ? undefined : label.message,
      metadata: json.ok ? undefined : json.message,
    })
    if (!recipient.ok || !label.ok || !json.ok) return null
    return { to: recipient.value, name: label.value, metadata: json.value }
  }

  const mint = async () => {
    setBlocked(null)
    const input = validate()
    if (!input) return
    if (!contractAddress) {
      setBlocked(`${target.name} 네트워크에는 아직 NFT 컨트랙트가 배포되지 않았습니다. 다른 네트워크를 선택하세요.`)
      return
    }
    const network = target
    setTab('result')
    setDetails(null)
    let predicted: string | null = null

    await mintTx.run(
      'NFT 발행',
      async () => {
        await assertDeployed(network, contractAddress, 'NFT')
        const signer = await requireSigner(network)
        const mintNft = new Contract(contractAddress, NFT_ABI, signer).getFunction('mintNFT')
        // 발행 전에 같은 호출을 모의 실행해 받게 될 토큰 번호를 먼저 계산한다
        predicted = String(await mintNft.staticCall(input.to, input.name, input.metadata))
        setDetails([
          { label: 'Token ID', value: predicted },
          { label: '네트워크', value: `${network.name} (체인 ID ${network.chainId})` },
          {
            label: 'NFT 컨트랙트',
            value: contractAddress,
            mono: true,
            action: <CopyButton value={contractAddress} label="컨트랙트 주소 복사" iconOnly />,
          },
          { label: '받는 주소', value: input.to, mono: true },
          { label: '이름', value: input.name },
        ])
        return mintNft(input.to, input.name, input.metadata)
      },
      { note: () => (predicted ? `Token ID ${predicted}` : undefined) },
    )
  }

  const generateSolidity = () => {
    const input = validate()
    if (!input) return
    setSolidity({
      code: nftSolidity({ network: target, contract: contractAddress, to: input.to, label: input.name, metadata: input.metadata }),
      network: target.name,
    })
    setTab('solidity')
  }

  const generatePython = async () => {
    const input = validate()
    if (!input) return
    const code = nftPython({ network: target, contract: contractAddress, to: input.to, label: input.name, metadata: input.metadata })
    setPython({ code, network: target.name })
    setTab('python')
    try {
      await navigator.clipboard.writeText(code)
      setPythonNote({ tone: 'success', text: '스크립트를 클립보드에 복사했습니다. 개인키는 환경변수 MUSTSEM_PRIVATE_KEY로 넣어 실행하세요.' })
    } catch {
      setPythonNote({ tone: 'warning', text: '브라우저가 자동 복사를 막았습니다. 코드 블록의 복사 버튼을 사용하세요.' })
    }
  }

  const account = wallet.status === 'connected' ? wallet.account : null

  return (
    <div className={styles.main}>
      <Card>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>대상 네트워크</h2>
        </div>
        <NetworkPicker contracts={NFT_CONTRACTS} contractLabel="NFT 컨트랙트" />
      </Card>

      <div className={styles.split}>
        <Card elevation="raised" padding="lg">
          <div className={styles.stepHead}>
            <h2 className={styles.stepTitle}>발행 정보</h2>
          </div>
          <p className={styles.stepDesc}>
            받는 지갑과 NFT 이름, 메타데이터를 입력하세요. 같은 정보로 Solidity 코드와 Python 발행 스크립트도 만들 수 있습니다.
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
              trailing={
                account ? (
                  <button
                    type="button"
                    className={styles.maxButton}
                    onClick={() => {
                      setTo(account)
                      clearError('to')
                    }}
                  >
                    내 주소
                  </button>
                ) : undefined
              }
            />
            <TextField
              label="NFT 이름"
              autoComplete="off"
              placeholder="예: MyNFT"
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
              error={errors.name}
            />
            <TextAreaField
              label="메타데이터 (JSON)"
              optional
              mono
              rows={4}
              spellCheck={false}
              placeholder='예: {"img":"https://…","desc":"…"}'
              value={metadata}
              onChange={(event) => {
                setMetadata(event.target.value)
                clearError('metadata')
              }}
              error={errors.metadata}
              hint="비워 두면 {} 로 발행합니다."
            />
          </div>

          <div className={parts.stack}>
            <WalletHint action="발행" />
            {blocked && (
              <Notice tone="warning" live>
                {blocked}
              </Notice>
            )}
          </div>

          <div className={parts.buttonRow}>
            <Button onClick={mint} loading={mintTx.busy}>
              NFT 발행
            </Button>
            <Button variant="secondary" onClick={generateSolidity}>
              Solidity 코드 생성
            </Button>
            <Button variant="secondary" onClick={generatePython}>
              Python 스크립트
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
                    emptyText="발행을 실행하면 트랜잭션 진행 상태와 토큰 번호가 여기에 표시됩니다."
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
                    emptyText="받는 주소와 이름을 입력하고 Solidity 코드 생성을 누르면 선택한 네트워크의 발행 코드가 표시됩니다."
                  />
                ),
              },
              {
                id: 'python',
                label: 'Python',
                content: (
                  <>
                    {pythonNote && python && (
                      <Notice tone={pythonNote.tone} className={parts.note} live>
                        {pythonNote.text}
                      </Notice>
                    )}
                    <CodeOutput
                      code={python?.code ?? null}
                      title={`Python · ${python?.network ?? ''}`}
                      emptyText="Python 스크립트를 누르면 web3.py 발행 스크립트가 표시되고 클립보드에 복사됩니다."
                    />
                  </>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
