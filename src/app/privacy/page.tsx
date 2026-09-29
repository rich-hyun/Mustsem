import type { Metadata } from 'next'
import { PrivacyContent } from '@/components/legal/PrivacyContent'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '머스트셈 네트워크의 개인정보처리방침입니다. 수집 항목, 이용 목적, 보유 기간 및 이용자의 권리를 안내합니다.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="법적 고지"
        title="개인정보처리방침"
        lead={
          <>
            머스트셈 네트워크는 이용자의 개인정보를 소중히 다루며,{' '}
            <br />
            관련 법령에 따라 안전하게 보호합니다.
          </>
        }
      />
      <Section tone="white" label="개인정보처리방침 본문">
        <PrivacyContent />
      </Section>
    </>
  )
}
