import Link from 'next/link'
import { FOOTER_GROUPS } from '@/config/navigation'
import { SITE } from '@/config/site'
import { CurrentYear } from './CurrentYear'
import { LogoMark } from './Logo'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer} data-surface="dark">
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logo} aria-label="MUSTSEM 홈">
              <LogoMark gradientId="footerLogoGrad" />
              <span aria-hidden>MUSTSEM</span>
            </Link>
            <p>기업을 위한 블록체인 인프라와 토큰화 API를 제공합니다. 보안을 타협하지 않으면서 빠르게 구축하세요.</p>
          </div>
          <nav className={styles.groups} aria-label="사이트 전체 메뉴">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className={styles.groupTitle}>{group.title}</h2>
                <ul role="list" className={styles.links}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className={styles.bottom}>
          <p>
            &copy; <CurrentYear initial={new Date().getFullYear()} /> {SITE.name}. All rights reserved.
          </p>
          <p>{SITE.tagline}</p>
        </div>
      </div>
    </footer>
  )
}
