'use client'

/**
 * 내 정보: 계정 정보(L1) · 기본 정보 수정(L2) · 비밀번호 변경(L2).
 * 표시 값은 모두 서버(/api/me)가 DynamoDB에서 읽어 준 것이다.
 */
import { SignOutIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr'
import { useEffect, useState, type SubmitEvent } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { PasswordField } from '@/components/auth/PasswordField'
import { PasswordPolicy } from '@/components/auth/PasswordPolicy'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import { Badge, KeyValueList, Spinner } from '@/components/ui/DataDisplay'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { COMPANY_MAX, NAME_MAX, ROLE_LABELS, STATUS_LABELS, nameProblem, passwordProblem, type MemberProfile } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import styles from './account.module.css'

type Message = { tone: 'success' | 'danger'; text: string }

function FormMessage({ message }: { message: Message | null }) {
  if (!message) return null
  return message.tone === 'danger' ? (
    <div role="alert">
      <Notice tone="danger">{message.text}</Notice>
    </div>
  ) : (
    <Notice tone="success" live>
      {message.text}
    </Notice>
  )
}

export function AccountView() {
  return <RequireAuth>{() => <AccountContent />}</RequireAuth>
}

function AccountContent() {
  const { user, refresh, signOut } = useAuth()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    memberApi<{ profile: MemberProfile }>('/api/me')
      .then(({ profile: loaded }) => {
        if (!cancelled) setProfile(loaded)
      })
      .catch((error: unknown) => {
        logDevError('account:load', error)
        if (!cancelled) setLoadError(memberErrorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loadError) return <Notice tone="danger">{loadError}</Notice>
  if (!profile) {
    return (
      <div className={styles.loading} role="status">
        <Spinner size={22} /> 계정 정보를 불러오고 있습니다.
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        <Card padding="lg" as="section" aria-labelledby="account-info-title">
          <div className={styles.cardHead}>
            <h2 id="account-info-title" className={styles.cardTitle}>
              계정 정보
            </h2>
            <Badge tone={profile.role === 'ADMIN' ? 'info' : 'neutral'} pill>
              {ROLE_LABELS[profile.role]}
            </Badge>
          </div>
          <KeyValueList
            stacked
            items={[
              { label: '이름', value: profile.name },
              { label: '이메일 (로그인 ID)', value: <span data-break="anywhere">{profile.email}</span> },
              { label: '회사명', value: profile.company ?? '-' },
              { label: '계정 상태', value: STATUS_LABELS[profile.status] },
              { label: '가입일', value: formatDate(profile.createdAt) },
              { label: '최근 로그인', value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '-' },
              { label: '정보 수정일', value: formatDateTime(profile.updatedAt) },
            ]}
          />
        </Card>
        <div className={styles.actions}>
          {user?.role === 'ADMIN' && (
            <Button href="/admin/members" variant="secondary" size="sm">
              <UsersThreeIcon size={16} aria-hidden /> 회원 관리
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <SignOutIcon size={16} aria-hidden /> 로그아웃
          </Button>
        </div>
      </div>

      <div className={styles.main}>
        <ProfileForm
          profile={profile}
          onSaved={(next) => {
            setProfile(next)
            // 헤더의 이름도 새 값으로
            void refresh()
          }}
        />
        <PasswordForm />
      </div>
    </div>
  )
}

function ProfileForm({ profile, onSaved }: { profile: MemberProfile; onSaved: (profile: MemberProfile) => void }) {
  const [name, setName] = useState(profile.name)
  const [company, setCompany] = useState(profile.company ?? '')
  const [marketing, setMarketing] = useState(profile.marketingAgreed)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [saving, setSaving] = useState(false)

  const dirty = name.trim() !== profile.name || company.trim() !== (profile.company ?? '') || marketing !== profile.marketingAgreed

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const problem = nameProblem(name)
    setError(problem)
    if (problem) {
      document.getElementById('account-name')?.focus()
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const { profile: saved } = await memberApi<{ profile: MemberProfile }>('/api/me', {
        method: 'PATCH',
        body: { name: name.trim(), company: company.trim(), marketingAgreed: marketing },
      })
      onSaved(saved)
      setMessage({ tone: 'success', text: '저장했습니다.' })
    } catch (caught) {
      logDevError('account:save', caught)
      setMessage({ tone: 'danger', text: memberErrorMessage(caught) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card elevation="raised" padding="lg" as="section" aria-labelledby="account-edit-title">
      <h2 id="account-edit-title" className={styles.cardTitle}>
        기본 정보 수정
      </h2>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          id="account-name"
          label="이름"
          autoComplete="name"
          maxLength={NAME_MAX}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          error={error}
        />
        <TextField
          id="account-company"
          label="회사명"
          optional
          autoComplete="organization"
          maxLength={COMPANY_MAX}
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
        <label className={styles.check}>
          <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
          마케팅 정보 수신에 동의합니다
        </label>
        <p className={styles.help}>이메일은 로그인 ID라 바꿀 수 없습니다. 권한·계정 상태는 관리자만 바꿀 수 있습니다.</p>
        <FormMessage message={message} />
        <div className={styles.formActions}>
          <Button type="submit" loading={saving} disabled={!dirty}>
            저장
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const nextErrors: typeof errors = {}
    if (!current) nextErrors.current = '현재 비밀번호를 입력해주세요.'
    const problem = passwordProblem(next)
    if (problem) nextErrors.next = problem
    else if (next === current) nextErrors.next = '현재 비밀번호와 다른 비밀번호를 입력해주세요.'
    if (next !== confirm) nextErrors.confirm = '비밀번호가 일치하지 않습니다.'
    setErrors(nextErrors)
    const first = (['current', 'next', 'confirm'] as const).find((key) => nextErrors[key])
    if (first) {
      document.getElementById(`password-${first}`)?.focus()
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await memberApi('/api/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      setCurrent('')
      setNext('')
      setConfirm('')
      setMessage({ tone: 'success', text: '비밀번호를 바꿨습니다.' })
    } catch (caught) {
      logDevError('account:password', caught)
      if (isApiError(caught, 'invalid_credentials')) setErrors({ current: memberErrorMessage(caught, 'password') })
      setMessage({ tone: 'danger', text: memberErrorMessage(caught, 'password') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card elevation="raised" padding="lg" as="section" aria-labelledby="account-password-title">
      <h2 id="account-password-title" className={styles.cardTitle}>
        비밀번호 변경
      </h2>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <PasswordField
          id="password-current"
          label="현재 비밀번호"
          autoComplete="current-password"
          maxLength={64}
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          error={errors.current}
        />
        <PasswordField
          id="password-next"
          label="새 비밀번호"
          autoComplete="new-password"
          placeholder="영문, 숫자, 특수문자 포함 8자 이상"
          maxLength={64}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          error={errors.next}
          hint={<PasswordPolicy password={next} />}
        />
        <PasswordField
          id="password-confirm"
          label="새 비밀번호 확인"
          autoComplete="new-password"
          maxLength={64}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
        />
        <FormMessage message={message} />
        <div className={styles.formActions}>
          <Button type="submit" loading={saving}>
            비밀번호 변경
          </Button>
        </div>
      </form>
    </Card>
  )
}
