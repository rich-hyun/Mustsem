import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Section.module.css'

export type SectionTone = 'white' | 'tint' | 'navy'

interface SectionProps {
  id?: string
  tone?: SectionTone
  spacing?: 'default' | 'compact'
  labelledBy?: string
  label?: string
  className?: string
  children: ReactNode
}

/** 페이지 본문의 한 구획. 배경 톤으로 흰 면 · 옅은 면 · 네이비(L3)를 번갈아 쓴다. */
export function Section({ id, tone = 'white', spacing = 'default', labelledBy, label, className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cx(styles.section, styles[tone], spacing === 'compact' && styles.compact, className)}
      aria-labelledby={labelledBy}
      aria-label={label}
      data-surface={tone === 'navy' ? 'dark' : undefined}
    >
      <div className="container">{children}</div>
    </section>
  )
}

interface SectionHeadingProps {
  id?: string
  kicker?: string
  title: ReactNode
  lead?: ReactNode
  align?: 'start' | 'center'
  /** 제목 오른쪽에 놓을 링크·버튼 */
  aside?: ReactNode
  className?: string
}

export function SectionHeading({ id, kicker, title, lead, align = 'start', aside, className }: SectionHeadingProps) {
  const text = (
    <>
      {kicker && <span className={styles.kicker}>{kicker}</span>}
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </>
  )

  if (aside) {
    return (
      <div className={cx(styles.heading, styles.headingRow, className)} data-reveal="">
        <div className={styles.headingText}>{text}</div>
        {aside}
      </div>
    )
  }

  return (
    <div className={cx(styles.heading, align === 'center' && styles.center, className)} data-reveal="">
      {text}
    </div>
  )
}
