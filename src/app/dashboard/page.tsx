import type { Metadata } from 'next'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { BalanceBoard } from './BalanceBoard'
import { MarketChart } from './MarketChart'

export const metadata: Metadata = {
  title: '대시보드',
  description: 'MST 코인 가치 변화와 MST 네트워크 주요 지갑 잔액을 실시간으로 모니터링합니다.',
  alternates: { canonical: '/dashboard' },
}

export default function DashboardPage() {
  return (
    <>
      <PageHero
        eyebrow="네트워크 대시보드"
        title="MST 네트워크 모니터링"
        lead="MST 네트워크의 주요 지갑 잔액을 실시간으로 모니터링합니다."
      />
      <Section id="market" tone="white" labelledBy="market-title">
        <SectionHeading
          id="market-title"
          title="머스트리 코인 가치 변화"
          lead={
            <>
              2026년 1월 1일부터 오늘까지 비트코인, 미국 QQQ의 실제 과거 시세와 MST 코인(비트코인 대비 +1%{' '}
              <span className="keep">파생 지수)을</span> 같은 기준(1월 1일 = 100)으로 맞춰 비교합니다.
            </>
          }
        />
        <MarketChart />
      </Section>
      <Section tone="tint" labelledBy="balances-title">
        <SectionHeading id="balances-title" title="주요 지갑 잔액" lead="운영 지갑별 MST 잔액과 API 동기화 상태를 확인하세요." />
        <BalanceBoard />
      </Section>
    </>
  )
}
