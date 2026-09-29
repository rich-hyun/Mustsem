'use client'

import { ArrowSquareOutIcon, CloudArrowUpIcon } from '@phosphor-icons/react/ssr'
import { Contract } from 'ethers'
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { RWA_ABI, RWA_CONTRACTS } from '@/config/contracts'
import { API_BASE, IPFS_GATEWAY } from '@/config/site'
import { CodeOutput } from '@/components/tools/CodeOutput'
import { ToolStep, ToolSteps } from '@/components/tools/ToolStep'
import { checkAddress } from '@/components/tools/validation'
import { WalletHint } from '@/components/tools/WalletHint'
import { TxStatus } from '@/components/tx/TxStatus'
import { useTx } from '@/components/tx/useTx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { KeyValueList, type KeyValueItem } from '@/components/ui/DataDisplay'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Tabs } from '@/components/ui/Tabs'
import { NetworkPicker } from '@/components/wallet/NetworkPicker'
import { useSigner } from '@/components/wallet/useSigner'
import { useWallet } from '@/components/wallet/WalletProvider'
import { rwaEthers, rwaSolidity } from '@/lib/codegen'
import { cx } from '@/lib/cx'
import { describeError, logDevError, UserFacingError } from '@/lib/errors'
import { formatFileSize } from '@/lib/format'
import styles from '@/components/tools/Tool.module.css'
import parts from '@/components/tools/ToolParts.module.css'
import rwa from './Rwa.module.css'
import { assertDeployed } from '@/lib/web3'

/** IPFS CID: v0(Qm…)·v1(bafy…) 모두 영문·숫자로만 이루어진다 */
const CID_PATTERN = /^[A-Za-z0-9]{46,100}$/
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

interface UploadResult {
  cid: string
  /** 토큰에 기록할 IPFS URI */
  tokenUri: string
  gatewayUrl: string | null
  fileName: string
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; percent: number | null }
  | { phase: 'done'; result: UploadResult }
  | { phase: 'failed'; message: string }

type CodeTab = 'solidity' | 'ethers'

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** 업로드 응답에서 필요한 값만 꺼낸다. 형식이 다르면 null (응답 원문은 화면에 쓰지 않는다) */
function readUploadResponse(text: string): Omit<UploadResult, 'fileName'> | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { cid, ipfs, gateway } = data as Record<string, unknown>
  if (typeof cid !== 'string' || !/^[A-Za-z0-9]{10,128}$/.test(cid.trim())) return null
  const cleanCid = cid.trim()
  const tokenUri = typeof ipfs === 'string' && /^\S{1,300}$/.test(ipfs.trim()) ? ipfs.trim() : `ipfs://${cleanCid}`
  const gatewayUrl = typeof gateway === 'string' && isHttpsUrl(gateway.trim()) ? gateway.trim() : null
  return { cid: cleanCid, tokenUri, gatewayUrl }
}

