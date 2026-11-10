import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { ConfirmForm } from './ConfirmForm'

export const metadata: Metadata = {
  title: '이메일 인증',
  description: 'MUSTSEM 계정 이메일 인증을 처리하는 페이지입니다.',
  alternates: { canonical: '/confirm' },
  robots: { index: false, follow: false },
}

export default function ConfirmPage() {
  return (
    <>
      <PageHero eyebrow="계정" title="이메일 인증" lead="메일로 받은 인증 코드를 입력하면 가입이 완료됩니다." />
      <Section tone="tint" spacing="compact" label="이메일 인증">
        <ConfirmForm />
      </Section>
    </>
  )
}
