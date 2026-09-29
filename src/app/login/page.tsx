import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: '로그인',
  description: 'MUSTSEM Web3 인프라 플랫폼 로그인 페이지입니다.',
  alternates: { canonical: '/login' },
}

export default function LoginPage() {
  return (
    <>
      <PageHero eyebrow="계정" title="로그인" lead="Web3 인프라 플랫폼에 다시 오신 것을 환영합니다." />
      <Section tone="tint" spacing="compact" label="로그인">
        <LoginForm />
      </Section>
    </>
  )
}
