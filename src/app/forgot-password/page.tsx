import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata: Metadata = {
  title: '비밀번호 찾기',
  description: 'MUSTSEM 계정 비밀번호를 재설정하는 페이지입니다.',
  alternates: { canonical: '/forgot-password' },
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHero eyebrow="계정" title="비밀번호 찾기" lead="가입한 이메일로 인증 코드를 받아 새 비밀번호를 정합니다." />
      <Section tone="tint" spacing="compact" label="비밀번호 재설정">
        <ForgotPasswordForm />
      </Section>
    </>
  )
}
