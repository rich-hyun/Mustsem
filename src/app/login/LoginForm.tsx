'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useAuth, type AuthUser } from '@/components/auth/AuthProvider'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordField } from '@/components/auth/PasswordField'
import { looksLikeEmail, memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import styles from '@/components/auth/Auth.module.css'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { normalizeEmail, safeNextPath } from '@/lib/account'
import { logDevError } from '@/lib/errors'

type FieldErrors = { email?: string; password?: string }
type Message = { tone: 'success' | 'danger' | 'info'; text: string }

/** 다른 화면에서 넘어올 때 붙는 안내 (?verified=1 등) */
function arrivalMessage(params: URLSearchParams): Message | null {
  if (params.get('verified') === '1') return { tone: 'success', text: '이메일 인증이 완료되었습니다. 로그인해주세요.' }
  if (params.get('reset') === '1') return { tone: 'success', text: '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해주세요.' }
  if (params.get('reason') === 'expired') return { tone: 'info', text: '로그인이 만료되었습니다. 다시 로그인해주세요.' }
  if (params.get('reason') === 'disabled') return { tone: 'danger', text: '이용이 중지된 계정입니다. 고객센터로 문의해주세요.' }
  if (params.get('next')) return { tone: 'info', text: '로그인이 필요한 페이지입니다.' }
  return null
}

export function LoginForm() {
  const router = useRouter()
  const { status, signedIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [next, setNext] = useState('/')
  // 방금 로그인에 성공했으면 안내를 잠시 보여 준 뒤 직접 이동한다
  const succeeded = useRef(false)

  // 주소의 안내·돌아갈 곳·이메일을 읽는다 (정적 페이지라 클라이언트에서 읽는다)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setNext(safeNextPath(params.get('next')))
    const presetEmail = params.get('email')
    if (presetEmail && looksLikeEmail(presetEmail)) setEmail(presetEmail)
    setMessage(arrivalMessage(params))
  }, [])

  // 이미 로그인된 상태로 들어오면 돌아갈 곳으로 보낸다
  useEffect(() => {
    if (status === 'signed-in' && !succeeded.current) router.replace(next)
  }, [status, router, next])

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) nextErrors.email = '이메일을 입력해주세요.'
    else if (!looksLikeEmail(trimmed)) nextErrors.email = '유효하지 않은 이메일 형식입니다.'
    if (!password) nextErrors.password = '비밀번호를 입력해주세요.'
    return nextErrors
  }

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors = validate()
    setErrors(nextErrors)
    const firstInvalid = nextErrors.email ? 'login-email' : nextErrors.password ? 'login-password' : null
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    const normalized = normalizeEmail(email)
    setSubmitting(true)
    setMessage(null)
    try {
      const { user } = await memberApi<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email: normalized, password },
      })
      succeeded.current = true
      signedIn(user)
      setMessage({ tone: 'success', text: '로그인되었습니다. 이동합니다…' })
      window.setTimeout(() => router.replace(next), 600)
    } catch (error) {
      logDevError('login', error)
      setSubmitting(false)
      if (isApiError(error, 'not_confirmed')) {
        // 인증 코드 단계로 보낸다. 새 코드를 받을 수 있게 표시한다
        router.push(`/confirm?email=${encodeURIComponent(normalized)}&resend=1`)
        return
      }
      if (isApiError(error, 'password_reset_required')) {
        router.push(`/forgot-password?email=${encodeURIComponent(normalized)}&reason=reset_required`)
        return
      }
      setMessage({ tone: 'danger', text: memberErrorMessage(error, 'login') })
    }
  }

  return (
    <AuthCard
      title="MUSTSEM 로그인"
      description="Web3 인프라 플랫폼 로그인"
      footer={
        <>
          <Link href="/signup">회원가입</Link>
          <Link href="/">홈으로 돌아가기</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          id="login-email"
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="이메일을 입력하세요"
          maxLength={100}
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
          }}
          error={errors.email}
        />
        <PasswordField
          id="login-password"
          label="비밀번호"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          maxLength={64}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
          }}
          error={errors.password}
        />
        <p className={styles.inlineLinks}>
          <Link href={email && looksLikeEmail(email.trim()) ? `/forgot-password?email=${encodeURIComponent(normalizeEmail(email))}` : '/forgot-password'}>
            비밀번호를 잊으셨나요?
          </Link>
        </p>

        {message &&
          (message.tone === 'danger' ? (
            <div role="alert">
              <Notice tone="danger">{message.text}</Notice>
            </div>
          ) : (
            <Notice tone={message.tone} live>
              {message.text}
            </Notice>
          ))}

        <Button type="submit" block size="lg" loading={submitting}>
          로그인
        </Button>
      </form>
    </AuthCard>
  )
}
