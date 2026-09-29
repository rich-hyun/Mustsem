'use client'

import { CaretDownIcon, ListIcon } from '@phosphor-icons/react/ssr'
import { useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { DEVELOPER_LINKS, PRODUCT_GROUPS, isActivePath, type NavLink } from '@/config/navigation'
import { cx } from '@/lib/cx'
import { AccountMenu } from './AccountMenu'
import { LogoMark } from './Logo'
import { MobileNav } from './MobileNav'
import { NavIcon } from './NavIcon'
import { WalletMenu } from './WalletMenu'
import styles from './Header.module.css'

export type MenuId = 'products' | 'developers' | 'wallet' | 'account'

const HIDE_AFTER = 120
const HYSTERESIS = 10

// 대시보드는 원본처럼 오른쪽 버튼 묶음 맨 앞에 따로 둔다 (모바일 메뉴·푸터에는 개발자 묶음에 남는다)
const DASHBOARD_HREF = '/dashboard'
const DEVELOPER_MENU = DEVELOPER_LINKS.filter((link) => link.href !== DASHBOARD_HREF)

export function Header() {
  const pathname = usePathname()
  const headerRef = useRef<HTMLElement>(null)
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const openRef = useRef<MenuId | null>(null)
  const lockRef = useRef(false)
  const hover = useRef<{ timer?: number; pinned: boolean }>({ pinned: false })

  // 이벤트 핸들러·스크롤 처리에서 최신 상태를 읽기 위한 거울
  useEffect(() => {
    openRef.current = openMenu
    lockRef.current = openMenu !== null || mobileOpen
  }, [openMenu, mobileOpen])

  // 경로가 바뀌면 열린 메뉴를 모두 닫는다
  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
    setHidden(false)
  }, [pathname])

  // 바깥 클릭·Esc로 닫기 (Esc는 트리거로 포커스를 돌려준다)
  useEffect(() => {
    if (!openMenu) return
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const trigger = headerRef.current?.querySelector<HTMLElement>(`[data-menu-trigger="${openMenu}"]`)
      setOpenMenu(null)
      trigger?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu])

  // 메가 메뉴는 메뉴 묶음 가운데 아래에 펼친다. 좁은 데스크톱에서 지갑·계정 버튼이 넓어지면
  // 메뉴가 왼쪽으로 밀려 패널이 화면 밖으로 나갈 수 있어, 그리기 전에 안쪽으로 당긴다
  useLayoutEffect(() => {
    if (openMenu !== 'products') return
    const panel = document.getElementById('menu-products')
    if (!panel) return
    const fit = () => {
      panel.style.removeProperty('--mega-shift')
      const rect = panel.getBoundingClientRect()
      const edge = 16
      const shift = Math.max(edge - rect.left, 0) - Math.max(rect.right - (window.innerWidth - edge), 0)
      if (shift) panel.style.setProperty('--mega-shift', `${Math.round(shift)}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [openMenu])

  // 스크롤: 배경 전환 + 아래로 내릴 때 숨김(방향 히스테리시스로 떨림 방지).
  // 스크롤 위치는 Motion의 모션 값으로 받아 프레임 단위로 묶어 처리한다
  const { scrollY } = useScroll()
  const scrollState = useRef({ lastY: 0, direction: 0, origin: 0, reduced: false })

  const onScrollY = useCallback((value: number) => {
    const state = scrollState.current
    const y = Math.max(value, 0)
    setScrolled(y > 8)
    const locked = state.reduced || lockRef.current || Boolean(headerRef.current?.matches(':focus-within'))
    if (locked || y < HIDE_AFTER) {
      setHidden(false)
      state.lastY = y
      state.direction = 0
      state.origin = y
      return
    }
    const next = y > state.lastY ? 1 : y < state.lastY ? -1 : state.direction
    if (next !== state.direction) {
      state.direction = next
      state.origin = state.lastY
    }
    if (Math.abs(y - state.origin) >= HYSTERESIS) setHidden(state.direction > 0)
    state.lastY = y
  }, [])

  useMotionValueEvent(scrollY, 'change', onScrollY)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      scrollState.current.reduced = reduced.matches
    }
    sync()
    onScrollY(window.scrollY)
    reduced.addEventListener('change', sync)
    return () => reduced.removeEventListener('change', sync)
  }, [onScrollY])

  const toggle = useCallback((id: MenuId) => {
    const current = openRef.current
    // 마우스로 열린 제품·개발자 메뉴를 클릭하면 닫지 않고 고정한다
    if (current === id && !hover.current.pinned && (id === 'products' || id === 'developers')) {
      hover.current.pinned = true
      return
    }
    hover.current.pinned = current !== id
    setOpenMenu(current === id ? null : id)
  }, [])

  const close = useCallback(() => setOpenMenu(null), [])

  // 마우스(정밀 포인터)에서는 제품·개발자 메뉴를 hover로도 연다
  const hoverProps = (id: MenuId) => ({
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType !== 'mouse') return
      window.clearTimeout(hover.current.timer)
      hover.current.timer = window.setTimeout(() => {
        if (openRef.current !== id) hover.current.pinned = false
        setOpenMenu(id)
      }, 60)
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      if (event.pointerType !== 'mouse') return
      window.clearTimeout(hover.current.timer)
      hover.current.timer = window.setTimeout(() => {
        if (openRef.current === id && !hover.current.pinned) setOpenMenu(null)
      }, 180)
    },
  })

  const solid = scrolled || openMenu !== null
  const productsActive = PRODUCT_GROUPS.some((group) => group.links.some((link) => isActivePath(pathname, link.href)))
  const developersActive = DEVELOPER_MENU.some((link) => isActivePath(pathname, link.href))
  const securityActive = isActivePath(pathname, '/security')
  const dashboardActive = isActivePath(pathname, DASHBOARD_HREF)

  return (
    <>
      <header
        ref={headerRef}
        className={styles.header}
        data-solid={solid}
        data-hidden={hidden}
        data-surface={solid ? undefined : 'dark'}
      >
        <div className={cx('container', styles.bar)}>
          <Link href="/" className={styles.logo} aria-label="MUSTSEM 홈">
            <LogoMark gradientId="headerLogoGrad" />
            <span aria-hidden>MUSTSEM</span>
          </Link>

          <nav className={styles.nav} aria-label="주요 메뉴">
            <ul role="list" className={styles.navList}>
              <li className={cx(styles.navItem, styles.navItemWide)} {...hoverProps('products')}>
                <MenuTrigger id="products" label="제품" open={openMenu === 'products'} active={productsActive} onToggle={toggle} />
                {openMenu === 'products' && (
                  <div id="menu-products" className={cx(styles.panel, styles.mega)}>
                    {PRODUCT_GROUPS.map((group) => (
                      <div key={group.title}>
                        <p className={styles.groupTitle}>{group.title}</p>
                        <MenuLinks links={group.links} pathname={pathname} onNavigate={close} />
                      </div>
                    ))}
                  </div>
                )}
              </li>
              <li className={styles.navItem} {...hoverProps('developers')}>
                <MenuTrigger id="developers" label="개발자" open={openMenu === 'developers'} active={developersActive} onToggle={toggle} />
                {openMenu === 'developers' && (
                  <div id="menu-developers" className={cx(styles.panel, styles.list)}>
                    <MenuLinks links={DEVELOPER_MENU} pathname={pathname} onNavigate={close} />
                  </div>
                )}
              </li>
              <li className={styles.navItem}>
                <Link
                  href="/security"
                  className={cx(styles.navLink, securityActive && styles.navActive)}
                  aria-current={securityActive ? 'page' : undefined}
                >
                  보안
                </Link>
              </li>
            </ul>
          </nav>

          <div className={styles.actions}>
            <Link
              href={DASHBOARD_HREF}
              className={cx(styles.textLink, styles.dashboardLink, dashboardActive && styles.textLinkActive)}
              aria-current={dashboardActive ? 'page' : undefined}
            >
              대시보드
            </Link>
            <span className={styles.divider} aria-hidden />
            <WalletMenu open={openMenu === 'wallet'} onToggle={() => toggle('wallet')} onClose={close} />
            <AccountMenu className={styles.authDesktop} open={openMenu === 'account'} onToggle={() => toggle('account')} onClose={close} />
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => {
                setOpenMenu(null)
                setMobileOpen(true)
              }}
              aria-label="전체 메뉴 열기"
              aria-haspopup="dialog"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              <ListIcon size={24} aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

function MenuTrigger({
  id,
  label,
  open,
  active,
  onToggle,
}: {
  id: MenuId
  label: ReactNode
  open: boolean
  active: boolean
  onToggle: (id: MenuId) => void
}) {
  return (
    <button
      type="button"
      className={cx(styles.navTrigger, active && styles.navActive)}
      aria-expanded={open}
      aria-controls={`menu-${id}`}
      data-menu-trigger={id}
      onClick={() => onToggle(id)}
    >
      {label}
      <CaretDownIcon className={styles.caret} size={14} weight="bold" aria-hidden />
    </button>
  )
}

function MenuLinks({ links, pathname, onNavigate }: { links: NavLink[]; pathname: string; onNavigate: () => void }) {
  return (
    <ul role="list" style={{ margin: 0, padding: 0 }}>
      {links.map((link) => {
        const current = isActivePath(pathname, link.href)
        return (
          <li key={link.href}>
            <Link href={link.href} className={styles.menuLink} aria-current={current ? 'page' : undefined} onClick={onNavigate}>
              <span className={styles.menuIcon}>
                <NavIcon icon={link.icon} size={18} />
              </span>
              <span className={styles.menuText}>
                <span className={styles.menuLabel}>{link.label}</span>
                <span className={styles.menuDesc}>{link.description}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
