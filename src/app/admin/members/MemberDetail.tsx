'use client'

/**
 * 회원 상세 대화상자. 중요한 작업(비활성화·권한 변경·삭제)은 한 번 더 확인하고,
 * 삭제는 대상 이메일을 직접 입력해야 실행된다 (서버도 같은 이메일을 다시 확인한다).
 */
import { useEffect, useState } from 'react'
import { memberErrorMessage } from '@/components/auth/authErrors'
import { memberApi } from '@/components/auth/memberApi'
import { Badge, KeyValueList, Spinner } from '@/components/ui/DataDisplay'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { ROLE_LABELS, STATUS_LABELS, normalizeEmail, type MemberProfile } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import styles from './admin.module.css'
import { roleTone, statusTone } from './tones'

interface AuditEntry {
  at: string
  action: string
  actorEmail: string
  detail: string
}

interface Detail {
  profile: MemberProfile
  account: { confirmed: boolean; enabled: boolean } | null
  audit: AuditEntry[]
}

type Pending = 'disable' | 'enable' | 'promote' | 'demote' | 'delete'

const ACTION_LABELS: Record<string, string> = {
  'member.disable': '비활성화',
  'member.enable': '활성화',
  'member.role': '권한 변경',
  'member.delete': '삭제',
  'member.migrate': '기존 회원 이전',
}

const CONFIRM_TEXT: Record<Exclude<Pending, 'delete'>, { title: string; body: string; button: string }> = {
  disable: {
    title: '이 회원을 비활성화할까요?',
    body: '로그인이 막히고, 이미 로그인한 기기의 세션도 다음 요청부터 차단됩니다. 언제든 다시 활성화할 수 있습니다.',
    button: '비활성화',
  },
  enable: { title: '이 회원을 다시 활성화할까요?', body: '회원이 다시 로그인할 수 있게 됩니다.', button: '활성화' },
  promote: {
    title: '관리자 권한을 줄까요?',
    body: '이 회원이 모든 회원 정보를 보고 상태·권한을 바꾸거나 삭제할 수 있게 됩니다.',
    button: '관리자로 변경',
  },
  demote: { title: '일반 회원으로 바꿀까요?', body: '회원 관리 화면과 관리자 API를 더는 쓸 수 없게 됩니다.', button: '일반 회원으로 변경' },
}

interface MemberDetailProps {
  userId: string | null
  meId: string
  onClose: () => void
  onChanged: (message: string) => void
}

