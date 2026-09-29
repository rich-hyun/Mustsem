import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { SignupForm } from './SignupForm'

export const metadata: Metadata = {
  title: '회원가입',
  description: 'MUSTSEM Web3 인프라 플랫폼 계정을 만드는 회원가입 페이지입니다.',
  alternates: { canonical: '/signup' },
}

export default function SignupPage() {
  return (
    <>
      <PageHero eyebrow="계정" title="회원가입" lead="Web3 인프라 플랫폼 계정을 만들고 바로 시작하세요." />
      <Section tone="tint" spacing="compact" label="회원가입">
        <SignupForm />
      </Section>
    </>
  )
}
