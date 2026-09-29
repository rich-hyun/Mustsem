import Link from 'next/link'
import { cx } from '@/lib/cx'

interface LogoMarkProps {
  /** 한 페이지에 로고가 여러 개일 때 그라데이션 id가 겹치지 않도록 구분한다 */
  gradientId: string
  size?: number
  className?: string
}

/** 육각 블록 + M — 틸→시안 그라데이션 로고 (브랜드 고정 요소) */
export function LogoMark({ gradientId, size = 28, className }: LogoMarkProps) {
  const stroke = `url(#${gradientId})`
  return (
    <svg className={className} viewBox="0 0 512 512" width={size} height={size} fill="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="70" y1="40" x2="442" y2="472" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00D09C" />
          <stop offset="100%" stopColor="#00B4D8" />
        </linearGradient>
      </defs>
      <path d="M256 40L442 148V364L256 472L70 364V148L256 40Z" stroke={stroke} strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M166 340V170L256 260L346 170V340" stroke={stroke} strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface LogoProps {
  gradientId: string
  className?: string
  onClick?: () => void
}

export function Logo({ gradientId, className, onClick }: LogoProps) {
  return (
    <Link href="/" className={cx('brand-logo', className)} aria-label="MUSTSEM 홈" onClick={onClick}>
      <LogoMark gradientId={gradientId} />
      <span aria-hidden>MUSTSEM</span>
    </Link>
  )
}
