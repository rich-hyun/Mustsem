import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { AccountView } from './AccountView'

export const metadata: Metadata = {
  title: '내 정보',
  description: 'MUSTSEM 계정 정보를 확인하고 수정합니다.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <>
      <PageHero eyebrow="계정" title="내 정보" lead="계정 정보를 확인하고 이름과 비밀번호를 바꿀 수 있습니다." />
      <Section tone="tint" spacing="compact" label="내 정보">
        <AccountView />
      </Section>
    </>
  )
}
