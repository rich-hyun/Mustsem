import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { AgentChat } from './AgentChat'

export const metadata: Metadata = {
  title: 'Biz-Ops AI 에이전트',
  description: '실제 정부지원사업 심사 사례를 바탕으로 제안서 검수, 창업기업 판정, 공고 검색을 돕는 AI 에이전트입니다.',
  alternates: { canonical: '/agent' },
  // 시범 운영 중이라 아직 검색에 노출하지 않는다
  robots: { index: false, follow: false },
}

export default function AgentPage() {
  return (
    <>
      <PageHero
        visual="api"
        eyebrow="Biz-Ops AI 에이전트"
        title="지원사업 준비 에이전트"
        lead="실제 심사 사례에서 반복된 지적을 바탕으로 제안서 검수, 창업기업 판정, 공고 검색을 질문 하나로 처리합니다."
      />
      <Section tone="tint" spacing="compact" label="에이전트 대화">
        <AgentChat />
      </Section>
    </>
  )
}
