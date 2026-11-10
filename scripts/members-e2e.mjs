// 회원 시스템 API 종단 테스트 (로컬 에뮬레이터 전용, 운영 AWS에 쓰지 말 것). docs/aws-members.md 8절 순서로 띄운 뒤:
//   1) 관리자 후보 가입: curl -X POST <base>/api/auth/signup (admin@example.com / Passw0rd!) 2) 깨끗한 에뮬레이터 상태에서
//   DEV_LOG=<서버 로그> node scripts/members-e2e.mjs <base> <cognito-local 로그> <저장소 경로>
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [BASE = 'http://localhost:3100', LOG, REPO] = process.argv.slice(2)
const results = []
const check = (name, cond, extra = '') => {
  results.push({ name, ok: Boolean(cond) })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
}

class Browser {
  jar = new Map()
  async req(method, path, body, { origin = BASE, raw } = {}) {
    const headers = { Origin: origin }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) headers.Cookie = cookie
    const res = await fetch(BASE + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' })
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';')
      const [k, ...v] = pair.split('=')
      const value = v.join('=')
      const maxAge = attrs.find((a) => a.trim().toLowerCase().startsWith('max-age='))
      if (value === '' || maxAge?.trim().toLowerCase() === 'max-age=0') this.jar.delete(k.trim())
      else this.jar.set(k.trim(), value)
    }
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data, setCookie: res.headers.getSetCookie() }
  }
}

