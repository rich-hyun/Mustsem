/**
 * 소개 페이지용 공통 블록. 서버 컴포넌트로 렌더되며 자바스크립트를 싣지 않는다.
 * 아이콘은 호출하는 쪽에서 Phosphor(/ssr) 컴포넌트를 element로 넘긴다.
 */
import { ArrowRightIcon, CheckIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { AnimatedValue } from '@/components/motion/AnimatedValue'
import { cx } from '@/lib/cx'
import styles from './Blocks.module.css'

export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx(styles.iconTile, className)} aria-hidden>
      {children}
    </span>
  )
}

export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx(styles.textLink, className)}>
      {children}
      <ArrowRightIcon size={15} weight="bold" aria-hidden />
    </Link>
  )
}

/* ── Feature grid ────────────────────────────────────────────────── */
export interface FeatureItem {
  icon?: ReactNode
  title: string
  text: ReactNode
  link?: { href: string; label: string }
}

const COLS = { 2: styles.cols2, 3: styles.cols3, 4: styles.cols4 } as const

export function FeatureGrid({ items, columns = 3, className }: { items: FeatureItem[]; columns?: 2 | 3 | 4; className?: string }) {
  return (
    <ul className={cx(styles.featureGrid, COLS[columns], className)} data-reveal-group="">
      {items.map((item) => (
        <li key={item.title} className={styles.feature}>
          {item.icon && <IconTile>{item.icon}</IconTile>}
          <div className={styles.featureBody}>
            <h3 className={styles.featureTitle}>{item.title}</h3>
            <p className={styles.featureText}>{item.text}</p>
          </div>
          {item.link && <TextLink href={item.link.href}>{item.link.label}</TextLink>}
        </li>
      ))}
    </ul>
  )
}

/* ── Stat row ────────────────────────────────────────────────────── */
export interface StatItem {
  value: string
  label: string
  /** 스크린리더용 풀이 (예: '초당 1만 건 처리') */
  description?: string
}

/** 값은 들어올 때 세어 올리거나(10K) 글자를 풀어 낸다(EVM). 보조기술에는 풀이만 읽힌다 */
export function StatRow({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <dl className={cx(styles.stats, className)} data-reveal-group="">
      {items.map((item) => (
        <div key={item.label} className={styles.stat}>
          <dt className={styles.statLabel}>{item.label}</dt>
          <dd className={styles.statValue} style={{ margin: 0 }}>
            <AnimatedValue value={item.value} />
            <span className="sr-only">{item.description ?? item.value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ── Numbered steps ──────────────────────────────────────────────── */
export interface StepItem {
  title: string
  text: ReactNode
  link?: { href: string; label: string }
}

export function NumberedSteps({ items, columns = 3 }: { items: StepItem[]; columns?: number }) {
  return (
    <ol className={styles.steps} style={{ '--step-cols': columns } as CSSProperties} data-reveal-group="">
      {items.map((item) => (
        <li key={item.title} className={styles.step}>
          <h3 className={styles.stepTitle}>{item.title}</h3>
          <p className={styles.stepText}>{item.text}</p>
          {item.link && <TextLink href={item.link.href}>{item.link.label}</TextLink>}
        </li>
      ))}
    </ol>
  )
}

/* ── CTA panel (L3) ──────────────────────────────────────────────── */
interface CtaPanelProps {
  label?: string
  title: ReactNode
  text?: ReactNode
  actions: ReactNode
  checklist?: { title: string; items: string[] }
  titleId?: string
}

export function CtaPanel({ label, title, text, actions, checklist, titleId }: CtaPanelProps) {
  return (
    <div className={styles.cta} data-surface="dark" data-reveal="">
      <span className={styles.aurora} aria-hidden data-live="" />
      <div className={styles.ctaBody}>
        {label && <p className={styles.ctaLabel}>{label}</p>}
        <h2 id={titleId} className={styles.ctaTitle}>
          {title}
        </h2>
        {text && <p className={styles.ctaText}>{text}</p>}
        <div className={styles.ctaActions}>{actions}</div>
      </div>
      {checklist && (
        <div className={styles.checklist} data-spotlight="">
          <p className={styles.checklistTitle}>{checklist.title}</p>
          <ul role="list">
            {checklist.items.map((item) => (
              <li key={item}>
                <CheckIcon size={18} weight="bold" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Banner row ──────────────────────────────────────────────────── */
/** 한 줄 CTA. 기본은 네이비(L3), light는 흰 카드 + 틸 빛 (API 카탈로그처럼 옅은 면 위에 둘 때) */
export function BannerRow({
  title,
  text,
  action,
  tone = 'dark',
}: {
  title: string
  text?: string
  action: ReactNode
  tone?: 'dark' | 'light'
}) {
  const dark = tone === 'dark'
  return (
    <div className={cx(styles.banner, !dark && styles.bannerLight)} data-surface={dark ? 'dark' : undefined} data-reveal="">
      {dark && <span className={styles.aurora} aria-hidden data-live="" />}
      <div className={styles.bannerBody}>
        <h2 className={styles.bannerTitle}>{title}</h2>
        {text && <p className={styles.bannerText}>{text}</p>}
      </div>
      <div className={styles.bannerAction}>{action}</div>
    </div>
  )
}
