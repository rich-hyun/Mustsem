import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Card.module.css'

export type Elevation = 'flat' | 'surface' | 'raised'

interface CardProps extends HTMLAttributes<HTMLElement> {
  elevation?: Elevation
  padding?: 'md' | 'lg' | 'none'
  /** 모서리를 feature 단계(20px)로 — 페이지의 주인공 면에만 쓴다 */
  feature?: boolean
  as?: 'div' | 'article' | 'section' | 'li' | 'aside' | 'form'
  /** 마우스를 따라 테두리가 밝아지는 L1 면 (정밀 포인터 전용) */
  spotlight?: boolean
  children: ReactNode
}

const PADDING = { md: styles.padMd, lg: styles.padLg, none: styles.padNone }

export function Card({ elevation = 'surface', padding = 'md', feature, as: Tag = 'div', spotlight, className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(styles.card, styles[elevation], PADDING[padding], feature && styles.feature, className)}
      data-spotlight={spotlight ? '' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
