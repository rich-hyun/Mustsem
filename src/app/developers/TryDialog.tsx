'use client'

/**
 * 조회 API 호출해 보기. 이 사이트 서버의 /api/v1/...를 실제로 호출해 응답을 그대로 보여 준다.
 * 체인을 읽기만 하는 API라 지갑이나 API 키가 필요 없다.
 */
import { PlayIcon } from '@phosphor-icons/react/ssr'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, CodeBlock } from '@/components/ui/DataDisplay'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import type { ApiEndpoint } from '@/content/api-catalog'
import { logDevError } from '@/lib/errors'
import styles from './developers.module.css'

/** 서버 오류 코드 → 화면 문구 (원문은 싣지 않는다) */
const ERROR_TEXT: Record<string, string> = {
  bad_request: '입력값을 확인하세요. 주소는 0x로 시작하는 40자리, 해시는 64자리여야 합니다.',
  unknown_network: '지원하지 않는 체인 ID입니다.',
  not_found: '해당 값을 체인에서 찾지 못했습니다.',
  contract_not_deployed: '이 네트워크에 해당 컨트랙트가 아직 배포되지 않았습니다. 배포 후 주소를 설정하면 이 API가 그 컨트랙트를 읽습니다.',
  unsupported: '이 컨트랙트는 요청한 조회를 지원하지 않습니다.',
  rpc_unavailable: '네트워크(RPC)가 응답하지 않습니다. 잠시 후 다시 시도하세요.',
  upstream_unavailable: '외부 시세를 받아오지 못했습니다. 잠시 후 다시 시도하세요.',
}
const FAILED = '요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'

interface Outcome {
  status: number
  ms: number
  body: string
  error: string | null
}

export function TryDialog({ endpoint, onClose }: { endpoint: ApiEndpoint | null; onClose: () => void }) {
  // 닫히는 동안에도 내용이 비지 않게 마지막 대상을 들고 있는다
  const [shown, setShown] = useState<ApiEndpoint | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (!endpoint) return
    setShown(endpoint)
    setValues(Object.fromEntries((endpoint.tryIt ?? []).map((field) => [field.name, field.value])))
    setOutcome(null)
    setRunning(false)
  }, [endpoint])

  const fields = shown?.tryIt ?? []
  const query = new URLSearchParams(fields.flatMap((field) => ((values[field.name] ?? '').trim() ? [[field.name, (values[field.name] ?? '').trim()]] : [])))
  const url = shown ? `/api${shown.path}${query.size ? `?${query.toString()}` : ''}` : ''

  const run = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!shown || running) return
    setRunning(true)
    setOutcome(null)
    const started = performance.now()
    try {
      const response = await fetch(url, { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      setOutcome({
        status: response.status,
        ms: Math.round(performance.now() - started),
        body: body ? JSON.stringify(body, null, 2) : '',
        error: response.ok && body?.ok ? null : (body?.error && ERROR_TEXT[body.error]) || FAILED,
      })
    } catch (caught) {
      logDevError('api:try', caught)
      setOutcome({ status: 0, ms: Math.round(performance.now() - started), body: '', error: FAILED })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={endpoint !== null} onClose={onClose} title={shown ? `${shown.name} 호출해 보기` : '호출해 보기'} size="lg">
      {shown && (
        <form className={styles.try} onSubmit={run} noValidate>
          <p className={styles.tryLead}>
            이 사이트 서버가 체인을 직접 읽어 응답합니다. 조회 전용이라 지갑 연결이나 API 키가 필요 없습니다.
          </p>
          {fields.length > 0 && (
            <div className={styles.tryFields}>
              {fields.map((field) => (
                <TextField
                  key={field.name}
                  id={`try-${field.name}`}
                  label={field.name}
                  hint={field.hint}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={140}
                  value={values[field.name] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              ))}
            </div>
          )}
          <div className={styles.tryRequest}>
            <Badge tone="accent" mono>
              GET
            </Badge>
            <code className={styles.tryUrl} data-break="anywhere">
              {url}
            </code>
            <Button type="submit" size="sm" loading={running}>
              {!running && <PlayIcon size={14} weight="fill" aria-hidden />}
              호출
            </Button>
          </div>
          <div aria-live="polite">
            {outcome?.error && <Notice tone={outcome.status === 404 ? 'info' : 'danger'}>{outcome.error}</Notice>}
            {outcome?.body && (
              <CodeBlock
                className={styles.tryResult}
                title={`응답 ${outcome.status} · ${outcome.ms.toLocaleString('ko-KR')}ms`}
                code={outcome.body}
                action={<CopyButton value={outcome.body} label="응답 복사" />}
              />
            )}
          </div>
        </form>
      )}
    </Dialog>
  )
}
