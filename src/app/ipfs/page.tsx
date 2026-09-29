import {
  ArrowRightIcon,
  ClockCounterClockwiseIcon,
  CubeIcon,
  FingerprintIcon,
  GearSixIcon,
  HardDrivesIcon,
  KeyIcon,
  LockKeyIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BannerRow, FeatureGrid, IconTile } from '@/components/marketing/Blocks'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, CodeBlock, type BadgeTone } from '@/components/ui/DataDisplay'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { cx } from '@/lib/cx'
import styles from './ipfs.module.css'

export const metadata: Metadata = {
  title: 'AI 모델 IPFS 보안 등록 API',
  description: 'AI 모델을 IPFS에 암호화 등록하고 블록체인으로 소유권·무결성을 증명하는 보안 API를 소개합니다.',
  alternates: { canonical: '/ipfs' },
}

const CORE_FEATURES = [
  {
    icon: <HardDrivesIcon size={22} />,
    title: '탈중앙화 분산 저장',
    text: '학습 완료된 AI 모델을 AES-256 암호화 후 IPFS 네트워크에 분산 저장하여 단일 서버 해킹, 서비스 중단으로 인한 모델 소실 위험을 차단합니다.',
  },
  {
    icon: <FingerprintIcon size={22} />,
    title: '콘텐츠 해시 기반 무결성 검증',
    text: 'IPFS CID(콘텐츠 식별자) 자동 생성 및 블록체인 온체인 기록을 통해 모델 파일의 위변조 여부를 언제든 즉시 검증할 수 있습니다.',
  },
  {
    icon: <LockKeyIcon size={22} />,
    title: '접근제어 및 암호화',
    text: '등록된 모델에 대한 접근 권한을 API 키 단위로 세분화하여 외부 유출 없이 안전한 모델 공유 및 협업 환경을 구성할 수 있습니다.',
  },
]

const REASONS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <SealCheckIcon size={22} />,
    title: '온체인 소유권 증명',
    text: '온체인 타임스탬프 및 소유권 증명으로 AI 저작권 침해 분쟁 시 법적 증거 자료로 활용 가능',
  },
  {
    icon: <ClockCounterClockwiseIcon size={22} />,
    title: '버전 관리',
    text: '모델의 학습 이력과 버전을 체계적으로 관리하여 특정 시점의 모델 상태를 추적·복원 가능',
  },
  {
    icon: <ShieldWarningIcon size={22} />,
    title: '위변조 방지',
    text: '블록체인에 기록된 CID와 비교하여 모델 파일의 무단 수정 여부를 실시간 탐지',
  },
  {
    icon: <KeyIcon size={22} />,
    title: '보안 유지',
    text: 'AES-256 암호화 및 API 키 기반 접근 제어로 모델의 기밀성 보장',
  },
]

const REQUEST_EXAMPLE = `POST /api/v1/ipfs/register

{
  "model_file": "base64_encoded_model_data",
  "model_name": "image_classifier_v3.pth",
  "encryption": "AES-256",
  "metadata": {
    "framework": "PyTorch",
    "version": "3.0",
    "owner": "0x1234...5678",
    "description": "이미지 분류 모델 v3"
  }
}`

const RESPONSE_EXAMPLE = `{
  "success": true,
  "cid": "QmX4z8n...abc123",
  "txHash": "0xabc...def",
  "registeredAt": "2025-03-23T09:00:00Z",
  "encryption": "AES-256",
  "accessKey": "mk_live_..."
}`

const PILLARS: {
  name: string
  icon: ReactNode
  text: string
  status: string
  statusTone: BadgeTone
  detail?: string
  current?: boolean
}[] = [
  {
    name: 'Build',
    icon: <CubeIcon size={22} />,
    text: '24시간 블록체인 메인넷 구축, 스마트컨트랙트 맞춤 공급',
    status: '상용화 완료',
    statusTone: 'success',
    detail: '40개사 이용중',
  },
  {
    name: 'Operate',
    icon: <GearSixIcon size={22} />,
    text: 'Web3 비즈니스 운영 자동화 에이전트',
    status: '베타 운영 중',
    statusTone: 'neutral',
  },
  {
    name: 'Protect',
    icon: <ShieldCheckIcon size={22} />,
    text: 'AI 모델 IPFS 보안 등록, 온체인 이상거래 탐지',
    status: '파일럿 적용 중',
    statusTone: 'accent',
    current: true,
  },
]

