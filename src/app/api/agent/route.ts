/**
 * Biz-Ops AI 에이전트 창구. 로그인한 회원만 쓴다 (header: Authorization: Bearer <Supabase access token>).
 *
 * 답이 30초를 넘기도 해서(도구 10회 이상) 한 요청으로 기다리지 않고 "맡기고 → 조회" 한다.
 * GET  /api/agent                  → { mode: 'internal' | 'public', dailyLimit }  (화면이 어떤 모드인지 알기 위해)
 * POST /api/agent  { question }    → 202 { mode, job, status: 'running', remaining }  (게이트웨이 POST /jobs, 1초 안에 끝남)
 * GET  /api/agent?job=<번호>        → { status: 'running', elapsed }
 *                                  | { status: 'done', mode, answer, tools: string[], elapsed, remaining }
 *                                  | { status: 'failed', error: 'agent_failed' }
 * 오류: { error: 'unauthenticated' | 'bad_request' | 'limit' | 'busy' | 'not_found' | 'unavailable' }
 *       not_found(404): 번호가 없거나 10분이 지났거나 게이트웨이가 재시작됐다
 *
 * - BIZOPS_AGENT_ALLOWED_EMAILS(쉼표 구분)에 있는 계정은 내부용(고객 관리 포함, 횟수 제한 없음),
 *   그 밖의 회원은 공개용(고객사 정보 없음, 하루 횟수 제한은 게이트웨이가 센다)으로 보낸다.
 * - 게이트웨이에는 이메일 원문 대신 해시만 넘긴다. 조회 때도 브라우저가 보낸 값이 아니라 세션에서 같은 해시를 만들어
 *   보내므로, 남이 맡긴 번호로는 답을 볼 수 없다(게이트웨이가 user 불일치를 404로 돌려준다).
 * - 게이트웨이 주소·비밀키는 서버 환경변수(BIZOPS_AGENT_URL, BIZOPS_AGENT_TOKEN)에만 두고 응답에 싣지 않는다.
 * - 같은 사이트 화면만 쓰는 창구라 CORS를 열지 않는다.
 */
import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { SUPABASE } from '@/config/site'

// 맡기기·조회 모두 몇 초 안에 끝난다 (호스팅의 요청 한도 30초 안쪽)
export const maxDuration = 30

const MAX_QUESTION = 2000
const AUTH_TIMEOUT_MS = 8000
const GATEWAY_TIMEOUT_MS = 15_000
/** 게이트웨이 작업 번호. 주소 경로에 그대로 붙이므로 영숫자·_·- 만 받는다 */
const JOB_ID = /^[A-Za-z0-9_-]{1,64}$/
/** 화면 안내용. 실제 한도는 게이트웨이의 BIZOPS_PUBLIC_DAILY_LIMIT 가 정한다 (0이면 무제한) */
const PUBLIC_DAILY_LIMIT = Number(process.env.BIZOPS_PUBLIC_DAILY_LIMIT ?? 5) || 0

type Mode = 'internal' | 'public'
type ErrorCode = 'unauthenticated' | 'bad_request' | 'limit' | 'busy' | 'not_found' | 'unavailable'

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

