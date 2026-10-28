import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { AgentChat } from './AgentChat'

export const metadata: Metadata = {
  title: 'Biz-Ops AI 에이전트',
  description: '정부지원사업 심사 사례와 고객사 데이터를 바탕으로 운영 업무를 돕는 내부용 AI 에이전트입니다.',
  alternates: { canonical: '/agent' },
  // 허용된 내부 계정만 쓰는 페이지라 검색에 노출하지 않는다
  robots: { index: false, follow: false },
}

export default function AgentPage() {
  return (
    <>
      <PageHero
        visual="api"
        eyebrow="Biz-Ops AI 에이전트"
        title="운영 자동화 에이전트"
        lead="심사 사례 검색, 고객 관리, 제안서 검수, 공고 매칭을 질문 하나로 처리합니다."
      />
      <Section tone="tint" spacing="compact" label="에이전트 대화">
        <AgentChat />
      </Section>
    </>
  )
}
