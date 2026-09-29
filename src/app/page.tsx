import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChartLineUpIcon,
  GraphIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { NavIcon } from '@/components/layout/NavIcon'
import { CtaPanel, FeatureGrid, IconTile, StatRow, TextLink } from '@/components/marketing/Blocks'
import { Faq } from '@/components/marketing/Faq'
import { Magnetic } from '@/components/motion/Magnetic'
import { Button } from '@/components/ui/Button'
import { Section, SectionHeading } from '@/components/ui/Section'
import { SITE } from '@/config/site'
import { HOME_FAQ, PROCESS, SERVICES, SPECS, START_PATHS } from '@/content/home'
import { HeroVideo } from './_home/HeroVideo'
import { NetworkDiagram } from './_home/NetworkDiagram'
import { PlatformLinker } from './_home/PlatformLinker'
import { ProcessProgress } from './_home/ProcessProgress'
import styles from './home.module.css'

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} | ${SITE.tagline}` },
  alternates: { canonical: '/' },
}

const FEATURES = [
  {
    icon: <GraphIcon size={22} />,
    title: '전용 네트워크 자동 구축',
    text: '기업별 독립적인 고성능 Web3 네트워크를 자동으로 구성합니다.',
  },
  {
    icon: <ShieldCheckIcon size={22} />,
    title: '엔터프라이즈급 보안',
    text: '암호화, 키 관리, 서명 과정을 분리한 보안 아키텍처를 제공합니다.',
    link: { href: '/security', label: '보안 설계 확인' },
  },
  {
    icon: <PlugsConnectedIcon size={22} />,
    title: 'REST API 연동',
    text: 'API 호출로 토큰 발행과 스마트컨트랙트 실행을 기존 시스템에 연결합니다.',
    link: { href: '/developers/guide', label: '개발 가이드 보기' },
  },
  {
    icon: <ChartLineUpIcon size={22} />,
    title: '확장 가능한 인프라',
    text: '비즈니스 성장에 따라 유연하게 확장 가능한 구조를 제공합니다.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-hero-title" data-surface="dark">
        <div className={styles.heroMedia} aria-hidden>
          <HeroVideo />
          <div className={styles.heroScrim} />
          <div className={styles.heroGrid} />
        </div>
        <div className="container">
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>Enterprise Web3 Infrastructure</p>
            <h1 id="home-hero-title" className={styles.heroTitle}>
              24시간 안에,
              <br />
              <strong>기업 전용 Web3 인프라</strong>를 시작하세요.
            </h1>
            <p className={styles.heroDesc}>
              전용 네트워크 구축부터 자산 토큰화, 스마트컨트랙트 연동까지.{' '}
              <br />
              검증된 보안 체계 위에서 귀사의 Web3 서비스를 빠르게 시작합니다.
            </p>
            <div className={styles.heroActions}>
              <Button href="/network#apply" variant="accent" size="lg">
                도입 상담 요청
                <ArrowRightIcon size={18} weight="bold" aria-hidden />
              </Button>
              <Button href="/developers" variant="onDark" size="lg">
                API 살펴보기
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Section id="services" tone="white" labelledBy="services-title">
        <SectionHeading
          id="services-title"
          title="필요한 서비스부터 연결하세요."
          lead={
            <>
              전용 네트워크를 구축하거나, 기존 서비스에 토큰화 기능을 더하세요.{' '}
              <br />
              비즈니스의 목적에 맞는 시작점을 선택할 수 있습니다.
            </>
          }
        />
        <div className={styles.paths} data-reveal-group="">
          {START_PATHS.map((path) => (
            <Link key={path.href} href={path.href} className={styles.path} data-spotlight="">
              <div className={styles.pathVisual} style={{ backgroundImage: `url(${path.image})` }} aria-hidden />
              <div className={styles.pathBody}>
                <span className={styles.pathCategory}>{path.category}</span>
                <h3 className={styles.pathTitle}>{path.title}</h3>
                <p className={styles.pathText}>{path.text}</p>
                <ol className={styles.pathFlow} aria-label={`${path.title} 진행 순서`}>
                  {path.flow.map((step) => (
                    <li key={step}>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <span className={styles.pathAction}>
                  {path.action}
                  <ArrowRightIcon size={16} weight="bold" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="platform" tone="tint" labelledBy="platform-title">
        <SectionHeading
          id="platform-title"
          title={
            <>
              비즈니스에 필요한 Web3,
              <br />
              <span className={styles.accentText}>하나의 전용 네트워크에서.</span>
            </>
          }
          lead="기업이 직접 운영하는 네트워크 위에 자산 발행과 서비스 연동을 더하세요. 머스트셈은 구축부터 운영까지 필요한 Web3 인프라를 제공합니다."
        />
        <PlatformLinker className={styles.platform}>
          <div className={styles.platformText}>
            <ul className={styles.serviceList} aria-label="연결 서비스">
              {SERVICES.map((service) => (
                <li key={service.href} data-svc={service.icon}>
                  <Link href={service.href} className={styles.serviceLink}>
                    <IconTile className={styles.serviceIcon}>
                      <NavIcon icon={service.icon} size={20} />
                    </IconTile>
                    <span className={styles.serviceText}>
                      <span className={styles.serviceTitle}>{service.title}</span>
                      <span className={styles.serviceDesc}>{service.text}</span>
                    </span>
                    <ArrowUpRightIcon className={styles.serviceArrow} size={18} weight="bold" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className={styles.platformMore}>
              <TextLink href="/developers/guide">개발 가이드 보기</TextLink>
            </div>
          </div>
          <figure className={styles.diagram}>
            <NetworkDiagram />
          </figure>
        </PlatformLinker>
      </Section>

      <section id="features" className={styles.band} aria-labelledby="features-title" data-surface="dark">
        <div className="container">
          <div className={styles.bandHead} data-reveal="">
            <h2 id="features-title" className={styles.bandTitle}>
              구축은 간결하게, 운영은 체계적으로.
            </h2>
            <p className={styles.bandLead}>
              EVM 호환 네트워크와 REST API를 바탕으로, 기존 시스템에 필요한 기능부터 연결할 수 있습니다.
            </p>
          </div>
          <StatRow items={SPECS} className={styles.specs} />
          <FeatureGrid className={styles.bandFeatures} columns={4} items={FEATURES} />
          <p className={styles.bandNote}>처리 성능과 구축 일정은 네트워크 구성 및 내부 확인 조건에 따라 달라질 수 있습니다.</p>
        </div>
      </section>

      <Section id="pricing" tone="white" labelledBy="process-title">
        <SectionHeading id="process-title" title="도입의 시작부터 운영까지." lead="서비스 검토에 필요한 내용을 순서대로 확인하세요." />
        <ProcessProgress className={styles.process}>
          <ol className={styles.processList}>
            {PROCESS.map((step, index) => (
              <li key={step.title} className={styles.processStep}>
                <span className={styles.processMarker} data-progress-marker="" aria-hidden>
                  {index + 1}
                </span>
                <h3 className={styles.processTitle}>
                  <span className="sr-only">{index + 1}단계: </span>
                  {step.title}
                </h3>
                <p className={styles.processText}>{step.text}</p>
                {step.link && <TextLink href={step.link.href}>{step.link.label}</TextLink>}
              </li>
            ))}
          </ol>
        </ProcessProgress>
      </Section>

      <Section id="faq" tone="tint" labelledBy="faq-title">
        <div className={styles.faqLayout}>
          <div className={styles.faqAside}>
            <SectionHeading
              id="faq-title"
              title={
                <>
                  도입 전에
                  <br />
                  궁금한 점을 확인하세요.
                </>
              }
              lead="구축 조건부터 연동과 보안까지, 검토에 필요한 내용을 모았습니다."
            />
          </div>
          <Faq items={HOME_FAQ} name="home-faq" />
        </div>
      </Section>

      <Section id="contact" tone="white" labelledBy="contact-title">
        <CtaPanel
          titleId="contact-title"
          label="Build with MUSTSEM"
          title={
            <>
              귀사에 맞는 Web3 인프라,{' '}
              <br />
              구조 설계부터 함께합니다.
            </>
          }
          text="요구사항을 알려주시면 네트워크 구성과 API 연동 범위를 빠르게 정리해드립니다."
          actions={
            <>
              <Magnetic>
                <Button href="/network#apply" variant="accent">
                  도입 상담 요청
                </Button>
              </Magnetic>
              <Button href="/security" variant="onDark">
                보안 아키텍처 확인
              </Button>
            </>
          }
          checklist={{ title: '지원 범위', items: ['기업 전용 네트워크', '자산 토큰화 API', 'Vault · HSM 보안 설계'] }}
        />
      </Section>
    </>
  )
}

