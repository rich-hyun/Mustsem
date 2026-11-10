import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { MembersAdmin } from './MembersAdmin'

export const metadata: Metadata = {
  title: '회원 관리',
  description: 'MUSTSEM 관리자 회원 관리 화면입니다.',
  robots: { index: false, follow: false },
}

export default function MembersAdminPage() {
  return (
    <>
      <PageHero eyebrow="관리자" title="회원 관리" lead="가입 회원을 조회하고 상태와 권한을 관리합니다." />
      <Section tone="tint" spacing="compact" label="회원 관리">
        <MembersAdmin />
      </Section>
    </>
  )
}
