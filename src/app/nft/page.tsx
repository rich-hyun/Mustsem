import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { NftTool } from './NftTool'

export const metadata: Metadata = {
  title: 'NFT 발행',
  description: '네트워크를 선택하고 이미지·메타데이터 기반 NFT를 발행하는 페이지입니다. Solidity 코드와 Python 발행 스크립트도 만들 수 있습니다.',
  alternates: { canonical: '/nft' },
}

export default function NftPage() {
  return (
    <>
      <PageHero
        visual="token"
        eyebrow="대체불가토큰(NFT)"
        title="NFT 발행"
        lead="이미지·메타데이터·스마트컨트랙트 연동으로 고유 자산 토큰을 생성합니다."
      />
      <Section tone="tint" spacing="compact" label="NFT 발행 도구">
        <NftTool />
      </Section>
    </>
  )
}
