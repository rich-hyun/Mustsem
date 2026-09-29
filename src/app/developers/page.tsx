import {
  ArrowRightIcon,
  BankIcon,
  BookOpenTextIcon,
  CalendarBlankIcon,
  CoffeeIcon,
  GaugeIcon,
  GearIcon,
  HeartIcon,
  MusicNotesIcon,
  PulseIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  TShirtIcon,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { BannerRow, StatRow } from '@/components/marketing/Blocks'
import { HeroBadges, HeroLinks } from '@/components/marketing/HeroMeta'
import { Button } from '@/components/ui/Button'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { CATALOG_STATS, INDUSTRIES, type IndustryId } from '@/content/api-catalog'
import { ApiExplorer } from './ApiExplorer'
import styles from './developers.module.css'

export const metadata: Metadata = {
  title: 'API 카탈로그',
  description: 'NFT·SBT·RWA·토큰 정책·거버넌스·노드 운영까지, 머스트셈이 제공하는 전체 API 카탈로그입니다.',
  alternates: { canonical: '/developers' },
}

/** 원본과 같은 그림(하트·맥박·톱니·셔츠·음표·컵·은행·달력). 색은 CSS의 data-tone */
const INDUSTRY_ICON = {
  beauty: HeartIcon,
  health: PulseIcon,
  manufacturing: GearIcon,
  fashion: TShirtIcon,
  kpop: MusicNotesIcon,
  food: CoffeeIcon,
  finance: BankIcon,
  event: CalendarBlankIcon,
} satisfies Record<IndustryId, unknown>

export default function DevelopersPage() {
  return (
    <>
      <PageHero
        visual="api"
        eyebrow="API 카탈로그"
        title="머스트셈 네트워크 API 카탈로그"
        lead={
          <>
            머스트셈은 2025년부터 블록체인 기반 AI 융합 서비스를 위해 <strong>스마트 컨트랙트 기반 API</strong>를 제공하고 있습니다.{' '}
            <br />
            금융기관 및 엔터프라이즈 환경을 위한 안전한 온체인 API 게이트웨이를 제공합니다.
          </>
        }
      >
        <HeroBadges
          items={[
            { key: 'enterprise', icon: <ShieldCheckIcon size={14} aria-hidden />, label: 'Enterprise Ready' },
            { key: 'multichain', icon: <SquaresFourIcon size={14} aria-hidden />, label: 'Multi-Chain Support' },
            { key: 'monitoring', icon: <PulseIcon size={14} aria-hidden />, label: 'Real-time Monitoring' },
          ]}
        />
        <HeroLinks>
          <Button href="/developers/guide" variant="onDark" size="sm">
            <BookOpenTextIcon size={16} aria-hidden />
            API 가이드
          </Button>
          <Button href="/dashboard" variant="onDark" size="sm">
            <GaugeIcon size={16} aria-hidden />
            대시보드
          </Button>
        </HeroLinks>
      </PageHero>

      <Section tone="tint" spacing="compact" label="API 카탈로그 요약">
        <StatRow items={CATALOG_STATS} />
      </Section>

      {/* 아래쪽 세 구획은 원본처럼 한 톤(옅은 면)으로 이어지고, 흰 카드가 그 위에 놓인다 */}
      <Section id="api-history" tone="tint" spacing="compact" labelledBy="api-history-title">
        <SectionHeading id="api-history-title" title="API 제공 이력" lead="다양한 산업 분야에서 블록체인 기반 솔루션을 제공한 실적" />
        <ul className={styles.industries} data-reveal-group="">
          {INDUSTRIES.map((industry) => {
            const Icon = INDUSTRY_ICON[industry.id]
            return (
              <li key={industry.id}>
                <article
                  className={styles.industry}
                  data-tone={industry.id}
                  data-spotlight=""
                  aria-labelledby={`industry-${industry.id}`}
                >
                  <header className={styles.industryHead}>
                    <span className={styles.industryIcon} aria-hidden>
                      <Icon size={22} />
                    </span>
                    <h3 id={`industry-${industry.id}`} className={styles.industryName}>
                      {industry.name}
                    </h3>
                  </header>
                  <ul className={styles.cases}>
                    {industry.cases.map((item) => (
                      <li key={item.title} className={styles.case}>
                        <div className={styles.caseHead}>
                          <h4 className={styles.caseTitle}>{item.title}</h4>
                          <time className={styles.caseDate} dateTime={item.date.replace('.', '-')}>
                            {item.date}
                          </time>
                        </div>
                        <p className={styles.caseDesc}>{item.description}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section tone="tint" spacing="compact" labelledBy="api-catalog-title">
        <SectionHeading
          id="api-catalog-title"
          title="제공 가능한 API"
          lead="NFT, SBT, RWA, 토큰 정책, 브릿지, 거버넌스, 노드 관리 등 엔터프라이즈 Web3 전반을 아우르는 API"
        />
        <ApiExplorer />
      </Section>

      <Section tone="tint" spacing="compact" label="API 사용 시작">
        <BannerRow
          tone="light"
          title="API 사용 시작하기"
          text="API 가이드에서 호출 방식을 확인하고 API 키를 발급받으세요."
          action={
            <Button href="/developers/guide" variant="primary">
              API 가이드 보기
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </Button>
          }
        />
      </Section>
    </>
  )
}
