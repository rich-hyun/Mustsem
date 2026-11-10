'use client'

/**
 * 목록의 관리 메뉴에서 고른 작업(권한 부여·회수, 활성화·비활성화)을 한 번 더 확인하고 실행한다.
 * 실패하면 창을 닫지 않고 이유를 보여 준다. 삭제는 이메일 입력이 필요해 상세 대화상자가 맡는다.
 */
import { useEffect, useState } from 'react'
import { memberErrorMessage } from '@/components/auth/authErrors'
import { isApiError, memberApi } from '@/components/auth/memberApi'
import { Badge } from '@/components/ui/DataDisplay'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Notice } from '@/components/ui/Notice'
import { roleLabel, type AdminMember } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { ACTION_TEXT, actionBody, type ConfirmableAction } from './actions'
import styles from './admin.module.css'
import { roleTone } from './tones'

export interface PendingAction {
  member: AdminMember
  action: ConfirmableAction
}

interface ActionConfirmProps {
  pending: PendingAction | null
  onClose: () => void
  /** 반영된 뒤: 목록을 다시 읽고 안내를 띄운다 */
  onDone: (message: string) => void
  /** 서버가 권한 없음(403)으로 답했다: 내 권한이 회수된 것이므로 세션을 다시 확인한다 */
  onForbidden: () => void
}

export function ActionConfirm({ pending, onClose, onDone, onForbidden }: ActionConfirmProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 닫히는 동안에도 내용이 비지 않게 마지막 대상을 들고 있는다
  const [shown, setShown] = useState<PendingAction | null>(null)

  useEffect(() => {
    if (!pending) return
    setShown(pending)
    setError(null)
    setWorking(false)
  }, [pending])

  const run = async () => {
    if (!pending || working) return
    const { member, action } = pending
    setWorking(true)
    setError(null)
    try {
      await memberApi(`/api/admin/users/${encodeURIComponent(member.userId)}`, { method: 'PATCH', body: actionBody(action) })
      onDone(`${member.name} 회원: ${ACTION_TEXT[action].done}`)
      onClose()
    } catch (caught) {
      logDevError('admin:action', caught)
      setError(memberErrorMessage(caught, 'admin'))
      if (isApiError(caught, 'forbidden')) onForbidden()
    } finally {
      setWorking(false)
    }
  }

  const text = shown ? ACTION_TEXT[shown.action] : null
  return (
    <Dialog
      open={pending !== null}
      onClose={working ? () => undefined : onClose}
      title={text?.title ?? '확인'}
      footer={
        text && (
          <>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={working}>
              취소
            </Button>
            <Button variant={shown?.action === 'disable' ? 'danger' : 'primary'} size="sm" loading={working} onClick={() => void run()}>
              {text.button}
            </Button>
          </>
        )
      }
    >
      {shown && text && (
        <div className={styles.confirm}>
          <div className={styles.confirmWho}>
            <div className={styles.who}>
              <span className={styles.confirmName}>{shown.member.name}</span>
              <span className={styles.email} data-break="anywhere">
                {shown.member.email}
              </span>
            </div>
            <Badge tone={roleTone(shown.member)} pill>
              현재 {roleLabel(shown.member)}
            </Badge>
          </div>
          <p className={styles.confirmText}>{text.body}</p>
          {error && (
            <div role="alert">
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
