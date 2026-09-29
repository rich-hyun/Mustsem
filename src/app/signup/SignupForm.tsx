'use client'

import { WarningCircleIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordField } from '@/components/auth/PasswordField'
import { SERVICE_UNAVAILABLE, looksLikeEmail, signupErrorMessage } from '@/components/auth/authErrors'
import styles from '@/components/auth/Auth.module.css'
import { MarketingConsent } from '@/components/legal/MarketingConsent'
import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { TermsContent } from '@/components/legal/TermsContent'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
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
  const { status, getClient } = useAuth()

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
  const succeeded = useRef(false)
  const agreeAllRef = useRef<HTMLInputElement>(null)

  const allAgreed = agree.terms && agree.privacy && agree.marketing
  const someAgreed = agree.terms || agree.privacy || agree.marketing

  useEffect(() => {
    if (status === 'signed-in' && !succeeded.current) router.replace('/')
  }, [status, router])

  useEffect(() => {
    getClient().catch((error: unknown) => logDevError('signup:preload', error))
  }, [getClient])

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
    const trimmedEmail = email.trim()
    if (!trimmedEmail) next.email = '이메일을 입력해주세요.'
    else if (!looksLikeEmail(trimmedEmail)) next.email = '유효하지 않은 이메일 형식입니다.'
    if (password.length < 8) next.password = '비밀번호는 8자 이상이어야 합니다.'
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

    setSubmitting(true)
    setMessage(null)
    try {
      const client = await getClient().catch((error: unknown) => {
        logDevError('signup:client', error)
        return null
      })
      if (!client) {
        setMessage({ tone: 'danger', text: SERVICE_UNAVAILABLE })
        setSubmitting(false)
        return
      }

      const last = lastName.trim()
      const first = firstName.trim()
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: last + first,
            last_name: last,
            first_name: first,
            company: company.trim() || null,
            marketing_agreed: agree.marketing,
          },
          emailRedirectTo: `${window.location.origin}/confirm`,
        },
      })

      if (error) {
        logDevError('signup', error)
        setMessage({ tone: 'danger', text: signupErrorMessage(error) })
        setSubmitting(false)
        return
      }

      succeeded.current = true
      if (data.session) {
        setMessage({ tone: 'success', text: '가입이 완료되었습니다. 이동합니다…' })
        window.setTimeout(() => router.replace('/'), 600)
      } else {
        setMessage({ tone: 'success', text: '가입이 완료되었습니다. 이메일을 확인해주세요.' })
        window.setTimeout(() => router.replace('/login'), 1500)
      }
    } catch (error) {
      logDevError('signup', error)
      setMessage({ tone: 'danger', text: SERVICE_UNAVAILABLE })
      setSubmitting(false)
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
            placeholder="8자 이상 입력하세요"
            maxLength={50}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              clearError('password')
            }}
            error={errors.password}
            hint={
              password ? (
                <>
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
            maxLength={50}
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
                <Notice tone="danger">{message.text}</Notice>
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
