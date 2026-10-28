'use client'

import { Fragment, useState, type KeyboardEvent, type ReactNode, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextAreaField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { logDevError } from '@/lib/errors'
import styles from './agent.module.css'

const MAX_QUESTION = 2000

const EXAMPLES = [
  '2주 안에 마감되는 공고 알려줘',
  '후속 조치가 남아 있는 고객사 목록 보여줘',
  '2026년 평가에서 가장 많이 지적된 문제 유형은?',
]

/** /api/agent 오류 코드 → 화면 문구 (서버 원문은 싣지 않는다) */
const ERROR_TEXT: Record<string, string> = {
  unauthenticated: '로그인이 만료되었습니다. 다시 로그인하세요.',
  forbidden: '이 계정은 에이전트 사용 권한이 없습니다. 관리자에게 요청하세요.',
  bad_request: `질문을 ${MAX_QUESTION.toLocaleString()}자 이내로 입력하세요.`,
  busy: '다른 질문을 처리하고 있습니다. 잠시 후 다시 시도하세요.',
}
const UNAVAILABLE = '에이전트가 응답하지 않습니다. 잠시 후 다시 시도하세요.'

interface Exchange {
  id: number
  question: string
  answer: string
  tools: string[]
  elapsed: number | null
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

/** 답변의 굵게(**)·링크만 살린다. 나머지 마크다운은 글자 그대로 둔다 (HTML로 해석하지 않는다) */
function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(INLINE)) {
    const at = match.index ?? 0
    if (at > last) nodes.push(line.slice(last, at))
    if (match[1] !== undefined) nodes.push(<strong key={at}>{match[1]}</strong>)
    else
      nodes.push(
        <a key={at} href={match[3]} target="_blank" rel="noopener noreferrer">
          {match[2]}
        </a>,
      )
    last = at + match[0].length
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

function Answer({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className={styles.answer}>
      {lines.map((raw, index) => {
        const heading = raw.match(/^#{1,6}\s+(.*)$/)
        return (
          <Fragment key={index}>
            {heading ? <strong>{renderInline(heading[1] ?? '')}</strong> : renderInline(raw.replace(/\s+$/, ''))}
            {index < lines.length - 1 && '\n'}
          </Fragment>
        )
      })}
    </div>
  )
}

export function AgentChat() {
  const { status, getClient } = useAuth()
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Exchange[]>([])
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  if (status === 'unknown') {
    return <Notice tone="neutral">로그인 상태를 확인하고 있습니다.</Notice>
  }
  if (status !== 'signed-in') {
    return (
      <Notice tone="info" title="로그인이 필요합니다" actions={<Button href="/login" size="sm">로그인</Button>}>
        에이전트는 사용 권한이 있는 내부 계정으로 로그인해야 쓸 수 있습니다.
      </Notice>
    )
  }

  const ask = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || asking) return
    if (trimmed.length > MAX_QUESTION) {
      setError(ERROR_TEXT.bad_request ?? UNAVAILABLE)
      return
    }
    setAsking(true)
    setError(null)
    try {
      const client = await getClient()
      const { data } = await client.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError(ERROR_TEXT.unauthenticated ?? UNAVAILABLE)
        return
      }
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: trimmed }),
      })
      const body = (await response.json().catch(() => ({}))) as Partial<Exchange> & { error?: string }
      if (!response.ok) {
        setError((body.error && ERROR_TEXT[body.error]) || UNAVAILABLE)
        return
      }
      setHistory((current) => [
        { id: Date.now(), question: trimmed, answer: body.answer ?? '', tools: body.tools ?? [], elapsed: body.elapsed ?? null },
        ...current,
      ])
      setQuestion('')
    } catch (caught) {
      logDevError('agent:ask', caught)
      setError(UNAVAILABLE)
    } finally {
      setAsking(false)
    }
  }

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    void ask(question)
  }

  // Ctrl(⌘)+Enter로 보내기. Enter만 누르면 줄바꿈
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void ask(question)
    }
  }

  return (
    <div className={styles.layout}>
      <Card elevation="raised" padding="lg">
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextAreaField
            id="agent-question"
            label="질문"
            hint="고객사, 심사 사례, 공고, 제안서 검수에 대해 물어보세요. 답변까지 1분 넘게 걸릴 수 있습니다. 보내기: Ctrl+Enter"
            rows={4}
            maxLength={MAX_QUESTION}
            placeholder="예: 동대전현대서비스 차기 과제 기획 시 과거 평가에서 주의할 점은?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={asking}
          />
          <div className={styles.examples} aria-label="예시 질문">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className={styles.example} disabled={asking} onClick={() => setQuestion(example)}>
                {example}
              </button>
            ))}
          </div>
          {error && (
            <div role="alert">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
          <div className={styles.actions}>
            <Button type="submit" loading={asking} disabled={!question.trim()}>
              {asking ? '답변을 만드는 중' : '질문하기'}
            </Button>
          </div>
        </form>
      </Card>

      {history.length > 0 && (
        <ol className={styles.history} aria-label="질문과 답변">
          {history.map((item) => (
            <Card key={item.id} as="li" elevation="surface" padding="lg" className={styles.exchange}>
              <p className={styles.question}>{item.question}</p>
              <Answer text={item.answer || '답변이 비어 있습니다.'} />
              <p className={styles.meta}>
                {item.tools.length ? `사용한 도구: ${item.tools.join(', ')}` : '도구를 쓰지 않은 답변'}
                {item.elapsed !== null && ` · ${item.elapsed}초`}
              </p>
            </Card>
          ))}
        </ol>
      )}
    </div>
  )
}
