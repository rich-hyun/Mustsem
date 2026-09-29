import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { SbtTool } from './SbtTool'

export const metadata: Metadata = {
  title: 'SBT 발행',
  description: '지갑에 영구 귀속되는 소울바운드 토큰(SBT)을 발급하는 페이지입니다. 선택한 네트워크의 발행 코드도 만들 수 있습니다.',
  alternates: { canonical: '/sbt' },
}

export default function SbtPage() {
  return (
    <>
      <PageHero
        visual="token"
        eyebrow="소울바운드 토큰(SBT)"
        title="SoulBound Token 발행"
        lead="지갑에 영구 귀속되는 신뢰 기반 SBT를 발급합니다."
      />
      <Section tone="tint" spacing="compact" label="SBT 발행 도구">
        <SbtTool />
      </Section>
    </>
  )
}
