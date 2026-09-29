import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Legal.module.css'

/** 법적 문서의 시행 정보 — 문서 개정 시 여기 값만 바꾼다 */
export const LEGAL_VERSION = {
  effectiveDate: '2026년 7월 6일',
  version: 'v1.0',
  operator: '머스트셈 네트워크',
} as const

export type LegalHeadingLevel = 'h2' | 'h3'

export interface LegalContentProps {
  /** 페이지에서는 h2, 모달(제목이 h2) 안에서는 h3 */
  headingLevel?: LegalHeadingLevel
  /** 모달용 촘촘한 간격 */
  compact?: boolean
}

export function LegalDocument({ compact, children }: { compact?: boolean; children: ReactNode }) {
  return (
    <div className={cx(styles.doc, compact && styles.compact)}>
      {/* 페이지로 볼 때만: 읽은 만큼 화면 위쪽 선이 차오른다 (스크롤 연동 CSS, 미지원 브라우저는 생략) */}
      {!compact && <div className={styles.progress} aria-hidden />}
      {children}
    </div>
  )
}

export function LegalMeta() {
  return (
    <div className={styles.meta}>
      <span>
        <strong>시행일</strong>
        {LEGAL_VERSION.effectiveDate}
      </span>
      <span>
        <strong>버전</strong>
        {LEGAL_VERSION.version}
      </span>
      <span>
        <strong>운영 주체</strong>
        {LEGAL_VERSION.operator}
      </span>
    </div>
  )
}

export function LegalHeading({ level = 'h2', children }: { level?: LegalHeadingLevel; children: ReactNode }) {
  const Tag = level
  return <Tag className={styles.heading}>{children}</Tag>
}

export function LegalTable({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((cellText) => (
              <th key={cellText} scope="col">
                {cellText}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cellContent, cellIndex) => (
                <td key={cellIndex}>{cellContent}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LegalContact({ children }: { children: ReactNode }) {
  return <div className={styles.contact}>{children}</div>
}
