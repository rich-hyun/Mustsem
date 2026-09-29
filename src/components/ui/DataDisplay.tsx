import { CircleNotchIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './DataDisplay.module.css'

/* ── Key–value list ─────────────────────────────────────────────── */
export interface KeyValueItem {
  label: ReactNode
  value: ReactNode
  mono?: boolean
  /** 값 오른쪽 보조 요소 (복사 버튼 등) */
  action?: ReactNode
}

export function KeyValueList({ items, stacked, className }: { items: KeyValueItem[]; stacked?: boolean; className?: string }) {
  return (
    <dl className={cx(styles.kv, stacked && styles.stacked, className)}>
      {items.map((item, index) => (
        <div key={index} className={styles.kvRow}>
          <dt>{item.label}</dt>
          <dd>
            <span className={cx(styles.kvValue, item.mono && styles.kvMono)}>{item.value}</span>
            {item.action}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Metric ──────────────────────────────────────────────────────── */
interface MetricProps {
  label: ReactNode
  value: ReactNode
  unit?: string
  hint?: ReactNode
  muted?: boolean
  className?: string
}

export function Metric({ label, value, unit, hint, muted, className }: MetricProps) {
  return (
    <div className={cx(styles.metric, muted && styles.metricMuted, className)}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>
        {value}
        {unit && <span className={styles.metricUnit}>{unit}</span>}
      </span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </div>
  )
}

/* ── Badge ───────────────────────────────────────────────────────── */
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'onDark'

const BADGE_TONES: Record<BadgeTone, string | undefined> = {
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
  onDark: styles.badgeOnDark,
}

export function Badge({
  tone = 'neutral',
  pill,
  mono,
  className,
  children,
}: {
  tone?: BadgeTone
  pill?: boolean
  mono?: boolean
  className?: string
  children: ReactNode
}) {
  return <span className={cx(styles.badge, BADGE_TONES[tone], pill && styles.pill, mono && styles.mono, className)}>{children}</span>
}

/* ── Code block ──────────────────────────────────────────────────── */
interface CodeBlockProps {
  title?: string
  code: string
  /** 머리 오른쪽 요소 (복사 버튼 등 — 클라이언트 컴포넌트에서 넘긴다) */
  action?: ReactNode
  wrap?: boolean
  scroll?: boolean
  className?: string
}

export function CodeBlock({ title, code, action, wrap, scroll = true, className }: CodeBlockProps) {
  return (
    <figure className={cx(styles.code, wrap && styles.wrap, className)}>
      {(title || action) && (
        <figcaption className={styles.codeHeader}>
          <span className={styles.codeTitle}>{title}</span>
          {action}
        </figcaption>
      )}
      <pre className={cx(styles.codeBody, scroll && styles.codeScroll)} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  )
}

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return <CircleNotchIcon className={styles.spin} size={size} weight="bold" aria-hidden={label ? undefined : true} aria-label={label} />
}