/** Supabase에 토큰을 물어 로그인한 계정의 이메일을 얻는다 (위조·만료 토큰은 null) */
async function emailOf(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return null
  try {
    const response = await fetch(`${SUPABASE.url}/auth/v1/user`, {
      headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const user = (await response.json()) as { email?: unknown }
    return typeof user.email === 'string' && user.email ? user.email.toLowerCase() : null
  } catch (error) {
    console.error('[agent] auth check failed:', error instanceof Error ? error.message : error)
    return null
  }
}

const modeOf = (email: string): Mode => (allowedEmails().has(email) ? 'internal' : 'public')

/** 하루 횟수를 세고 작업 주인을 가리는 회원 식별값. 맡길 때와 조회할 때 같은 값이어야 한다. 이메일 원문은 넘기지 않는다 */
const userOf = (email: string) => createHash('sha256').update(email).digest('hex').slice(0, 32)

/** 게이트웨이 주소·비밀키. 없으면 null */
function gateway(): { base: string; secret: string } | null {
  const base = process.env.BIZOPS_AGENT_URL
  const secret = process.env.BIZOPS_AGENT_TOKEN
  if (!base || !secret) {
    console.error('[agent] BIZOPS_AGENT_URL / BIZOPS_AGENT_TOKEN not set')
    return null
  }
  return { base: base.replace(/\/+$/, ''), secret }
}

const numberOr = (value: unknown) => (typeof value === 'number' ? value : null)

export async function GET(request: NextRequest) {
  const email = await emailOf(request)
  if (!email) return fail('unauthenticated', 401)
  const mode = modeOf(email)

  const job = request.nextUrl.searchParams.get('job')
  if (job === null) return Response.json({ mode, dailyLimit: PUBLIC_DAILY_LIMIT }, { headers: NO_STORE })
  if (!JOB_ID.test(job)) return fail('bad_request', 400)

  const target = gateway()
  if (!target) return fail('unavailable', 503)

  try {
    const response = await fetch(
      `${target.base}/jobs/${encodeURIComponent(job)}?user=${encodeURIComponent(userOf(email))}`,
      {
        headers: { Authorization: `Bearer ${target.secret}` },
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
        cache: 'no-store',
      },
    )
    if (response.status === 404) return fail('not_found', 404)
    if (!response.ok) {
      console.error(`[agent] gateway job status ${response.status}`)
      return fail('unavailable', 502)
    }
    const data = (await response.json()) as {
      status?: unknown
      answer?: unknown
      tools?: unknown
      elapsed?: unknown
      remaining?: unknown
    }
    if (data.status === 'running') {
      return Response.json({ status: 'running', elapsed: numberOr(data.elapsed) }, { headers: NO_STORE })
    }
    if (data.status === 'done') {
      return Response.json(
        {
          status: 'done',
          mode,
          answer: typeof data.answer === 'string' ? data.answer : '',
          tools: Array.isArray(data.tools) ? data.tools.filter((tool): tool is string => typeof tool === 'string') : [],
          elapsed: numberOr(data.elapsed),
          remaining: numberOr(data.remaining),
        },
        { headers: NO_STORE },
      )
    }
    if (data.status === 'failed') return Response.json({ status: 'failed', error: 'agent_failed' }, { headers: NO_STORE })
    console.error('[agent] gateway job: unknown status')
    return fail('unavailable', 502)
  } catch (error) {
    console.error('[agent] gateway job call failed:', error instanceof Error ? error.message : error)
    return fail('unavailable', 502)
  }
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

  const target = gateway()
  if (!target) return fail('unavailable', 503)

  try {
    const response = await fetch(`${target.base}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.secret}` },
      body: JSON.stringify({ question: question.trim(), mode, user: userOf(email) }),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 429) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown }
      return fail(body.error === 'limit' ? 'limit' : 'busy', 429)
    }
    if (response.status === 400) return fail('bad_request', 400)
    if (!response.ok) {
      console.error(`[agent] gateway status ${response.status}`)
      return fail('unavailable', 502)
    }
    const data = (await response.json()) as { job?: unknown; remaining?: unknown }
    // 번호는 조회 때 주소 경로에 붙으므로 여기서도 모양을 확인한다
    const job = typeof data.job === 'number' ? String(data.job) : data.job
    if (typeof job !== 'string' || !JOB_ID.test(job)) {
      console.error('[agent] gateway returned no job id')
      return fail('unavailable', 502)
    }
    return Response.json(
      { mode, job, status: 'running', remaining: numberOr(data.remaining) },
      { status: 202, headers: NO_STORE },
    )
  } catch (error) {
    console.error('[agent] gateway call failed:', error instanceof Error ? error.message : error)
    return fail('unavailable', 502)
  }
}
