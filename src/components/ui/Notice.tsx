import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Notice.module.css'

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const ICONS = {
  info: InfoIcon,
  success: CheckCircleIcon,
  warning: WarningIcon,
  danger: WarningCircleIcon,
  neutral: InfoIcon,
} as const

interface NoticeProps {
  tone?: NoticeTone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  /** 상태 변화를 보조기기에 알릴 때 */
  live?: boolean
  className?: string
}

export function Notice({ tone = 'info', title, children, actions, live, className }: NoticeProps) {
  const Icon = ICONS[tone]
  return (
    <div className={cx(styles.notice, styles[tone], className)} role={live ? 'status' : undefined}>
      <Icon className={styles.icon} size={18} weight="fill" aria-hidden />
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        {children && <div>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  )
}
