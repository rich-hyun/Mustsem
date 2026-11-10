'use client'

import { CaretDownIcon, UserCircleIcon, UserIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { cx } from '@/lib/cx'
import styles from './Header.module.css'

interface AccountMenuProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
  className?: string
}

export function AccountMenu({ open, onToggle, onClose, className }: AccountMenuProps) {
  const { status, user, signOut } = useAuth()

  if (status !== 'signed-in' || !user) {
    return (
      <div className={cx(styles.authLinks, className)}>
        <Link href="/login" className={styles.textLink}>
          로그인
        </Link>
        <Link href="/signup" className={styles.solidButton}>
          회원가입
        </Link>
      </div>
    )
  }

  const display = user.name || user.email.split('@')[0] || '내 계정'
  return (
    <div className={cx(styles.navItem, className)}>
      <button
        type="button"
        className={styles.chip}
        data-menu-trigger="account"
        aria-expanded={open}
        aria-controls="menu-account"
        onClick={onToggle}
      >
        <UserCircleIcon size={18} aria-hidden />
        <span className={styles.chipLabel}>{display}</span>
        <CaretDownIcon className={styles.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open && (
        <div id="menu-account" className={cx(styles.panel, styles.panelEnd, styles.popover)}>
          <div className={styles.popSection}>
            <p className={styles.popLabel}>로그인 계정</p>
            <p className={styles.popText} data-break="anywhere">
              {user.email}
            </p>
          </div>
          <nav className={styles.popSection} aria-label="계정 메뉴">
            <ul role="list" className={styles.popLinks}>
              <li>
                <Link href="/account" className={styles.popLink} onClick={onClose}>
                  <UserIcon size={16} aria-hidden /> 내 정보
                </Link>
              </li>
              {user.role === 'ADMIN' && (
                <li>
                  <Link href="/admin/members" className={styles.popLink} onClick={onClose}>
                    <UsersThreeIcon size={16} aria-hidden /> 회원 관리
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <div className={cx(styles.popSection, styles.popFooter)}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose()
                void signOut()
              }}
            >
              로그아웃
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
