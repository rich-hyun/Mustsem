/**
 * POST /api/agent   body: { question }   header: Authorization: Bearer <Supabase access token>
 *
 * Biz-Ops AI 에이전트(bizops_agent/scripts/serve_api.py 게이트웨이)에 질문 1건을 넘긴다.
 * 응답: { answer, tools: string[], elapsed }  ·  오류: { error: 'unauthenticated' | 'forbidden' | 'bad_request' | 'busy' | 'unavailable' }
 *
 * - 고객사 정보가 담긴 답이라 로그인만으로는 열지 않는다. 회원가입이 열려 있으므로
 *   BIZOPS_AGENT_ALLOWED_EMAILS(쉼표 구분)에 있는 계정만 통과시킨다. 비어 있으면 아무도 못 쓴다.
 * - 게이트웨이 주소·비밀키는 서버 환경변수(BIZOPS_AGENT_URL, BIZOPS_AGENT_TOKEN)에만 두고 응답에 싣지 않는다.
 * - 같은 사이트 화면만 쓰는 창구라 CORS를 열지 않는다.
 */
import type { NextRequest } from 'next/server'
import { SUPABASE } from '@/config/site'

// 에이전트가 도구를 여러 번 부르면 1분을 넘기도 한다 (게이트웨이는 280초에 먼저 끊는다)
export const maxDuration = 300

const MAX_QUESTION = 2000
const AUTH_TIMEOUT_MS = 8000
const AGENT_TIMEOUT_MS = 290_000

type ErrorCode = 'unauthenticated' | 'forbidden' | 'bad_request' | 'busy' | 'unavailable'

const fail = (error: ErrorCode, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

function allowedEmails(): Set<string> {
  return new Set(
    (process.env.BIZOPS_AGENT_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Supabase에 토큰을 물어 로그인한 계정의 이메일을 얻는다 (위조·만료 토큰은 null) */
async function emailOf(token: string): Promise<string | null> {
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

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return fail('unauthenticated', 401)
  const email = await emailOf(token)
  if (!email) return fail('unauthenticated', 401)
  if (!allowedEmails().has(email)) return fail('forbidden', 403)

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
      body: JSON.stringify({ question: question.trim() }),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (response.status === 429) return fail('busy', 429)
    if (!response.ok) {
      console.error(`[agent] gateway status ${response.status}`)
      return fail('unavailable', 502)
    }
    const data = (await response.json()) as { answer?: unknown; tools?: unknown; elapsed?: unknown }
    return Response.json(
      {
        answer: typeof data.answer === 'string' ? data.answer : '',
        tools: Array.isArray(data.tools) ? data.tools.filter((tool): tool is string => typeof tool === 'string') : [],
        elapsed: typeof data.elapsed === 'number' ? data.elapsed : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[agent] gateway call failed:', error instanceof Error ? error.message : error)
    return fail('unavailable', 502)
  }
}