const codeFor = (email, nth = -1) => {
  const log = readFileSync(LOG, 'utf8').replace(/\x1b\[[0-9;]*m/g, '')
  const blocks = [...log.matchAll(/Destination:\s+(\S+)[\s\S]*?Code:\s+(\d{6})/g)].filter((m) => m[1] === email)
  return blocks.at(nth)?.[2]
}

const A = 'admin@example.com'
const B = 'user.b@example.com'
const a = new Browser()
const b = new Browser()
const anon = new Browser()

// ── 회원가입 ─────────────────────────────────────────────
let r = await anon.req('POST', '/api/auth/signup', { name: '관리자', email: 'ADMIN@example.com', password: 'Passw0rd!', agreeTerms: true })
check('중복 이메일 가입 차단 (대소문자 무시)', r.status === 409 && r.data.error === 'email_taken', JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/signup', { name: '비', email: B, password: 'password', agreeTerms: true })
check('비밀번호 정책 서버 검증', r.status === 400 && r.data.error === 'weak_password', JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/signup', { name: '비', email: 'not-an-email', password: 'Passw0rd!', agreeTerms: true })
check('이메일 형식 서버 검증', r.status === 400 && r.data.error === 'bad_request')
r = await anon.req('POST', '/api/auth/signup', { name: '비', email: B, password: 'Passw0rd!' })
check('필수 약관 미동의 거절', r.status === 400 && r.data.error === 'bad_request')
r = await anon.req('POST', '/api/auth/signup', { name: '', email: B, password: 'Passw0rd!', agreeTerms: true })
check('이름 필수 검증', r.status === 400)
r = await anon.req('POST', '/api/auth/signup', { name: '사용자비', email: B, password: 'Passw0rd!', agreeTerms: true, role: 'ADMIN' }, { origin: 'https://evil.example' })
check('다른 출처의 가입 요청 차단', r.status === 403 && r.data.error === 'forbidden_origin')
r = await anon.req('POST', '/api/auth/signup', { name: '사용자비', email: B, password: 'Passw0rd!', agreeTerms: true, role: 'ADMIN', company: '테스트(주)' })
check('신규 회원가입 (role 필드는 무시)', r.status === 201, JSON.stringify(r.data))

// ── 이메일 인증 ──────────────────────────────────────────
r = await b.req('POST', '/api/auth/login', { email: B, password: 'Passw0rd!' })
check('인증 전 로그인 → not_confirmed', r.status === 403 && r.data.error === 'not_confirmed', JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/confirm', { email: B, code: '000000' })
check('틀린 인증 코드 거절', r.status === 400 && r.data.error === 'code_mismatch', JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/resend', { email: B })
if (r.status === 503 && /Unsupported x-amz-target header "ResendConfirmationCode"/.test(readFileSync(process.env.DEV_LOG, 'utf8'))) {
  console.log('SKIP  인증 코드 재발송 (cognito-local 미지원 API, 실제 Cognito에서 확인 필요)')
} else {
  check('인증 코드 재발송', r.status === 200)
}
r = await anon.req('POST', '/api/auth/confirm', { email: B, code: codeFor(B) })
check('이메일 인증 완료', r.status === 200, JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/confirm', { email: A, code: codeFor(A) })
check('관리자 후보 이메일 인증', r.status === 200, JSON.stringify(r.data))

// ── 로그인·세션 ──────────────────────────────────────────
r = await a.req('POST', '/api/auth/login', { email: A, password: 'Wrong0000!' })
check('잘못된 비밀번호 → invalid_credentials', r.status === 401 && r.data.error === 'invalid_credentials')
r = await a.req('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'Wrong0000!' })
check('없는 이메일도 같은 오류', r.status === 401 && r.data.error === 'invalid_credentials')
r = await a.req('POST', '/api/auth/login', { email: 'Admin@Example.com', password: 'Passw0rd!' })
check('정상 로그인 (이메일 대소문자 무시)', r.status === 200 && r.data.user?.role === 'USER', JSON.stringify(r.data))
const cookies = r.setCookie.join(' | ')
check('세션 쿠키는 HttpOnly + SameSite=Lax + Path=/api', /ms_at=[^|]*HttpOnly/i.test(cookies) && /ms_rt=[^|]*Path=\/api/i.test(cookies) && /SameSite=lax/i.test(cookies))
check('응답 본문에 토큰 없음', !JSON.stringify(r.data).includes('eyJ'))
r = await a.req('GET', '/api/auth/session')
check('세션 조회', r.status === 200 && r.data.user?.email === A)
a.jar.delete('ms_at')
r = await a.req('GET', '/api/auth/session')
check('액세스 토큰 만료 시 리프레시로 세션 복구', r.status === 200 && a.jar.has('ms_at'), JSON.stringify(r.data))
r = await anon.req('GET', '/api/auth/session')
check('비로그인 세션 조회 → 401', r.status === 401)
const forged = new Browser()
forged.jar.set('ms_at', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abc')
r = await forged.req('GET', '/api/me')
check('위조 토큰 거절', r.status === 401)

// ── 프로필·권한 상승 차단 ────────────────────────────────
r = await a.req('GET', '/api/me')
check('내 정보 조회 (DynamoDB)', r.status === 200 && r.data.profile?.role === 'USER' && r.data.profile?.lastLoginAt, JSON.stringify(r.data.profile))
r = await a.req('PATCH', '/api/me', { name: '김관리', role: 'ADMIN', status: 'ACTIVE', email: 'x@y.z' })
check('내 정보 수정 시 role/email 무시', r.status === 200 && r.data.profile?.name === '김관리' && r.data.profile?.role === 'USER' && r.data.profile?.email === A, JSON.stringify(r.data.profile))
r = await a.req('GET', '/api/admin/users')
check('일반 회원의 관리자 API 호출 차단', r.status === 403 && r.data.error === 'forbidden')
r = await b.req('POST', '/api/auth/login', { email: B, password: 'Passw0rd!' })
check('회원 B 로그인', r.status === 200)
const bId = r.data.user?.userId
r = await b.req('PATCH', `/api/admin/users/${bId}`, { role: 'ADMIN' })
check('일반 회원이 자기 권한 상승 시도 차단', r.status === 403 && r.data.error === 'forbidden')
r = await b.req('GET', '/api/me')
check('회사명 등 가입 정보 저장', r.data.profile?.company === '테스트(주)' && r.data.profile?.emailVerified === true, JSON.stringify(r.data.profile))

// ── 첫 관리자 지정 (CLI 스크립트) ───────────────────────
const env = { ...process.env, COGNITO_ENDPOINT: 'http://localhost:9229', DYNAMODB_ENDPOINT: 'http://localhost:8000' }
const envLocal = Object.fromEntries(readFileSync(`${REPO}/.env.local`, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')))
const out = execFileSync('node', [`${REPO}/scripts/grant-admin.mjs`, '--email', A, '--user-pool-id', envLocal.COGNITO_USER_POOL_ID], { env, cwd: REPO, encoding: 'utf8' })
check('grant-admin 스크립트로 관리자 지정', /USER → ADMIN/.test(out), out.trim())
r = await a.req('GET', '/api/auth/session')
check('권한 변경이 기존 세션에 바로 반영', r.data.user?.role === 'ADMIN')

// ── 관리자 기능 ──────────────────────────────────────────
r = await a.req('GET', '/api/admin/users')
check('관리자 회원 목록 조회', r.status === 200 && r.data.stats?.total === 2 && r.data.stats.active === 2 && r.data.stats.recent === 2 && r.data.stats.admins === 1, JSON.stringify(r.data.stats))
r = await a.req('GET', `/api/admin/users?q=${encodeURIComponent('사용자')}`)
check('이름 검색', r.data.total === 1 && r.data.items[0].email === B)
r = await a.req('GET', '/api/admin/users?q=admin@')
check('이메일 검색', r.data.total === 1 && r.data.items[0].email === A)
r = await a.req('GET', '/api/admin/users?role=ADMIN')
check('권한 필터', r.data.total === 1)
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
r = await a.req('GET', `/api/admin/users?from=${today}&to=${today}`)
check('가입일 필터 (오늘)', r.data.total === 2)
r = await a.req('GET', '/api/admin/users?to=2020-01-01')
check('가입일 필터 (과거, 결과 없음)', r.data.total === 0 && r.data.items.length === 0)
r = await a.req('GET', '/api/admin/users?sort=oldest&pageSize=10&page=1')
const oldestFirst = r.data.items?.map((m) => m.email)
r = await a.req('GET', '/api/admin/users?sort=newest&pageSize=10&page=1')
check('가입일 정렬', oldestFirst?.[0] === A && r.data.items?.[0]?.email === B, `${oldestFirst} / ${r.data.items?.map((m) => m.email)}`)
r = await a.req('GET', '/api/admin/users?pageSize=10&page=99')
check('페이지 범위 보정', r.data.page === 1 && r.data.pages === 1)
r = await a.req('GET', `/api/admin/users/${bId}`)
check('회원 상세 조회', r.status === 200 && r.data.profile?.email === B && r.data.account?.confirmed === true, JSON.stringify(r.data.account))
const aId = (await a.req('GET', '/api/me')).data.profile.userId
r = await a.req('PATCH', `/api/admin/users/${aId}`, { status: 'DISABLED' })
check('관리자 자기 자신 비활성화 차단', r.status === 409 && r.data.error === 'self_action')
r = await a.req('PATCH', `/api/admin/users/${bId}`, { status: 'DISABLED' }, { origin: 'https://evil.example' })
check('다른 출처의 관리자 변경 차단', r.status === 403 && r.data.error === 'forbidden_origin')

r = await a.req('PATCH', `/api/admin/users/${bId}`, { status: 'DISABLED' })
check('회원 비활성화', r.status === 200 && r.data.profile?.status === 'DISABLED', JSON.stringify(r.data))
r = await b.req('GET', '/api/me')
check('비활성화된 회원의 기존 세션 차단', r.status === 403 && r.data.error === 'disabled')
check('차단 시 세션 쿠키 삭제', !b.jar.has('ms_at') && !b.jar.has('ms_rt'))
r = await b.req('POST', '/api/auth/login', { email: B, password: 'Passw0rd!' })
check('비활성화된 회원 로그인 차단', r.status === 403 && r.data.error === 'disabled', JSON.stringify(r.data))
r = await a.req('GET', '/api/admin/users?status=DISABLED')
check('상태 필터', r.data.total === 1 && r.data.stats.disabled === 1)
r = await a.req('PATCH', `/api/admin/users/${bId}`, { status: 'ACTIVE' })
check('회원 재활성화', r.status === 200 && r.data.profile?.status === 'ACTIVE')
r = await b.req('POST', '/api/auth/login', { email: B, password: 'Passw0rd!' })
check('재활성화 후 로그인', r.status === 200, JSON.stringify(r.data))
r = await a.req('PATCH', `/api/admin/users/${bId}`, { role: 'ADMIN' })
check('관리자 권한 부여', r.data.profile?.role === 'ADMIN')
r = await b.req('GET', '/api/admin/users')
check('권한 부여 즉시 관리자 API 사용 가능', r.status === 200)
r = await a.req('PATCH', `/api/admin/users/${bId}`, { role: 'USER' })
r = await b.req('GET', '/api/admin/users')
check('권한 회수 즉시 관리자 API 차단', r.status === 403)
r = await a.req('PATCH', `/api/admin/users/${bId}`, { role: 'SUPERADMIN' })
check('알 수 없는 역할 거절', r.status === 400)
r = await a.req('GET', `/api/admin/users/${bId}`)
const actions = r.data.audit?.map((e) => e.action)
check('작업 기록 저장 (비활성화·활성화·권한×2)', actions?.length === 4 && actions.includes('member.disable') && actions.filter((x) => x === 'member.role').length === 2, JSON.stringify(actions))
check('작업 기록에 관리자 이메일', r.data.audit?.every((e) => e.actorEmail === A))

// ── 비밀번호 변경·재설정 ─────────────────────────────────
r = await b.req('POST', '/api/me/password', { currentPassword: 'Nope0000!', newPassword: 'Newpass1!' })
if (r.data.error === 'weak_password') console.log('SKIP  비밀번호 변경: 현재 비밀번호 틀림 (cognito-local은 틀린 현재 비밀번호를 InvalidPasswordException으로 돌려줌. 실제 Cognito는 NotAuthorizedException)')
else check('비밀번호 변경: 현재 비밀번호 틀림', r.status === 401 && r.data.error === 'invalid_credentials', JSON.stringify(r.data))
r = await b.req('POST', '/api/me/password', { currentPassword: 'Passw0rd!', newPassword: 'Newpass1!' })
check('비밀번호 변경', r.status === 200, JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/forgot', { email: B })
check('비밀번호 찾기 코드 발송', r.status === 200, JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/forgot', { email: 'nobody@example.com' })
check('없는 계정 비밀번호 찾기도 같은 응답', r.status === 200, JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/reset', { email: B, code: '111111', password: 'Reset123!' })
check('틀린 재설정 코드 거절', r.status === 400 && r.data.error === 'code_mismatch', JSON.stringify(r.data))
r = await anon.req('POST', '/api/auth/reset', { email: B, code: codeFor(B), password: 'weak' })
check('재설정 비밀번호 정책 검증', r.status === 400 && r.data.error === 'weak_password')
r = await anon.req('POST', '/api/auth/reset', { email: B, code: codeFor(B), password: 'Reset123!' })
check('비밀번호 재설정', r.status === 200, JSON.stringify(r.data))
r = await new Browser().req('POST', '/api/auth/login', { email: B, password: 'Newpass1!' })
check('재설정 후 이전 비밀번호 거절', r.status === 401)
const b2 = new Browser()
r = await b2.req('POST', '/api/auth/login', { email: B, password: 'Reset123!' })
check('재설정한 비밀번호로 로그인', r.status === 200)

// ── 로그아웃 ─────────────────────────────────────────────
r = await b2.req('POST', '/api/auth/logout', {})
check('로그아웃', r.status === 200 && !b2.jar.has('ms_rt'))
r = await b2.req('GET', '/api/auth/session')
check('로그아웃 후 세션 없음', r.status === 401)

// ── 삭제 ─────────────────────────────────────────────────
r = await a.req('DELETE', `/api/admin/users/${bId}`, { confirmEmail: 'wrong@example.com' })
check('삭제: 확인 이메일 불일치 거절', r.status === 400)
r = await b.req('DELETE', `/api/admin/users/${aId}`, { confirmEmail: A })
check('일반 회원의 삭제 API 호출 차단', r.status === 403 || r.status === 401)
r = await a.req('DELETE', `/api/admin/users/${bId}`, { confirmEmail: B.toUpperCase() })
check('회원 삭제', r.status === 200, JSON.stringify(r.data))
r = await b2.req('POST', '/api/auth/login', { email: B, password: 'Reset123!' })
check('삭제된 회원 로그인 불가 (Cognito 계정 삭제)', r.status === 401)
r = await a.req('GET', `/api/admin/users/${bId}`)
check('삭제된 회원 프로필 없음', r.status === 404)
r = await a.req('GET', '/api/admin/users')
check('삭제 후 통계', r.data.stats?.total === 1)

// ── 기존 기능 ────────────────────────────────────────────
r = await anon.req('GET', '/api/agent')
check('에이전트 API: 비로그인 401', r.status === 401)
r = await a.req('GET', '/api/agent')
check('에이전트 API: 로그인 회원 통과 (쿠키 세션)', r.status === 200 && (r.data.mode === 'public' || r.data.mode === 'internal'), JSON.stringify(r.data))

const failed = results.filter((x) => !x.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
