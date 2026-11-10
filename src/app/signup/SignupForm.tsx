'use client'

import { WarningCircleIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordField } from '@/components/auth/PasswordField'
import { PasswordPolicy } from '@/components/auth/PasswordPolicy'
import { looksLikeEmail, memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import styles from '@/components/auth/Auth.module.css'
import { MarketingConsent } from '@/components/legal/MarketingConsent'
import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { TermsContent } from '@/components/legal/TermsContent'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { NAME_MAX, normalizeEmail, passwordProblem } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { STRENGTH_LABELS, passwordStrength } from './passwordStrength'

type FieldName = 'lastName' | 'firstName' | 'email' | 'password' | 'passwordConfirm' | 'agreements'
type FieldErrors = Partial<Record<FieldName, string>>
type Message = { tone: 'success' | 'danger'; text: string }
type DocId = 'terms' | 'privacy' | 'marketing'

/** 오류가 난 첫 입력칸으로 포커스를 옮길 때의 순서 */
const FIELD_ORDER: Array<[FieldName, string]> = [
  ['lastName', 'signup-last-name'],
  ['firstName', 'signup-first-name'],
  ['email', 'signup-email'],
  ['password', 'signup-password'],
  ['passwordConfirm', 'signup-password-confirm'],
  ['agreements', 'signup-agree-terms'],
]

const DOCS: Record<DocId, { title: string; href?: string }> = {
  terms: { title: '서비스 이용약관', href: '/terms' },
  privacy: { title: '개인정보 처리방침', href: '/privacy' },
  marketing: { title: '마케팅 수신 동의' },
}

export function SignupForm() {
  const router = useRouter()
  const { status } = useAuth()

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [agree, setAgree] = useState({ terms: false, privacy: false, marketing: false })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [openDoc, setOpenDoc] = useState<DocId | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const succeeded = useRef(false)
  const agreeAllRef = useRef<HTMLInputElement>(null)

  const allAgreed = agree.terms && agree.privacy && agree.marketing
  const someAgreed = agree.terms || agree.privacy || agree.marketing

  useEffect(() => {
    if (status === 'signed-in' && !succeeded.current) router.replace('/')
  }, [status, router])

  // 일부만 동의한 상태는 '전체 동의'를 중간 상태로 보여 준다
  useEffect(() => {
    if (agreeAllRef.current) agreeAllRef.current.indeterminate = someAgreed && !allAgreed
  }, [someAgreed, allAgreed])

  const clearError = (name: FieldName) => {
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  const setAgreement = (key: keyof typeof agree, checked: boolean) => {
    setAgree((current) => ({ ...current, [key]: checked }))
    if (key !== 'marketing') clearError('agreements')
  }

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!lastName.trim()) next.lastName = '성을 입력해주세요.'
    if (!firstName.trim()) next.firstName = '이름을 입력해주세요.'
    else if ((lastName.trim() + firstName.trim()).length > NAME_MAX) next.firstName = `성과 이름을 합쳐 ${NAME_MAX}자 이하로 입력해주세요.`
    const trimmedEmail = email.trim()
    if (!trimmedEmail) next.email = '이메일을 입력해주세요.'
    else if (!looksLikeEmail(trimmedEmail)) next.email = '유효하지 않은 이메일 형식입니다.'
    const passwordError = passwordProblem(password)
    if (passwordError) next.password = passwordError
    if (!passwordConfirm) next.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
    else if (password !== passwordConfirm) next.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    if (!agree.terms || !agree.privacy) next.agreements = '필수 약관에 동의해주세요.'
    return next
  }

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors = validate()
    setErrors(nextErrors)
    const firstInvalid = FIELD_ORDER.find(([name]) => nextErrors[name])
    if (firstInvalid) {
      document.getElementById(firstInvalid[1])?.focus()
      return
    }

    const normalized = normalizeEmail(email)
    setSubmitting(true)
    setMessage(null)
    setUnverifiedEmail(null)
    try {
      await memberApi('/api/auth/signup', {
        method: 'POST',
        body: {
          name: lastName.trim() + firstName.trim(),
          email: normalized,
          password,
          company: company.trim(),
          marketingAgreed: agree.marketing,
          agreeTerms: agree.terms && agree.privacy,
        },
      })
      succeeded.current = true
      setMessage({ tone: 'success', text: '인증 코드를 이메일로 보냈습니다. 인증 화면으로 이동합니다…' })
      window.setTimeout(() => router.push(`/confirm?email=${encodeURIComponent(normalized)}`), 900)
    } catch (error) {
      logDevError('signup', error)
      setSubmitting(false)
      if (isApiError(error, 'email_taken')) setUnverifiedEmail(normalized)
      if (isApiError(error, 'weak_password')) setErrors((current) => ({ ...current, password: memberErrorMessage(error) }))
      setMessage({ tone: 'danger', text: memberErrorMessage(error, 'signup') })
    }
  }

  const strength = password ? passwordStrength(password) : 0
  const strengthLabel = STRENGTH_LABELS[strength]
  const doc = openDoc ? DOCS[openDoc] : null

  return (
    <>
      <AuthCard
        wide
        title="MUSTSEM 회원가입"
        description="Web3 인프라 플랫폼 계정 만들기"
        footer={
          <>
            <Link href="/login">이미 계정이 있으신가요? 로그인</Link>
            <Link href="/">홈으로</Link>
          </>
        }
      >
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <div className={styles.row2}>
            <TextField
              id="signup-last-name"
              label="성"
              autoComplete="family-name"
              placeholder="홍"
              maxLength={20}
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value)
                clearError('lastName')
              }}
              error={errors.lastName}
            />
            <TextField
              id="signup-first-name"
              label="이름"
              autoComplete="given-name"
              placeholder="길동"
              maxLength={30}
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value)
                clearError('firstName')
              }}
              error={errors.firstName}
            />
          </div>

          <TextField
            id="signup-email"
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
              clearError('email')
            }}
            error={errors.email}
          />

          <TextField
            id="signup-company"
            label="회사명"
            optional
            autoComplete="organization"
            placeholder="회사명을 입력하세요"
            maxLength={100}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />

          <PasswordField
            id="signup-password"
            label="비밀번호"
            autoComplete="new-password"
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            maxLength={64}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              clearError('password')
            }}
            error={errors.password}
            hint={
              password ? (
                <>
                  <PasswordPolicy password={password} />
                  <span className={styles.strength} data-level={strength} aria-hidden>
                    {[1, 2, 3, 4].map((segment) => (
                      <span key={segment} className={`${styles.segment} ${segment <= strength ? styles.on : ''}`} />
                    ))}
                  </span>
                  <span className={styles.strengthLabel} aria-live="polite">
                    {strengthLabel ? `비밀번호 강도: ${strengthLabel}` : '비밀번호 강도: 8자 이상 입력하세요'}
                  </span>
                </>
              ) : undefined
            }
          />

          <PasswordField
            id="signup-password-confirm"
            label="비밀번호 확인"
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력하세요"
            maxLength={64}
            value={passwordConfirm}
            onChange={(event) => {
              setPasswordConfirm(event.target.value)
              clearError('passwordConfirm')
            }}
            error={errors.passwordConfirm}
          />

          <fieldset className={styles.terms} aria-describedby={errors.agreements ? 'signup-agreements-error' : undefined}>
            <legend className={styles.termsLegend}>약관 동의</legend>
            <div className={styles.termsAll}>
              <label className={`${styles.check} ${styles.checkAll}`}>
                <input
                  ref={agreeAllRef}
                  type="checkbox"
                  checked={allAgreed}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setAgree({ terms: checked, privacy: checked, marketing: checked })
                    clearError('agreements')
                  }}
                />
                전체 동의
              </label>
            </div>
            <TermRow
              id="signup-agree-terms"
              checked={agree.terms}
              onChange={(checked) => setAgreement('terms', checked)}
              onView={() => setOpenDoc('terms')}
              required
            >
              서비스 이용약관
            </TermRow>
            <TermRow
              id="signup-agree-privacy"
              checked={agree.privacy}
              onChange={(checked) => setAgreement('privacy', checked)}
              onView={() => setOpenDoc('privacy')}
              required
            >
              개인정보 처리방침
            </TermRow>
            <TermRow
              id="signup-agree-marketing"
              checked={agree.marketing}
              onChange={(checked) => setAgreement('marketing', checked)}
              onView={() => setOpenDoc('marketing')}
            >
              마케팅 수신 동의
            </TermRow>
            {errors.agreements && (
              <p id="signup-agreements-error" className={styles.termsError} role="alert">
                <WarningCircleIcon size={15} weight="fill" aria-hidden />
                {errors.agreements}
              </p>
            )}
          </fieldset>

          {message &&
            (message.tone === 'danger' ? (
              <div role="alert">
                <Notice
                  tone="danger"
                  actions={
                    unverifiedEmail ? (
                      <>
                        <Button href={`/login?email=${encodeURIComponent(unverifiedEmail)}`} size="sm" variant="secondary">
                          로그인
                        </Button>
                        <Button href={`/confirm?email=${encodeURIComponent(unverifiedEmail)}&resend=1`} size="sm" variant="ghost">
                          인증 코드 다시 받기
                        </Button>
                      </>
                    ) : undefined
                  }
                >
                  {message.text}
                  {unverifiedEmail && ' 이메일 인증을 마치지 않았다면 인증 코드를 다시 받을 수 있습니다.'}
                </Notice>
              </div>
            ) : (
              <Notice tone="success" live>
                {message.text}
              </Notice>
            ))}

          <Button type="submit" block size="lg" loading={submitting}>
            회원가입
          </Button>
        </form>
      </AuthCard>

      <Dialog
        open={doc !== null}
        onClose={() => setOpenDoc(null)}
        title={doc?.title ?? ''}
        size="lg"
        footer={
          <>
            {doc?.href && (
              <Button href={doc.href} variant="ghost" size="sm" target="_blank" rel="noopener noreferrer" style={{ marginRight: 'auto' }}>
                전문 페이지에서 보기
              </Button>
            )}
            <Button size="sm" onClick={() => setOpenDoc(null)}>
              확인
            </Button>
          </>
        }
      >
        {openDoc === 'terms' && <TermsContent headingLevel="h3" compact />}
        {openDoc === 'privacy' && <PrivacyContent headingLevel="h3" compact />}
        {openDoc === 'marketing' && <MarketingConsent headingLevel="h3" />}
      </Dialog>
    </>
  )
}

interface TermRowProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  onView: () => void
  required?: boolean
  children: string
}

function TermRow({ id, checked, onChange, onView, required, children }: TermRowProps) {
  return (
    <div className={styles.termRow}>
      <label className={styles.check} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>
          <span className={required ? styles.required : styles.optionalTag}>{required ? '[필수]' : '[선택]'}</span> {children}
        </span>
      </label>
      <button type="button" className={styles.view} onClick={onView} aria-label={`${children} 전문 보기`}>
        보기
      </button>
    </div>
  )
}
