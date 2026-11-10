'use client'

/**
 * 회원가입 이메일 인증. Cognito가 보낸 6자리 코드를 넣으면 가입이 끝나고 로그인 화면으로 간다.
 * 주소: /confirm?email=…(&resend=1 이면 들어오자마자 새 코드를 보낸다. 로그인 시 미인증 계정)
 */
import { CheckCircleIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react'
import { AuthCard } from '@/components/auth/AuthCard'
import { looksLikeEmail, memberErrorMessage } from '@/components/auth/authErrors'
import { memberApi } from '@/components/auth/memberApi'
import styles from '@/components/auth/Auth.module.css'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { looksLikeCode, normalizeEmail } from '@/lib/account'
import { logDevError } from '@/lib/errors'

type Message = { tone: 'success' | 'danger' | 'info'; text: string }
const RESEND_COOLDOWN = 60
const REDIRECT_MS = 1800

export function ConfirmForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ email?: string; code?: string }>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const autoResent = useRef(false)

  const resend = useCallback(async (target: string) => {
    if (!looksLikeEmail(target)) {
      setErrors({ email: '인증 코드를 받을 이메일을 입력해주세요.' })
      return
    }
    setResending(true)
    try {
      await memberApi('/api/auth/resend', { method: 'POST', body: { email: target } })
      setMessage({ tone: 'info', text: '새 인증 코드를 보냈습니다. 메일함(스팸함 포함)을 확인해주세요.' })
      setCooldown(RESEND_COOLDOWN)
    } catch (error) {
      logDevError('confirm:resend', error)
      setMessage({ tone: 'danger', text: memberErrorMessage(error) })
    } finally {
      setResending(false)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const preset = normalizeEmail(params.get('email') ?? '')
    if (looksLikeEmail(preset)) {
      setEmail(preset)
      if (params.get('resend') === '1' && !autoResent.current) {
        autoResent.current = true
        setMessage({ tone: 'info', text: '이메일 인증을 마쳐야 로그인할 수 있습니다.' })
        void resend(preset)
      } else {
        setCooldown(RESEND_COOLDOWN)
      }
    }
  }, [resend])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || done) return
    const target = normalizeEmail(email)
    const nextErrors: { email?: string; code?: string } = {}
    if (!looksLikeEmail(target)) nextErrors.email = '가입한 이메일을 입력해주세요.'
    if (!looksLikeCode(code)) nextErrors.code = '메일로 받은 6자리 숫자를 입력해주세요.'
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.code) {
      document.getElementById(nextErrors.email ? 'confirm-email' : 'confirm-code')?.focus()
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await memberApi('/api/auth/confirm', { method: 'POST', body: { email: target, code: code.trim() } })
      setDone(true)
      window.setTimeout(() => router.replace(`/login?verified=1&email=${encodeURIComponent(target)}`), REDIRECT_MS)
    } catch (error) {
      logDevError('confirm', error)
      setMessage({ tone: 'danger', text: memberErrorMessage(error, 'confirm') })
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="MUSTSEM 이메일 인증">
        <div className={styles.result}>
          <span className={styles.resultIcon} data-tone="success">
            <CheckCircleIcon size={36} weight="fill" aria-hidden />
          </span>
          <p className={styles.resultTitle} role="status">
            가입이 완료되었습니다
          </p>
          <p className={styles.resultText}>이메일 인증이 끝났습니다. 로그인 화면으로 이동합니다.</p>
          <Button href={`/login?verified=1&email=${encodeURIComponent(normalizeEmail(email))}`} className={styles.resultAction}>
            바로 로그인하기
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="MUSTSEM 이메일 인증"
      description="메일로 받은 6자리 인증 코드를 입력하세요"
      footer={
        <>
          <Link href="/signup">회원가입</Link>
          <Link href="/login">로그인</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {email && looksLikeEmail(email) ? (
          <p className={styles.codeNote}>
            <strong>{email}</strong> 주소로 인증 코드를 보냈습니다.{' '}
            <span className="keep">코드는 24시간 동안 유효합니다.</span>
          </p>
        ) : null}
        <TextField
          id="confirm-email"
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="가입한 이메일"
          maxLength={100}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
          }}
          error={errors.email}
        />
        <TextField
          id="confirm-code"
          label="인증 코드"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6자리 숫자"
          maxLength={6}
          mono
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            if (errors.code) setErrors((current) => ({ ...current, code: undefined }))
          }}
          error={errors.code}
        />

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
          인증 완료
        </Button>
        <p className={styles.resendRow}>
          메일을 받지 못하셨나요?
          <button
            type="button"
            className={styles.linkButton}
            disabled={cooldown > 0 || resending}
            onClick={() => void resend(normalizeEmail(email))}
          >
            {cooldown > 0 ? `${cooldown}초 뒤 다시 받기` : resending ? '보내는 중' : '코드 다시 받기'}
          </button>
        </p>
      </form>
    </AuthCard>
  )
}
