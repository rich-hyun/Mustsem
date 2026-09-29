/**
 * 서브페이지 히어로 아래 보조 요소 — 특징 배지 줄과 빠른 링크 줄.
 * PageHero의 children으로 넣는다 (어두운 면 전용).
 */
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/DataDisplay'
import styles from './HeroMeta.module.css'

export interface HeroBadgeItem {
  key: string
  icon?: ReactNode
  label: ReactNode
}

export function HeroBadges({ items, label = '주요 특징' }: { items: HeroBadgeItem[]; label?: string }) {
  return (
    <ul className={styles.badges} aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <Badge tone="onDark">
            {item.icon}
            {item.label}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/** 배지 줄 아래 구분선과 함께 놓는 링크 버튼 줄 */
export function HeroLinks({ children, label = '바로가기' }: { children: ReactNode; label?: string }) {
  return (
    <nav className={styles.links} aria-label={label}>
      {children}
    </nav>
  )
}
