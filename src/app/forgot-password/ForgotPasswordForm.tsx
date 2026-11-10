'use client'

/**
 * 비밀번호 재설정 2단계: ① 이메일로 코드 받기 ② 코드 + 새 비밀번호 → 로그인 화면.
 * 가입하지 않은 이메일이어도 ①은 같은 안내를 보여 준다 (가입 여부 비노출).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type SubmitEvent } from 'react'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordField } from '@/components/auth/PasswordField'
import { PasswordPolicy } from '@/components/auth/PasswordPolicy'
import { looksLikeEmail, memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import styles from '@/components/auth/Auth.module.css'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { looksLikeCode, normalizeEmail, passwordProblem } from '@/lib/account'
import { logDevError } from '@/lib/errors'

type Step = 'request' | 'reset'
type Message = { tone: 'success' | 'danger' | 'info' | 'warning'; text: string }
type FieldName = 'email' | 'code' | 'password' | 'passwordConfirm'

export function ForgotPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const preset = normalizeEmail(params.get('email') ?? '')
    if (looksLikeEmail(preset)) setEmail(preset)
    if (params.get('reason') === 'reset_required') {
      setMessage({ tone: 'warning', text: '보안 정책이 바뀌어 비밀번호를 새로 정해야 합니다. 이메일로 인증 코드를 받아주세요.' })
    }
  }, [])

  const clear = (name: FieldName) => {
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const requestCode = async (event?: SubmitEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (submitting) return
    const target = normalizeEmail(email)
    if (!looksLikeEmail(target)) {
      setErrors({ email: '가입한 이메일을 입력해주세요.' })
      document.getElementById('forgot-email')?.focus()
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      await memberApi('/api/auth/forgot', { method: 'POST', body: { email: target } })
      setEmail(target)
      setStep('reset')
      setMessage({ tone: 'info', text: '가입된 이메일이면 인증 코드가 발송됩니다. 메일함(스팸함 포함)을 확인해주세요.' })
    } catch (error) {
      logDevError('forgot', error)
      setMessage({ tone: 'danger', text: memberErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors: Partial<Record<FieldName, string>> = {}
    if (!looksLikeCode(code)) nextErrors.code = '메일로 받은 6자리 숫자를 입력해주세요.'
    const problem = passwordProblem(password)
    if (problem) nextErrors.password = problem
    if (!passwordConfirm) nextErrors.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
    else if (password !== passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    setErrors(nextErrors)
    const first = (['code', 'password', 'passwordConfirm'] as const).find((name) => nextErrors[name])
    if (first) {
      document.getElementById(`forgot-${first}`)?.focus()
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await memberApi('/api/auth/reset', { method: 'POST', body: { email, code: code.trim(), password } })
      setMessage({ tone: 'success', text: '비밀번호를 바꿨습니다. 로그인 화면으로 이동합니다…' })
      window.setTimeout(() => router.replace(`/login?reset=1&email=${encodeURIComponent(email)}`), 900)
    } catch (error) {
      logDevError('reset', error)
      if (isApiError(error, 'weak_password')) setErrors({ password: memberErrorMessage(error) })
      setMessage({ tone: 'danger', text: memberErrorMessage(error, 'reset') })
      setSubmitting(false)
    }
  }

  const notice = message &&
    (message.tone === 'danger' ? (
      <div role="alert">
        <Notice tone="danger">{message.text}</Notice>
      </div>
    ) : (
      <Notice tone={message.tone} live>
        {message.text}
      </Notice>
    ))

  return (
    <AuthCard
      title="비밀번호 재설정"
      description={step === 'request' ? '가입한 이메일을 입력하세요' : '인증 코드와 새 비밀번호를 입력하세요'}
      footer={
        <>
          <Link href="/login">로그인</Link>
          <Link href="/signup">회원가입</Link>
        </>
      }
    >
      {step === 'request' ? (
        <form className={styles.form} onSubmit={requestCode} noValidate>
          <TextField
            id="forgot-email"
            label="이메일"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="email@example.com"
            maxLength={100}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              clear('email')
            }}
            error={errors.email}
          />
          {notice}
          <Button type="submit" block size="lg" loading={submitting}>
            인증 코드 받기
          </Button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={reset} noValidate>
          <p className={styles.codeNote}>
            <strong>{email}</strong>
          </p>
          <TextField
            id="forgot-code"
            label="인증 코드"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6자리 숫자"
            maxLength={6}
            mono
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              clear('code')
            }}
            error={errors.code}
          />
          <PasswordField
            id="forgot-password"
            label="새 비밀번호"
            autoComplete="new-password"
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            maxLength={64}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              clear('password')
            }}
            error={errors.password}
            hint={<PasswordPolicy password={password} />}
          />
          <PasswordField
            id="forgot-passwordConfirm"
            label="새 비밀번호 확인"
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력하세요"
            maxLength={64}
            value={passwordConfirm}
            onChange={(event) => {
              setPasswordConfirm(event.target.value)
              clear('passwordConfirm')
            }}
            error={errors.passwordConfirm}
          />
          {notice}
          <Button type="submit" block size="lg" loading={submitting}>
            비밀번호 바꾸기
          </Button>
          <p className={styles.resendRow}>
            코드를 받지 못하셨나요?
            <button type="button" className={styles.linkButton} disabled={submitting} onClick={() => void requestCode()}>
              다시 받기
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                setStep('request')
                setMessage(null)
                setCode('')
              }}
            >
              이메일 바꾸기
            </button>
          </p>
        </form>
      )}
    </AuthCard>
  )
}
