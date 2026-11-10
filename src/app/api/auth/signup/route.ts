/**
 * POST /api/auth/signup  { name, email, password, company?, marketingAgreed?, agreeTerms }
 *   → 201 { next: 'confirm' }   (Cognito가 이메일로 인증 코드를 보낸다)
 *
 * 1) 입력을 서버에서 다시 검증 2) Cognito 회원 등록(중복 이메일은 Cognito가 거절) 3) DynamoDB 프로필 생성(USER).
 * 3이 실패해도 인증·로그인 단계가 같은 프로필을 다시 만들기 때문에 계정과 프로필이 어긋난 채 남지 않는다.
 * 역할은 입력으로 받지 않는다. 가입 경로로는 언제나 USER다.
 */
import type { NextRequest } from 'next/server'
import { COMPANY_MAX, looksLikeEmail, nameProblem, normalizeEmail, passwordProblem } from '@/lib/account'
import { signUp } from '@/server/members/cognito'
import { requireConfig } from '@/server/members/config'
import { MemberError } from '@/server/members/errors'
import { handle, ok, readBody, text } from '@/server/members/http'
import { ensureProfile } from '@/server/members/profiles'

export async function POST(request: NextRequest) {
  return handle('signup', async () => {
    const config = requireConfig()
    const body = await readBody(request)
    const email = normalizeEmail(text(body.email))
    const name = text(body.name).trim()
    const password = text(body.password)
    const company = text(body.company).trim().slice(0, COMPANY_MAX) || null
    if (!looksLikeEmail(email) || nameProblem(name) || body.agreeTerms !== true) throw new MemberError('bad_request')
    if (passwordProblem(password)) throw new MemberError('weak_password')

    const userId = await signUp(config, { email, password, name })
    try {
      await ensureProfile(config, { userId, email, name, emailVerified: false, company, marketingAgreed: body.marketingAgreed === true })
    } catch (error) {
      console.error('[members:signup] profile create deferred:', error instanceof Error ? error.message : error)
    }
    return ok({ next: 'confirm' }, 201)
  })
}
