'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordField } from '@/components/auth/PasswordField'
import { SERVICE_UNAVAILABLE, loginErrorMessage, looksLikeEmail } from '@/components/auth/authErrors'
import styles from '@/components/auth/Auth.module.css'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { logDevError } from '@/lib/errors'

type FieldErrors = { email?: string; password?: string }
type Message = { tone: 'success' | 'danger'; text: string }

export function LoginForm() {
  const router = useRouter()
  const { status, getClient } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // 방금 로그인에 성공했으면 안내를 잠시 보여 준 뒤 직접 이동한다
  const succeeded = useRef(false)

  // 이미 로그인된 상태로 들어오면 홈으로 보낸다
  useEffect(() => {
    if (status === 'signed-in' && !succeeded.current) router.replace('/')
  }, [status, router])

  // 제출 지연을 줄이려고 인증 SDK를 미리 불러 둔다
  useEffect(() => {
    getClient().catch((error: unknown) => logDevError('login:preload', error))
  }, [getClient])

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) next.email = '이메일을 입력해주세요.'
    else if (!looksLikeEmail(trimmed)) next.email = '유효하지 않은 이메일 형식입니다.'
    if (!password) next.password = '비밀번호를 입력해주세요.'
    return next
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

    setSubmitting(true)
    setMessage(null)
    try {
      const client = await getClient().catch((error: unknown) => {
        logDevError('login:client', error)
        return null
      })
      if (!client) {
        setMessage({ tone: 'danger', text: SERVICE_UNAVAILABLE })
        setSubmitting(false)
        return
      }

      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        logDevError('login', error)
        setMessage({ tone: 'danger', text: loginErrorMessage(error) })
        setSubmitting(false)
        return
      }

      succeeded.current = true
      setMessage({ tone: 'success', text: '로그인되었습니다. 이동합니다…' })
      window.setTimeout(() => router.replace('/'), 600)
    } catch (error) {
      logDevError('login', error)
      setMessage({ tone: 'danger', text: SERVICE_UNAVAILABLE })
      setSubmitting(false)
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
          maxLength={50}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
          }}
          error={errors.password}
        />

        {message &&
          (message.tone === 'danger' ? (
            <div role="alert">
              <Notice tone="danger">{message.text}</Notice>
            </div>
          ) : (
            <Notice tone="success" live>
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
