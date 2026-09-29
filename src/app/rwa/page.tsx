import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { RwaTool } from './RwaTool'

export const metadata: Metadata = {
  title: 'RWA 토큰 발행',
  description: '실물 자산의 원본 파일을 IPFS에 등록하고, MetaMask로 온체인 RWA 토큰을 발행하는 페이지입니다.',
  alternates: { canonical: '/rwa' },
}

export default function RwaPage() {
  return (
    <>
      <PageHero
        visual="token"
        eyebrow="실물자산 토큰화(RWA)"
        title="RWA 토큰 발행"
        lead="IPFS · MetaMask 연동으로 실물 자산 파일을 온체인 RWA로 발행합니다."
      />
      <Section tone="tint" spacing="compact" label="RWA 발행 도구">
        <RwaTool />
      </Section>
    </>
  )
}
