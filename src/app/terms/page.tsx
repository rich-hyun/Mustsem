import type { Metadata } from 'next'
import { TermsContent } from '@/components/legal/TermsContent'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'

export const metadata: Metadata = {
  title: '서비스 이용약관',
  description: '머스트셈 네트워크 서비스 이용약관입니다. 서비스 이용 조건, 이용자의 권리와 의무를 안내합니다.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="법적 고지"
        title="서비스 이용약관"
        lead={
          <>
            머스트셈 네트워크 서비스 이용에 관한{' '}
            <br />
            조건과 절차, 권리와 의무를 규정합니다.
          </>
        }
      />
      <Section tone="white" label="서비스 이용약관 본문">
        <TermsContent />
      </Section>
    </>
  )
}
