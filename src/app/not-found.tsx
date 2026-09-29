import { ArrowRightIcon, ShieldIcon } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavIcon } from '@/components/layout/NavIcon'
import { Button } from '@/components/ui/Button'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { DEVELOPER_LINKS, PRODUCT_GROUPS } from '@/config/navigation'
import styles from './not-found.module.css'

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: true },
}

const POPULAR = new Set(['/network', '/nft', '/rwa', '/developers', '/developers/guide'])

const QUICK_LINKS: { href: string; label: string; description: string; icon: ReactNode }[] = [
  ...[...PRODUCT_GROUPS.flatMap((group) => group.links), ...DEVELOPER_LINKS]
    .filter((link) => POPULAR.has(link.href))
    .map((link) => ({ ...link, icon: <NavIcon icon={link.icon} size={20} /> })),
  { href: '/security', label: '보안', description: 'Vault · AES · HSM 보안 아키텍처', icon: <ShieldIcon size={20} aria-hidden /> },
]

export default function NotFound() {
  return (
    <>
      <PageHero
        eyebrow="오류"
        title="페이지를 찾을 수 없습니다"
        lead="주소가 잘못 입력되었거나, 페이지가 이동 또는 삭제되었을 수 있습니다."
      >
        <div className={styles.actions}>
          <Button href="/" variant="accent">
            홈으로 이동
            <ArrowRightIcon size={16} weight="bold" aria-hidden />
          </Button>
          <Button href="/network#apply" variant="onDark">
            도입 상담
          </Button>
        </div>
      </PageHero>
      <Section tone="white" spacing="compact" labelledBy="popular-title">
        <h2 id="popular-title" className={styles.title}>
          자주 찾는 페이지
        </h2>
        <ul className={styles.links} data-reveal-group="">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={styles.link} data-spotlight="">
                <span className={styles.icon}>{link.icon}</span>
                <span className={styles.text}>
                  <span className={styles.label}>{link.label}</span>
                  <span className={styles.desc}>{link.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
