import type { Metadata } from 'next'
import { Section } from '@/components/ui/Section'
import { PageHero } from '@/components/ui/PageHero'
import { BridgeTool } from './BridgeTool'

export const metadata: Metadata = {
  title: '크로스체인 브릿지',
  description: 'JKK-TMZ 네트워크의 TMZ를 래핑하고 Mustsem 체인의 wMST로 브릿지하는 페이지입니다.',
  alternates: { canonical: '/bridge' },
}

export default function BridgePage() {
  return (
    <>
      <PageHero
        visual="infra"
        eyebrow="브릿지"
        title="자체 네트워크 코인으로 wMST를 구입하세요"
        lead="MST 코인과 wMST 코인은 1대 1 비율을 유지하며, wMST는 스테이킹 등의 기능을 지원합니다."
      />
      <Section tone="tint" spacing="compact" label="브릿지 실행">
        <BridgeTool />
      </Section>
    </>
  )
}
