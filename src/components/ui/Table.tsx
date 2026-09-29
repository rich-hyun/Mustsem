import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Table.module.css'

interface TableProps {
  /** 스크린리더용 표 설명 */
  caption: string
  /** 좁은 화면에서 행을 카드처럼 쌓는다 — 각 td에 data-label을 넣어야 한다 */
  stackOnMobile?: boolean
  className?: string
  children: ReactNode
}

export function Table({ caption, stackOnMobile, className, children }: TableProps) {
  return (
    <div className={cx(styles.wrap, className)} data-reveal="">
      <table className={cx(styles.table, stackOnMobile && styles.stack)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

/** 셀 보조 클래스: <td className={cell.numeric}> */
export const cell = {
  numeric: styles.numeric,
  strong: styles.strong,
  nowrap: styles.nowrap,
  mono: styles.mono,
}
