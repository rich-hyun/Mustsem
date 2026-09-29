import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cx } from '@/lib/cx'
import styles from './Auth.module.css'

interface AuthCardProps {
  title: string
  description?: string
  /** 회원가입처럼 입력이 많은 카드 (520px) */
  wide?: boolean
  footer?: ReactNode
  children: ReactNode
}

/** 계정 화면의 가운데 카드 — 사용자가 입력하는 면이라 L2(그림자)로 올린다 */
export function AuthCard({ title, description, wide, footer, children }: AuthCardProps) {
  return (
    <div className={styles.wrap}>
      <Card elevation="raised" padding="lg" className={cx(styles.card, wide && styles.wide)}>
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.desc}>{description}</p>}
        </div>
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </Card>
    </div>
  )
}