/** 원본 파일을 업로드 서버로 보내 IPFS CID를 받는다 (진행률 표시를 위해 XHR 사용) */
function uploadFile(
  file: File,
  onProgress: (percent: number | null) => void,
  holder: { current: XMLHttpRequest | null },
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    holder.current = xhr
    const settle = () => {
      holder.current = null
    }

    xhr.open('POST', `${API_BASE}/upload`)
    xhr.timeout = UPLOAD_TIMEOUT_MS
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable ? Math.round((event.loaded / event.total) * 100) : null)
    }
    xhr.onload = () => {
      settle()
      if (xhr.status === 413) return reject(new UserFacingError('파일이 너무 큽니다. 더 작은 파일로 다시 시도하세요.'))
      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new UserFacingError('업로드에 실패했습니다. 잠시 후 다시 시도하세요.'))
      }
      const parsed = readUploadResponse(xhr.responseText)
      if (!parsed) return reject(new UserFacingError('업로드 결과를 확인하지 못했습니다. 잠시 후 다시 시도하세요.'))
      resolve({ ...parsed, fileName: file.name })
    }
    xhr.onerror = () => {
      settle()
      reject(new UserFacingError('업로드 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.'))
    }
    xhr.ontimeout = () => {
      settle()
      reject(new UserFacingError('업로드 시간이 초과되었습니다. 잠시 후 다시 시도하세요.'))
    }
    xhr.onabort = () => {
      settle()
      reject(new UserFacingError('업로드를 취소했습니다.'))
    }

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export function RwaTool() {
  const wallet = useWallet()
  const requireSigner = useSigner()
  const target = wallet.targetNetwork
  const contractAddress = RWA_CONTRACTS[target.key]
  const account = wallet.status === 'connected' ? wallet.account : null

  // ① 원본 파일 업로드
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' })
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  useEffect(() => () => xhrRef.current?.abort(), [])

  // ② 받는 주소와 코드
  const [to, setTo] = useState('')
  const [toError, setToError] = useState<string | null>(null)
  const [codeTab, setCodeTab] = useState<CodeTab>('solidity')

  // ③ 민팅
  const [blocked, setBlocked] = useState<string | null>(null)
  const [details, setDetails] = useState<KeyValueItem[] | null>(null)
  const mintTx = useTx()

  // 원본 열기
  const [cidInput, setCidInput] = useState('')
  const [cidError, setCidError] = useState<string | null>(null)

  const uploading = upload.phase === 'uploading'
  const uploaded = upload.phase === 'done' ? upload.result : null

  const recipient = useMemo(() => {
    const checked = checkAddress(to, '받는 지갑 주소')
    return checked.ok ? checked.value : null
  }, [to])

  const snippets = useMemo(() => {
    if (!uploaded || !recipient) return null
    const input = { network: target, contract: contractAddress, to: recipient, tokenUri: uploaded.tokenUri }
    return { solidity: rwaSolidity(input), ethers: rwaEthers(input) }
  }, [uploaded, recipient, target, contractAddress])

  const pickFile = (next: File | null) => {
    if (uploading) return
    setFile(next)
    setUpload({ phase: 'idle' })
  }

  const startUpload = async () => {
    if (!file) {
      setUpload({ phase: 'failed', message: '업로드할 파일을 선택하세요.' })
      return
    }
    setUpload({ phase: 'uploading', percent: 0 })
    try {
      const result = await uploadFile(file, (percent) => setUpload({ phase: 'uploading', percent }), xhrRef)
      setUpload({ phase: 'done', result })
    } catch (error) {
      logDevError('rwa:upload', error)
      setUpload({ phase: 'failed', message: describeError(error) })
    }
  }

  const mint = async () => {
    setBlocked(null)
    if (!uploaded) {
      setBlocked('먼저 1단계에서 원본 파일을 업로드하세요.')
      return
    }
    const checked = checkAddress(to, '받는 지갑 주소')
    if (!checked.ok) {
      setToError(checked.message)
      setBlocked('2단계에서 받는 지갑 주소를 확인하세요.')
      return
    }
    if (!contractAddress) {
      setBlocked(`${target.name} 네트워크에는 아직 RWA 컨트랙트가 배포되지 않았습니다. 다른 네트워크를 선택하세요.`)
      return
    }

    const network = target
    const recipientAddress = checked.value
    const { cid, tokenUri } = uploaded
    setDetails(null)
    let predicted: string | null = null

    await mintTx.run(
      'RWA 민팅',
      async () => {
        await assertDeployed(network, contractAddress, 'RWA')
        const signer = await requireSigner(network)
        const token = new Contract(contractAddress, RWA_ABI, signer)
        // 다음 발행 번호를 먼저 읽어 두면 이벤트 로그 없이도 토큰 번호를 알 수 있다
        predicted = String(await token.getFunction('nextId')())
        setDetails([
          { label: 'Token ID', value: predicted },
          { label: '네트워크', value: `${network.name} (체인 ID ${network.chainId})` },
          {
            label: 'RWA 컨트랙트',
            value: contractAddress,
            mono: true,
            action: <CopyButton value={contractAddress} label="컨트랙트 주소 복사" iconOnly />,
          },
          { label: 'CID', value: cid, mono: true, action: <CopyButton value={cid} label="CID 복사" iconOnly /> },
          { label: 'IPFS URI', value: tokenUri, mono: true },
          { label: '받는 주소', value: recipientAddress, mono: true },
        ])
        return token.getFunction('mintRWA')(recipientAddress, tokenUri)
      },
      { note: () => (predicted ? `Token ID ${predicted}` : undefined) },
    )
  }

  const openOriginal = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cid = cidInput.trim()
    if (!CID_PATTERN.test(cid)) {
      setCidError('CID 형식이 올바르지 않습니다. Qm 또는 bafy로 시작하는 영문·숫자 조합인지 확인하세요.')
      return
    }
    setCidError(null)
    window.open(`${IPFS_GATEWAY}/${encodeURIComponent(cid)}`, '_blank', 'noopener,noreferrer')
  }

  const fillMine = account ? (
    <button
      type="button"
      className={styles.maxButton}
      onClick={() => {
        setTo(account)
        setToError(null)
      }}
    >
      내 주소
    </button>
  ) : undefined

  const codeEmptyText = uploaded
    ? '받는 지갑 주소를 입력하면 선택한 네트워크의 호출 코드가 만들어집니다.'
    : '1단계에서 원본 파일을 업로드하면 코드가 만들어집니다.'

  const uploadItems: KeyValueItem[] = uploaded
    ? [
        { label: 'CID', value: uploaded.cid, mono: true, action: <CopyButton value={uploaded.cid} label="CID 복사" iconOnly /> },
        {
          label: 'IPFS URI',
          value: uploaded.tokenUri,
          mono: true,
          action: <CopyButton value={uploaded.tokenUri} label="IPFS URI 복사" iconOnly />,
        },
        ...(uploaded.gatewayUrl
          ? [
              {
                label: '게이트웨이 URL',
                value: (
                  <a className={rwa.link} href={uploaded.gatewayUrl} target="_blank" rel="noopener noreferrer">
                    {uploaded.gatewayUrl}
                  </a>
                ),
                mono: true,
                action: <CopyButton value={uploaded.gatewayUrl} label="게이트웨이 URL 복사" iconOnly />,
              },
            ]
          : []),
      ]
    : []

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>대상 네트워크</h2>
          </div>
          <NetworkPicker contracts={RWA_CONTRACTS} contractLabel="RWA 컨트랙트" />
        </Card>

        <h2 className="sr-only">RWA 발행 단계</h2>
        <ToolSteps label="RWA 발행 단계">
          <ToolStep
            index={1}
            title="원본 파일 업로드"
            meta="파일 → IPFS"
            done={Boolean(uploaded)}
            description="실물 자산의 원본 파일(이미지·PDF 등)을 IPFS에 올리고 콘텐츠 식별자(CID)를 만듭니다."
          >
            <label
              className={cx(rwa.dropzone, dragging && rwa.dragging, uploading && rwa.locked)}
              onDragOver={(event) => {
                event.preventDefault()
                if (!uploading) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                pickFile(event.dataTransfer.files[0] ?? null)
              }}
            >
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  pickFile(event.target.files?.[0] ?? null)
                  event.target.value = ''
                }}
              />
              <CloudArrowUpIcon className={rwa.dropIcon} size={28} aria-hidden />
              {file ? (
                <>
                  <span className={rwa.dropTitle}>{file.name}</span>
                  <span className={rwa.dropMeta}>{formatFileSize(file.size)} · 다른 파일을 고르려면 누르세요</span>
                </>
              ) : (
                <>
                  <span className={rwa.dropTitle}>파일을 선택하거나 여기로 끌어 놓으세요</span>
                  <span className={rwa.dropMeta}>이미지·PDF 등 실물 자산의 원본 파일</span>
                </>
              )}
            </label>

            <div className={styles.actions} style={{ marginTop: 16 }}>
              <Button onClick={startUpload} loading={uploading}>
                업로드 & CID 생성
              </Button>
            </div>

            {upload.phase === 'uploading' && (
              <>
                <div
                  className={cx(rwa.progress, upload.percent === null && rwa.indeterminate)}
                  role="progressbar"
                  aria-label="업로드 진행률"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={upload.percent ?? undefined}
                >
                  <div className={rwa.progressFill} style={{ width: `${upload.percent ?? 0}%` }} />
                </div>
                <p className={rwa.progressText} aria-live="polite">
                  {upload.percent === null ? '업로드 중…' : `${upload.percent}% 업로드 중`}
                </p>
              </>
            )}
            {upload.phase === 'failed' && (
              <Notice tone="danger" live className={rwa.feedback}>
                {upload.message}
              </Notice>
            )}
            {uploaded && (
              <div className={cx(styles.summary, rwa.feedback)}>
                <KeyValueList items={uploadItems} />
              </div>
            )}
          </ToolStep>

          <ToolStep
            index={2}
            title="받는 주소와 코드"
            meta="IPFS URI 연결"
            done={Boolean(snippets)}
            description="RWA 토큰을 받을 지갑 주소를 입력하세요. 업로드한 파일의 IPFS URI로 선택한 네트워크의 호출 코드를 만들어 드립니다."
          >
            <TextField
              label="받는 지갑 주소"
              mono
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setToError(null)
              }}
              onBlur={() => {
                if (!to.trim()) return
                const checked = checkAddress(to, '받는 지갑 주소')
                setToError(checked.ok ? null : checked.message)
              }}
              error={toError}
              trailingWidth={72}
              trailing={fillMine}
            />
            <div className={rwa.codeArea}>
              <Tabs
                label="코드 스니펫"
                value={codeTab}
                onChange={(id) => (id === 'solidity' || id === 'ethers') && setCodeTab(id)}
                items={[
                  {
                    id: 'solidity',
                    label: 'Solidity',
                    content: <CodeOutput code={snippets?.solidity ?? null} title={`Solidity · ${target.name}`} emptyText={codeEmptyText} />,
                  },
                  {
                    id: 'ethers',
                    label: 'ethers.js',
                    content: <CodeOutput code={snippets?.ethers ?? null} title={`ethers.js · ${target.name}`} emptyText={codeEmptyText} />,
                  },
                ]}
              />
            </div>
          </ToolStep>

          <ToolStep
            index={3}
            title="온체인 민팅"
            meta="RWA 토큰 발행"
            done={mintTx.state.phase === 'confirmed'}
            description="선택한 네트워크의 RWA 컨트랙트로 토큰을 발행합니다. 토큰에는 업로드한 파일의 IPFS URI가 기록됩니다."
          >
            <div className={styles.summary}>
              <KeyValueList
                items={[
                  { label: '네트워크', value: `${target.name} (체인 ID ${target.chainId})` },
                  {
                    label: 'RWA 컨트랙트',
                    value: contractAddress ?? '이 네트워크에는 아직 배포되지 않았습니다',
                    mono: Boolean(contractAddress),
                  },
                  { label: '토큰 URI', value: uploaded ? uploaded.tokenUri : '1단계 업로드 후 표시', mono: Boolean(uploaded) },
                  { label: '받는 주소', value: recipient ?? '2단계에서 입력', mono: Boolean(recipient) },
                ]}
              />
            </div>
            <div className={parts.stack}>
              <WalletHint action="민팅" />
              {blocked && (
                <Notice tone="warning" live>
                  {blocked}
                </Notice>
              )}
            </div>
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <Button onClick={mint} loading={mintTx.busy}>
                RWA 민팅 실행
              </Button>
            </div>
            <TxStatus state={mintTx.state} />
            {details && mintTx.state.phase !== 'idle' && mintTx.state.phase !== 'failed' && (
              <div className={rwa.feedback}>
                <KeyValueList items={details} />
              </div>
            )}
          </ToolStep>
        </ToolSteps>
      </div>

      <aside className={styles.aside} aria-label="IPFS 원본 파일 열기">
        <Card>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>IPFS 원본 파일 열기</h2>
          </div>
          <form className={styles.form} onSubmit={openOriginal} noValidate>
            <TextField
              label="CID"
              mono
              autoComplete="off"
              spellCheck={false}
              placeholder="Qm… 또는 bafy…"
              value={cidInput}
              onChange={(event) => {
                setCidInput(event.target.value)
                setCidError(null)
              }}
              error={cidError}
              hint="CID로 IPFS에 저장된 원본 파일을 새 탭에서 엽니다."
              trailingWidth={108}
              trailing={
                uploaded ? (
                  <button
                    type="button"
                    className={styles.maxButton}
                    onClick={() => {
                      setCidInput(uploaded.cid)
                      setCidError(null)
                    }}
                  >
                    방금 올린 파일
                  </button>
                ) : undefined
              }
            />
            <Button type="submit" variant="secondary" block>
              원본 열기
              <ArrowSquareOutIcon size={16} aria-hidden />
            </Button>
          </form>
        </Card>
      </aside>
    </div>
  )
}
