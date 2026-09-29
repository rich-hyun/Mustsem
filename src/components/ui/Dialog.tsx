'use client'

import { XIcon } from '@phosphor-icons/react/ssr'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

/**
 * 네이티브 <dialog> 모달. 포커스 가두기·Esc 닫기·배경 비활성은 브라우저가 처리하고,
 * 닫힐 때 포커스는 열었던 요소로 돌아간다.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, size === 'lg' && styles.lg)}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // 바깥(배경) 클릭 시 닫기 — 대화상자 자체를 누른 경우만 해당
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
          <XIcon size={20} aria-hidden />
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
