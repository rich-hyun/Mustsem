'use client'

import { Fragment, useCallback, useEffect, useState, type KeyboardEvent, type ReactNode, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextAreaField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { logDevError } from '@/lib/errors'
import styles from './agent.module.css'

const MAX_QUESTION = 2000

type Mode = 'internal' | 'public'

const EXAMPLES: Record<Mode, string[]> = {
  public: [
    '디딤돌 과제 낼 때 자주 감점되는 부분은?',
    '사업 개시 3년 된 법인인데 창업기업에 해당하나요?',
    '이번 달 마감되는 R&D 공고 알려줘',
    '사업비·인건비 산정 근거는 어떻게 써야 지적을 피하나요?',
    '발표평가 탈락 사례에서 공통으로 나온 지적은?',
    '제안서 내기 전 자가진단 항목을 알려줘',
  ],
  internal: [
    '2주 안에 마감되는 공고 알려줘',
    '후속 조치가 남아 있는 고객사 목록 보여줘',
    '2026년 평가에서 가장 많이 지적된 문제 유형은?',
    '정성점수 커트라인을 통과한 고객사는 몇 곳이고 어디인가요?',
    '대전 고객사 중 R&D 과제 지원이 가능한 곳은?',
    '이번 주 연락할 고객사를 우선순위와 이유로 정리해줘',
  ],
}

const PLACEHOLDER: Record<Mode, string> = {
  public: '예: 성능지표를 어떻게 써야 심사에서 지적을 덜 받나요?',
  internal: '예: 동대전현대서비스 차기 과제 기획 시 과거 평가에서 주의할 점은?',
}

/** /api/agent 오류 코드 → 화면 문구 (서버 원문은 싣지 않는다) */
const ERROR_TEXT: Record<string, string> = {
  unauthenticated: '로그인이 만료되었습니다. 다시 로그인하세요.',
  bad_request: `질문을 ${MAX_QUESTION.toLocaleString()}자 이내로 입력하세요.`,
  limit: '오늘 쓸 수 있는 질문 횟수를 모두 썼습니다. 내일 다시 이용해 주세요.',
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

interface AgentInfo {
  mode: Mode
  dailyLimit: number
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`\n]+)`/g

/** 답변의 굵게(**)·링크·`코드`만 살린다. 나머지 마크다운은 글자 그대로 둔다 (HTML로 해석하지 않는다) */
function renderInline(line: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(INLINE)) {
    const at = match.index ?? 0
    if (at > last) nodes.push(line.slice(last, at))
    if (match[1] !== undefined) nodes.push(<strong key={at}>{match[1]}</strong>)
    else if (match[4] !== undefined) nodes.push(<code key={at}>{match[4]}</code>)
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

const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

const cellsOf = (row: string) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

type Block = { kind: 'text'; lines: string[] } | { kind: 'table'; head: string[]; rows: string[][] }

/** 머리행 + 구분선(|---|)으로 시작하는 줄 묶음은 표로, 나머지는 글로 나눈다 */
function toBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const next = lines[i + 1] ?? ''
    if (TABLE_ROW.test(line) && TABLE_RULE.test(next)) {
      const head = cellsOf(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && TABLE_ROW.test(lines[i] ?? '')) {
        rows.push(cellsOf(lines[i] ?? ''))
        i += 1
      }
      // 표 앞뒤 빈 줄은 표의 여백이 대신한다
      const prev = blocks[blocks.length - 1]
      if (prev?.kind === 'text') while (prev.lines.length && !prev.lines[prev.lines.length - 1]?.trim()) prev.lines.pop()
      if (!(lines[i] ?? '').trim()) i += 1
      i -= 1
      blocks.push({ kind: 'table', head, rows })
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last?.kind === 'text') last.lines.push(line)
    else blocks.push({ kind: 'text', lines: [line] })
  }
  return blocks
}

function Answer({ text }: { text: string }) {
  return (
    <div className={styles.answer}>
      {toBlocks(text).map((block, blockIndex) =>
        block.kind === 'table' ? (
          <div key={blockIndex} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {block.head.map((cell, index) => (
                    <th key={index} scope="col">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {block.head.map((_, index) => (
                      <td key={index}>{renderInline(row[index] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Fragment key={blockIndex}>
            {block.lines.map((raw, index) => {
              const heading = raw.match(/^#{1,6}\s+(.*)$/)
              return (
                <Fragment key={index}>
                  {heading ? <strong>{renderInline(heading[1] ?? '')}</strong> : renderInline(raw.replace(/\s+$/, ''))}
                  {index < block.lines.length - 1 && '\n'}
                </Fragment>
              )
            })}
          </Fragment>
        ),
      )}
    </div>
  )
}

export function AgentChat() {
  const { status } = useAuth()
  const [info, setInfo] = useState<AgentInfo | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Exchange[]>([])
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  // 로그인하면 이 계정이 내부용인지 공개용인지 먼저 받아 둔다 (예시 질문·안내가 달라진다)
  useEffect(() => {
    if (status !== 'signed-in') {
      setInfo(null)
      return
    }
    let cancelled = false
    // 세션은 httpOnly 쿠키로 함께 전송된다
    fetch('/api/agent', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as Partial<AgentInfo>
        if (!cancelled && (body.mode === 'internal' || body.mode === 'public')) {
          setInfo({ mode: body.mode, dailyLimit: typeof body.dailyLimit === 'number' ? body.dailyLimit : 0 })
        }
      })
      .catch((caught: unknown) => logDevError('agent:info', caught))
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === 'unknown') {
    return <Notice tone="neutral">로그인 상태를 확인하고 있습니다.</Notice>
  }
  if (status !== 'signed-in') {
    return (
      <Notice
        tone="info"
        title="회원이면 누구나 쓸 수 있습니다"
        actions={
          <>
            <Button href="/signup" size="sm">
              회원가입
            </Button>
            <Button href="/login" size="sm" variant="secondary">
              로그인
            </Button>
          </>
        }
      >
        회원가입 후 로그인하면 실제 심사 사례 기반 질의응답, 제안서 1차 검수, 창업기업 판정, 지원사업 공고 검색을 이용할 수 있습니다.
      </Notice>
    )
  }

  const mode: Mode = info?.mode ?? 'public'

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
      const response = await fetch('/api/agent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      })
      const body = (await response.json().catch(() => ({}))) as Partial<Exchange> & { error?: string; remaining?: number | null }
      if (!response.ok) {
        if (body.error === 'limit') setRemaining(0)
        setError((body.error && ERROR_TEXT[body.error]) || UNAVAILABLE)
        return
      }
      if (typeof body.remaining === 'number') setRemaining(body.remaining)
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

  const quota =
    mode === 'internal'
      ? '내부용: 고객 관리 데이터 포함, 횟수 제한 없음'
      : info && info.dailyLimit > 0
        ? `하루 ${info.dailyLimit}회까지 질문할 수 있습니다${remaining !== null ? `. 오늘 남은 횟수: ${remaining}회` : ''}`
        : null
  const outOfQuota = mode === 'public' && remaining === 0

  return (
    <div className={styles.layout}>
      <Card elevation="raised" padding="lg">
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextAreaField
            id="agent-question"
            label="질문"
            hint={
              mode === 'internal'
                ? '고객사, 심사 사례, 공고, 제안서 검수에 대해 물어보세요. 답변까지 1분 넘게 걸릴 수 있습니다. 보내기: Ctrl+Enter'
                : '지원사업 준비, 제안서 작성, 창업기업 해당 여부, 공고에 대해 물어보세요. 제안서 문단을 붙여 넣으면 1차 검수합니다. 보내기: Ctrl+Enter'
            }
            rows={4}
            maxLength={MAX_QUESTION}
            placeholder={PLACEHOLDER[mode]}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={asking}
          />
          <div className={styles.examples} aria-label="예시 질문">
            {EXAMPLES[mode].map((example) => (
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
            {quota && <p className={styles.quota}>{quota}</p>}
            <Button type="submit" loading={asking} disabled={!question.trim() || outOfQuota}>
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
              {/* 도구 이름은 내부 구성이라 내부용에서만 보인다 */}
              {mode === 'internal' && (
                <p className={styles.meta}>
                  {item.tools.length ? `사용한 도구: ${item.tools.join(', ')}` : '도구를 쓰지 않은 답변'}
                  {item.elapsed !== null && ` · ${item.elapsed}초`}
                </p>
              )}
            </Card>
          ))}
        </ol>
      )}
    </div>
  )
}
