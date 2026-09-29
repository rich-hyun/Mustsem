import type { ReactNode } from 'react'
import { PointerGlow } from '@/components/motion/PointerGlow'
import { cx } from '@/lib/cx'
import styles from './PageHero.module.css'

export type HeroVisual = 'infra' | 'token' | 'secure' | 'api' | 'plain'

interface PageHeroProps {
  eyebrow: string
  title: ReactNode
  lead?: ReactNode
  visual?: HeroVisual
  titleId?: string
  /** 배지·버튼 등 머리 아래 보조 요소 */
  children?: ReactNode
}

/**
 * 격자선을 따라 흐르는 신호. 글과 겹치지 않도록 본문 오른쪽의 빈 띠(화면 폭 40~85%)에서만 보인다.
 * 가로선은 행 번호(40px 단위), 세로선은 화면 폭 비율을 40px 격자에 맞춰 내린 위치에 둔다.
 */
const STREAKS: { axis: 'x' | 'y'; at: number; delay: number; duration: number }[] = [
  { axis: 'x', at: 3, delay: 0.4, duration: 7.2 },
  { axis: 'x', at: 7, delay: 3.1, duration: 8.4 },
  { axis: 'x', at: 10, delay: 5.6, duration: 6.6 },
  { axis: 'y', at: 56, delay: 1.8, duration: 6.2 },
  { axis: 'y', at: 71, delay: 4.4, duration: 7.4 },
]

export function PageHero({ eyebrow, title, lead, visual = 'plain', titleId = 'page-title', children }: PageHeroProps) {
  return (
    <section className={cx(styles.hero, styles[visual])} aria-labelledby={titleId} data-surface="dark">
      <PointerGlow className={styles.glow} />
      <div className={styles.streaks} aria-hidden data-live="">
        {STREAKS.map((streak) => (
          <span
            key={`${streak.axis}${streak.at}`}
            className={streak.axis === 'x' ? styles.streakX : styles.streakY}
            style={{
              ...(streak.axis === 'x' ? { top: `${streak.at * 40}px` } : { left: `round(down, ${streak.at}vw, 40px)` }),
              animationDelay: `${streak.delay}s`,
              animationDuration: `${streak.duration}s`,
            }}
          />
        ))}
      </div>
      <div className={cx('container', styles.inner)}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id={titleId} className={styles.title}>
          {title}
        </h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children && <div className={styles.extra}>{children}</div>}
      </div>
    </section>
  )
}