export function MemberDetail({ userId, meId, onClose, onChanged }: MemberDetailProps) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setLoadError(null)
    setPending(null)
    setConfirmEmail('')
    setActionError(null)
    if (!userId) return
    let cancelled = false
    memberApi<Detail>(`/api/admin/users/${encodeURIComponent(userId)}`)
      .then((loaded) => {
        if (!cancelled) setDetail(loaded)
      })
      .catch((error: unknown) => {
        logDevError('admin:detail', error)
        if (!cancelled) setLoadError(memberErrorMessage(error, 'admin'))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const profile = detail?.profile
  const isSelf = profile?.userId === meId

  const run = async () => {
    if (!profile || !pending || working) return
    setWorking(true)
    setActionError(null)
    try {
      const path = `/api/admin/users/${encodeURIComponent(profile.userId)}`
      if (pending === 'delete') {
        await memberApi(path, { method: 'DELETE', body: { confirmEmail: normalizeEmail(confirmEmail) } })
        onChanged(`${profile.name} (${profile.email}) 회원을 삭제했습니다.`)
        onClose()
        return
      }
      const body =
        pending === 'disable' ? { status: 'DISABLED' } : pending === 'enable' ? { status: 'ACTIVE' } : { role: pending === 'promote' ? 'ADMIN' : 'USER' }
      await memberApi<{ profile: MemberProfile }>(path, { method: 'PATCH', body })
      const refreshed = await memberApi<Detail>(path)
      setDetail(refreshed)
      setPending(null)
      onChanged(`${profile.name} 회원: ${CONFIRM_TEXT[pending].button} 완료`)
    } catch (error) {
      logDevError('admin:action', error)
      setActionError(memberErrorMessage(error, 'admin'))
    } finally {
      setWorking(false)
    }
  }

  const deleteReady = profile ? normalizeEmail(confirmEmail) === profile.email : false

  let footer = null
  if (profile && pending) {
    footer = (
      <>
        <Button variant="ghost" size="sm" onClick={() => setPending(null)} disabled={working}>
          취소
        </Button>
        <Button
          variant={pending === 'delete' || pending === 'disable' ? 'danger' : 'primary'}
          size="sm"
          loading={working}
          disabled={pending === 'delete' && !deleteReady}
          onClick={() => void run()}
        >
          {pending === 'delete' ? '영구 삭제' : CONFIRM_TEXT[pending].button}
        </Button>
      </>
    )
  } else if (profile && !isSelf) {
    footer = (
      <>
        <Button variant="danger" size="sm" onClick={() => setPending('delete')} className={styles.footStart}>
          회원 삭제
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPending(profile.role === 'ADMIN' ? 'demote' : 'promote')}>
          {profile.role === 'ADMIN' ? '일반 회원으로' : '관리자로 지정'}
        </Button>
        <Button
          variant={profile.status === 'ACTIVE' ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setPending(profile.status === 'ACTIVE' ? 'disable' : 'enable')}
        >
          {profile.status === 'ACTIVE' ? '비활성화' : '활성화'}
        </Button>
      </>
    )
  }

  return (
    <Dialog open={userId !== null} onClose={working ? () => undefined : onClose} title="회원 상세" size="lg" footer={footer}>
      {loadError && <Notice tone="danger">{loadError}</Notice>}
      {!profile && !loadError && (
        <div className={styles.placeholder} role="status">
          <Spinner size={20} /> 불러오는 중입니다.
        </div>
      )}
      {profile && (
        <div className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <p className={styles.detailName}>{profile.name}</p>
              <p className={styles.email} data-break="anywhere">
                {profile.email}
              </p>
            </div>
            <div className={styles.detailBadges}>
              <Badge tone={statusTone(profile.status)} pill>
                {STATUS_LABELS[profile.status]}
              </Badge>
              <Badge tone={roleTone(profile.role)} pill>
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
          </div>

          {pending && pending !== 'delete' && (
            <Notice tone={pending === 'disable' ? 'warning' : 'info'} title={CONFIRM_TEXT[pending].title}>
              {CONFIRM_TEXT[pending].body}
            </Notice>
          )}
          {pending === 'delete' && (
            <div className={styles.dangerZone}>
              <Notice tone="danger" title="회원을 영구 삭제합니다">
                Cognito 계정과 회원 정보가 지워지며 되돌릴 수 없습니다. 작업 기록은 남습니다. 계속하려면 회원 이메일을 그대로 입력하세요.
              </Notice>
              <TextField
                id="admin-delete-confirm"
                label="회원 이메일 확인"
                type="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={profile.email}
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
            </div>
          )}
          {actionError && (
            <div role="alert">
              <Notice tone="danger">{actionError}</Notice>
            </div>
          )}
          {isSelf && <Notice tone="neutral">내 계정입니다. 내 계정의 상태·권한 변경과 삭제는 다른 관리자가 해야 합니다.</Notice>}

          <KeyValueList
            items={[
              { label: '회원 ID', value: profile.userId, mono: true },
              { label: '회사명', value: profile.company ?? '-' },
              { label: '가입일', value: formatDateTime(profile.createdAt) },
              { label: '최근 로그인', value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '-' },
              { label: '정보 수정일', value: formatDateTime(profile.updatedAt) },
              { label: '이메일 인증', value: profile.emailVerified ? '완료' : '대기' },
              { label: '마케팅 수신', value: profile.marketingAgreed ? '동의' : '미동의' },
              {
                label: 'Cognito 계정',
                value: detail?.account
                  ? `${detail.account.confirmed ? '가입 확정' : '인증 대기'}, ${detail.account.enabled ? '로그인 허용' : '로그인 차단'}`
                  : '찾을 수 없음',
              },
            ]}
          />

          <section aria-labelledby="audit-title">
            <h3 id="audit-title" className={styles.auditTitle}>
              작업 기록
            </h3>
            {detail && detail.audit.length > 0 ? (
              <ol className={styles.audit}>
                {detail.audit.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span className={styles.auditWhen}>{formatDateTime(entry.at)}</span>
                    <span className={styles.auditWhat}>
                      <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong> {entry.detail}
                    </span>
                    <span className={styles.auditWho} data-break="anywhere">
                      {entry.actorEmail === 'system' ? '시스템' : entry.actorEmail}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.auditEmpty}>아직 관리자 작업 기록이 없습니다. 가입일 {formatDate(profile.createdAt)}</p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}
