'use client'

import { XIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { DEVELOPER_LINKS, PRODUCT_GROUPS, isActivePath, type NavLink } from '@/config/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { LogoMark } from './Logo'
import { NavIcon } from './NavIcon'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

/** 좁은 화면의 전체 메뉴 — 네이티브 모달 <dialog>라 포커스 가두기와 Esc 닫기가 기본 동작한다 */
export function MobileNav({ open, onClose }: MobileNavProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const { status, user, signOut } = useAuth()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // 넓은 화면으로 바뀌면 닫는다
  useEffect(() => {
    if (!open) return
    const wide = window.matchMedia('(min-width: 1080px)')
    const onChange = () => wide.matches && onClose()
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [open, onClose])

  const renderLinks = (links: Array<Pick<NavLink, 'href' | 'label'> & Partial<Pick<NavLink, 'icon'>>>) => (
    <ul role="list" className={styles.links}>
      {links.map((link) => {
        const current = isActivePath(pathname, link.href)
        return (
          <li key={link.href}>
            <Link href={link.href} className={styles.link} aria-current={current ? 'page' : undefined} onClick={onClose}>
              {link.icon && (
                <span className={styles.icon}>
                  <NavIcon icon={link.icon} size={18} />
                </span>
              )}
              {link.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <dialog
      ref={ref}
      id="mobile-nav"
      className={styles.sheet}
      aria-label="전체 메뉴"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.head}>
        <Link href="/" className={styles.logo} aria-label="MUSTSEM 홈" onClick={onClose}>
          <LogoMark gradientId="mobileLogoGrad" />
          <span aria-hidden>MUSTSEM</span>
        </Link>
        <button type="button" className={styles.close} onClick={onClose} aria-label="메뉴 닫기">
          <XIcon size={22} aria-hidden />
        </button>
      </div>

      <nav className={styles.body} aria-label="전체 메뉴">
        {PRODUCT_GROUPS.map((group) => (
          <section key={group.title} className={styles.group}>
            <h2 className={styles.groupTitle}>{group.title}</h2>
            {renderLinks(group.links)}
          </section>
        ))}
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>개발자</h2>
          {renderLinks(DEVELOPER_LINKS)}
        </section>
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>회사</h2>
          {renderLinks([{ href: '/security', label: '보안' }])}
        </section>
      </nav>

      <div className={styles.foot}>
        {status === 'signed-in' && user ? (
          <>
            <p className={styles.account}>{user.email}</p>
            <Button
              variant="secondary"
              block
              onClick={() => {
                onClose()
                void signOut()
              }}
            >
              로그아웃
            </Button>
          </>
        ) : (
          <div className={styles.footRow}>
            <Button href="/login" variant="secondary" onClick={onClose}>
              로그인
            </Button>
            <Button href="/signup" variant="primary" onClick={onClose}>
              회원가입
            </Button>
          </div>
        )}
      </div>
    </dialog>
  )
}
