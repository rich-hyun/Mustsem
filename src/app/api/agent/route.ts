/**
 * Biz-Ops AI 에이전트 창구. 로그인한 회원만 쓴다 (httpOnly 세션 쿠키, src/server/members/session.ts).
 *
 * GET  /api/agent                  → { mode: 'internal' | 'public', dailyLimit }  (화면이 어떤 모드인지 알기 위해)
 * POST /api/agent  { question }    → { mode, answer, tools: string[], elapsed, remaining }
 * 오류: { error: 'unauthenticated' | 'bad_request' | 'limit' | 'busy' | 'unavailable' }
 *
 * - BIZOPS_AGENT_ALLOWED_EMAILS(쉼표 구분)에 있는 계정은 내부용(고객 관리 포함, 횟수 제한 없음),
 *   그 밖의 회원은 공개용(고객사 정보 없음, 하루 횟수 제한은 게이트웨이가 센다)으로 보낸다.
 * - 게이트웨이에는 이메일 원문 대신 해시만 넘긴다.
 * - 게이트웨이 주소·비밀키는 서버 환경변수(BIZOPS_AGENT_URL, BIZOPS_AGENT_TOKEN)에만 두고 응답에 싣지 않는다.
 * - 같은 사이트 화면만 쓰는 창구라 CORS를 열지 않는다.
 */
import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { authenticate } from '@/server/members/session'

// 에이전트가 도구를 여러 번 부르면 1분을 넘기도 한다 (게이트웨이는 280초에 먼저 끊는다)
export const maxDuration = 300

const MAX_QUESTION = 2000
const AGENT_TIMEOUT_MS = 290_000
/** 화면 안내용. 실제 한도는 게이트웨이의 BIZOPS_PUBLIC_DAILY_LIMIT 가 정한다 (0이면 무제한) */
const PUBLIC_DAILY_LIMIT = Number(process.env.BIZOPS_PUBLIC_DAILY_LIMIT ?? 5) || 0

type Mode = 'internal' | 'public'
type ErrorCode = 'unauthenticated' | 'bad_request' | 'limit' | 'busy' | 'unavailable'

const NO_STORE = { 'Cache-Control': 'no-store' }
const fail = (error: ErrorCode, status: number) => Response.json({ error }, { status, headers: NO_STORE })

function allowedEmails(): Set<string> {
  return new Set(
    (process.env.BIZOPS_AGENT_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * 세션 쿠키로 로그인한 회원의 이메일을 얻는다 (서명·만료 검증, DynamoDB 상태 확인 포함).
 * 비활성화된 계정·삭제된 계정·위조 토큰은 null.
 */
async function emailOf(request: NextRequest): Promise<string | null> {
  const outcome = await authenticate(request)
  return outcome.ok ? outcome.auth.profile.email.toLowerCase() : null
}

const modeOf = (email: string): Mode => (allowedEmails().has(email) ? 'internal' : 'public')

export async function GET(request: NextRequest) {
  const email = await emailOf(request)
  if (!email) return fail('unauthenticated', 401)
  return Response.json({ mode: modeOf(email), dailyLimit: PUBLIC_DAILY_LIMIT }, { headers: NO_STORE })
}

export async function POST(request: NextRequest) {
  const email = await emailOf(request)
  if (!email) return fail('unauthenticated', 401)
  const mode = modeOf(email)

  let question: unknown
  try {
    question = ((await request.json()) as { question?: unknown }).question
  } catch {
    return fail('bad_request', 400)
  }
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION) return fail('bad_request', 400)

  const base = process.env.BIZOPS_AGENT_URL
  const secret = process.env.BIZOPS_AGENT_TOKEN
  if (!base || !secret) {
    console.error('[agent] BIZOPS_AGENT_URL / BIZOPS_AGENT_TOKEN not set')
    return fail('unavailable', 503)
  }

  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        question: question.trim(),
        mode,
        // 하루 횟수를 셀 회원 식별값. 이메일 원문은 넘기지 않는다
        user: createHash('sha256').update(email).digest('hex').slice(0, 32),
      }),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 429) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown }
      return fail(body.error === 'limit' ? 'limit' : 'busy', 429)
    }
    if (!response.ok) {
      console.error(`[agent] gateway status ${response.status}`)
      return fail('unavailable', 502)
    }
    const data = (await response.json()) as { answer?: unknown; tools?: unknown; elapsed?: unknown; remaining?: unknown }
    return Response.json(
      {
        mode,
        answer: typeof data.answer === 'string' ? data.answer : '',
        tools: Array.isArray(data.tools) ? data.tools.filter((tool): tool is string => typeof tool === 'string') : [],
        elapsed: typeof data.elapsed === 'number' ? data.elapsed : null,
        remaining: typeof data.remaining === 'number' ? data.remaining : null,
      },
      { headers: NO_STORE },
    )
  } catch (error) {
    console.error('[agent] gateway call failed:', error instanceof Error ? error.message : error)
    return fail('unavailable', 502)
  }
}
