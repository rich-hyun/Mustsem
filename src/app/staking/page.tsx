import type { Metadata } from 'next'
import { getNetwork } from '@/config/networks'
import { STAKING } from '@/config/contracts'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { StakingTool } from './StakingTool'

export const metadata: Metadata = {
  title: '스테이킹',
  description: 'MST를 wMST로 래핑하고, wMST를 스테이킹해 MST 보상을 받는 페이지입니다.',
  alternates: { canonical: '/staking' },
}

const NETWORK = getNetwork(STAKING.network)

export default function StakingPage() {
  return (
    <>
      <PageHero
        visual="infra"
        eyebrow="스테이킹"
        title="MST를 스테이킹하고 보상을 받으세요"
        lead={
          <>
            {NETWORK.name} 네트워크(체인 ID {NETWORK.chainId})에서 동작합니다.{' '}
            <br />
            MST를 wMST로 래핑한 뒤 wMST를 예치하면 MST 보상이 쌓입니다.
          </>
        }
      />
      <Section tone="tint" spacing="compact" label="스테이킹 도구">
        <StakingTool />
      </Section>
    </>
  )
}