export default function IpfsPage() {
  return (
    <>
      <PageHero
        visual="secure"
        eyebrow="IPFS 보안 등록"
        title="AI 모델 IPFS 보안 등록 API"
        lead={
          <>
            AI 모델 파일을 IPFS 분산저장소에 등록하고{' '}
            <br />
            블록체인 기반 소유권·무결성 증명을 자동화하는 보안 API
          </>
        }
      />

      <Section tone="white" labelledBy="ipfs-overview-title">
        <SectionHeading
          id="ipfs-overview-title"
          title="AI 모델의 안전한 보관과 소유권 증명"
          lead="접근제어 및 암호화 적용으로 허가된 사용자만 모델 열람 및 다운로드가 가능하며, CID(IPFS 콘텐츠 식별자)의 블록체인 저장 시점 타임스탬프 기록을 통한 소유권 증명 기능을 제공합니다."
        />
        <p className={styles.gridLabel} data-reveal="">
          3가지 핵심 보안 기능
        </p>
        <FeatureGrid items={CORE_FEATURES} columns={3} />
      </Section>

      <Section tone="tint" labelledBy="ipfs-why-title">
        <SectionHeading id="ipfs-why-title" title="왜 IPFS 보안 등록이 필요한가" />
        <ul className={styles.reasons} data-reveal-group="">
          {REASONS.map((reason) => (
            <li key={reason.title}>
              <Card className={styles.reason} spotlight>
                <IconTile>{reason.icon}</IconTile>
                <div className={styles.reasonBody}>
                  <h3 className={styles.reasonTitle}>{reason.title}</h3>
                  <p className={styles.reasonText}>{reason.text}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="white" labelledBy="ipfs-api-title">
        <SectionHeading
          id="ipfs-api-title"
          title="간편한 REST API 호출"
          lead="모델 파일과 메타데이터를 한 번의 요청으로 등록하고, 응답으로 CID와 트랜잭션 해시를 받습니다."
        />
        <div className={styles.codePair} data-reveal-group="">
          <CodeBlock title="Request" code={REQUEST_EXAMPLE} action={<CopyButton value={REQUEST_EXAMPLE} label="요청 예시 복사" />} />
          <CodeBlock title="Response" code={RESPONSE_EXAMPLE} action={<CopyButton value={RESPONSE_EXAMPLE} label="응답 예시 복사" />} />
        </div>
      </Section>

      <Section tone="tint" labelledBy="ipfs-platform-title">
        <SectionHeading
          id="ipfs-platform-title"
          title="MUSTSEM 플랫폼 내 위치"
          lead="IPFS 보안 등록은 구축(Build) · 운영(Operate)에 이은 보호(Protect) 영역의 서비스입니다."
        />
        <ul className={styles.pillars} data-reveal-group="">
          {PILLARS.map((pillar) => (
            <li key={pillar.name}>
              <Card
                className={cx(styles.pillar, pillar.current && styles.pillarCurrent)}
                aria-current={pillar.current ? 'page' : undefined}
                spotlight
              >
                {pillar.current && (
                  <span className={styles.ring} aria-hidden data-live="">
                    <span className={styles.sweep} />
                  </span>
                )}
                <div className={styles.pillarHead}>
                  <IconTile>{pillar.icon}</IconTile>
                  {pillar.current && (
                    <Badge tone="accent" pill>
                      지금 보는 서비스
                    </Badge>
                  )}
                </div>
                <h3 className={styles.pillarTitle}>{pillar.name}</h3>
                <p className={styles.pillarText}>{pillar.text}</p>
                <p className={styles.pillarStatus}>
                  <Badge tone={pillar.statusTone}>{pillar.status}</Badge>
                  {pillar.detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="white" spacing="compact" label="도입 문의">
        <BannerRow
          title="AI 모델을 안전하게 보호하세요"
          text="IPFS 분산 저장과 블록체인 소유권 증명으로 AI 자산을 보호합니다."
          action={
            <div className={styles.bannerActions}>
              <Button href="/developers/guide" variant="accent">
                API 문서 보기
                <ArrowRightIcon size={16} weight="bold" aria-hidden />
              </Button>
              <Button href="/network#apply" variant="onDark">
                도입 상담 요청
              </Button>
            </div>
          }
        />
      </Section>
    </>
  )
}
