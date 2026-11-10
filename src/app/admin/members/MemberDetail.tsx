'use client'

/**
 * 회원 상세 대화상자. 중요한 작업(비활성화·권한 변경·삭제)은 한 번 더 확인하고,
 * 삭제는 대상 이메일을 직접 입력해야 실행된다 (서버도 같은 이메일을 다시 확인한다).
 */
import { useEffect, useState } from 'react'
import { memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import { Badge, KeyValueList, Spinner } from '@/components/ui/DataDisplay'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { STATUS_LABELS, normalizeEmail, roleLabel, type AdminMember } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { ACTION_TEXT, DELETE_LABEL, actionBody, allowedActions, restrictionNote, type MemberAction } from './actions'
import styles from './admin.module.css'
import { roleTone, statusTone } from './tones'

interface AuditEntry {
  at: string
  action: string
  actorEmail: string
  detail: string
}

interface Detail {
  profile: AdminMember
  account: { confirmed: boolean; enabled: boolean } | null
  audit: AuditEntry[]
}

const ACTION_LABELS: Record<string, string> = {
  'member.disable': '비활성화',
  'member.enable': '활성화',
  'member.role': '권한 변경',
  'member.delete': '삭제',
  'member.migrate': '기존 회원 이전',
}

interface MemberDetailProps {
  userId: string | null
  /** 목록 메뉴의 "회원 삭제"로 열었을 때: 불러온 뒤 바로 삭제 확인 단계를 보인다 */
  startWithDelete?: boolean
  meId: string
  onClose: () => void
  onChanged: (message: string) => void
  /** 서버가 권한 없음(403)으로 답했다: 내 권한이 회수된 것이므로 세션을 다시 확인한다 */
  onForbidden: () => void
}

export function MemberDetail({ userId, startWithDelete = false, meId, onClose, onChanged, onForbidden }: MemberDetailProps) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<MemberAction | null>(null)
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
        if (cancelled) return
        setDetail(loaded)
        // 서버가 막을 작업이면 확인 단계를 열지 않는다 (최고 관리자·내 계정)
        if (startWithDelete && allowedActions(loaded.profile, meId).includes('delete')) setPending('delete')
      })
      .catch((error: unknown) => {
        logDevError('admin:detail', error)
        if (cancelled) return
        setLoadError(memberErrorMessage(error, 'admin'))
        if (isApiError(error, 'forbidden')) onForbidden()
      })
    return () => {
      cancelled = true
    }
    // 열 때의 대상만 본다 (meId·콜백은 같은 화면에서 바뀌지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, startWithDelete])

  const profile = detail?.profile
  const actions = profile ? allowedActions(profile, meId) : []
  const note = profile ? restrictionNote(profile, meId) : null

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
      await memberApi<{ profile: AdminMember }>(path, { method: 'PATCH', body: actionBody(pending) })
      const refreshed = await memberApi<Detail>(path)
      setDetail(refreshed)
      setPending(null)
      onChanged(`${profile.name} 회원: ${ACTION_TEXT[pending].done}`)
    } catch (error) {
      logDevError('admin:action', error)
      setActionError(memberErrorMessage(error, 'admin'))
      if (isApiError(error, 'forbidden')) onForbidden()
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
          {pending === 'delete' ? '영구 삭제' : ACTION_TEXT[pending].button}
        </Button>
      </>
    )
  } else if (profile && actions.length > 0) {
    footer = (
      <>
        {actions.includes('delete') && (
          <Button variant="danger" size="sm" onClick={() => setPending('delete')} className={styles.footStart}>
            {DELETE_LABEL}
          </Button>
        )}
        {actions
          .filter((action) => action !== 'delete')
          .map((action) => (
            <Button key={action} variant={action === 'enable' ? 'primary' : 'secondary'} size="sm" onClick={() => setPending(action)}>
              {ACTION_TEXT[action].label}
            </Button>
          ))}
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
              <Badge tone={roleTone(profile)} pill>
                {roleLabel(profile)}
              </Badge>
            </div>
          </div>

          {pending && pending !== 'delete' && (
            <Notice tone={pending === 'disable' ? 'warning' : 'info'} title={ACTION_TEXT[pending].title}>
              {ACTION_TEXT[pending].body}
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
          {note && <Notice tone="neutral">{note}</Notice>}

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
