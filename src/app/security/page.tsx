import {
  ArrowRightIcon,
  BellIcon,
  BuildingsIcon,
  CheckIcon,
  CpuIcon,
  CubeIcon,
  DatabaseIcon,
  DesktopIcon,
  HardDrivesIcon,
  KeyIcon,
  ListChecksIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { BannerRow, FeatureGrid, IconTile, StatRow } from '@/components/marketing/Blocks'
import { FlowDiagram, type FlowNode } from '@/components/marketing/FlowDiagram'
import { HeroBadges } from '@/components/marketing/HeroMeta'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/DataDisplay'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { Table, cell } from '@/components/ui/Table'
import { SECURITY_LAYERS, SECURITY_ROADMAP, SECURITY_STATS } from '@/content/security'
import styles from './security.module.css'

export const metadata: Metadata = {
  title: '보안 센터',
  description: 'Vault, AES-256, HSM 기반 3단계 보안 체계와 도입 로드맵을 소개하는 보안 센터입니다.',
  alternates: { canonical: '/security' },
}

const ARCHITECTURE: FlowNode[] = [
  { id: 'client', icon: <DesktopIcon size={20} />, title: 'Client', text: 'API 요청 전송', badge: 'TLS 1.3' },
  { id: 'api', icon: <HardDrivesIcon size={20} />, title: 'API Server', text: '요청 검증 및 라우팅', badge: 'JWT / RBAC', via: 'HTTPS + HMAC 서명' },
  { id: 'vault', icon: <KeyIcon size={20} />, title: 'HashiCorp Vault', text: '키 생성, 보관, 회전 자동화', badge: 'AES-256-GCM', via: 'Vault Transit API' },
  { id: 'store', icon: <DatabaseIcon size={20} />, title: 'DB / IPFS', text: '암호화된 데이터만 저장', badge: 'Zero Knowledge', via: '암호문 저장' },
  { id: 'hsm', icon: <LockKeyIcon size={20} />, title: 'HSM Signer', text: '개인키 외부 반출 금지', badge: 'PKCS#11', via: '서명 요청' },
  { id: 'chain', icon: <CubeIcon size={20} />, title: 'Blockchain + Webhook', text: '불변 기록 + 결과 알림', badge: 'HMAC-SHA256', via: '서명된 TX 전송' },
]

/** nodes: 옆 흐름도에서 이 계층을 맡는 노드 (마우스를 올리면 함께 밝아진다) */
const LAYERS = [
  { title: 'AES 암호화', text: '민감 데이터는 AES-256-GCM 암호문으로만 저장합니다. IPFS에도 암호문만 올라갑니다.', nodes: 'vault store' },
  { title: 'Vault 키 관리', text: '키 생성·보관·회전은 Vault가 맡고, 서버는 키 평문을 보관하지 않습니다.', nodes: 'vault' },
  { title: 'HSM 내부 서명', text: '트랜잭션 서명은 HSM 안에서만 수행해 개인키가 외부로 반출되지 않습니다.', nodes: 'hsm' },
]

const COMPONENTS = [
  {
    icon: <KeyIcon size={22} />,
    title: 'Vault (키 금고)',
    text: '중앙 집중형 키 관리 시스템. 암호화 키 생성, 보관, 회전을 자동화하며 서버는 절대 키 평문을 보지 않습니다. 정책 기반 접근 제어로 최소 권한 원칙을 적용합니다.',
  },
  {
    icon: <ShieldCheckIcon size={22} />,
    title: 'AES-256-GCM',
    text: '가장 안전한 대칭키 암호화 방식. 암호화와 무결성 검사 태그를 동시에 제공하여 데이터 위변조를 원천 차단합니다. 금융권 표준 암호화 알고리즘입니다.',
  },
  {
    icon: <CpuIcon size={22} />,
    title: 'HSM (하드웨어 보안 모듈)',
    text: '서명 전용 하드웨어 장치. 개인키는 절대 외부로 반출되지 않으며 모든 트랜잭션 서명은 HSM 내부에서만 수행됩니다. FIPS 140-2 인증.',
  },
]

const WEBHOOK_POINTS = ['지수 백오프 자동 재시도', '멱등키 기반 중복 방지', 'HMAC-SHA256 서명 검증']

export default function SecurityPage() {
  return (
    <>
      <PageHero
        visual="secure"
        eyebrow="보안 센터"
        title={
          <>
            엔터프라이즈급{' '}
            <br />
            보안 &amp; 암호화 아키텍처
          </>
        }
        lead={
          <>
            Vault, AES-256, HSM 기반의 3단계 보안 체계로{' '}
            <br />
            금융기관 수준의 데이터 보호를 제공합니다.
          </>
        }
      >
        <HeroBadges
          items={[
            { key: 'aes', icon: <ShieldCheckIcon size={14} aria-hidden />, label: 'AES-256-GCM' },
            { key: 'hsm', icon: <LockKeyIcon size={14} aria-hidden />, label: 'HSM 서명' },
            { key: 'vault', icon: <KeyIcon size={14} aria-hidden />, label: 'Vault 키 관리' },
          ]}
        />
      </PageHero>

      <Section tone="tint" spacing="compact" label="보안 사양 요약">
        <StatRow items={SECURITY_STATS} />
      </Section>

      <Section id="architecture" tone="white" labelledBy="architecture-title">
        <div className={styles.archLayout}>
          <div className={styles.archIntro}>
            <SectionHeading
              id="architecture-title"
              className={styles.archHeading}
              title="보안 아키텍처 개요"
              lead="1차 AES 암호화 → Vault 키 관리 → HSM 내부 서명의 3단계 보안 체계"
            />
            <ol className={styles.layers} aria-label="3단계 보안 체계">
              {LAYERS.map((layer) => (
                <li key={layer.title} data-flow-trigger={layer.nodes}>
                  <strong className={styles.layerTitle}>{layer.title}</strong>
                  <span className={styles.layerText}>{layer.text}</span>
                </li>
              ))}
            </ol>
          </div>
          <FlowDiagram nodes={ARCHITECTURE} label="요청이 보안 계층을 거쳐 블록체인에 기록되는 순서" />
        </div>
      </Section>

      <Section id="design" tone="tint" labelledBy="design-title">
        <SectionHeading id="design-title" title="보안 & 암호화 설계" lead="구간별 보안 방식 및 구현 상세" />
        <Table caption="구간별 보안 설계: 구간, 목적, 방식, 구현 예시, 비고" stackOnMobile>
          <thead>
            <tr>
              <th scope="col">구간</th>
              <th scope="col">목적</th>
              <th scope="col">방식</th>
              <th scope="col">구현 예시</th>
              <th scope="col">비고</th>
            </tr>
          </thead>
          <tbody>
            {SECURITY_LAYERS.map((row) => (
              <tr key={row.segment}>
                <td data-label="구간" className={cell.strong}>
                  {row.segment}
                </td>
                <td data-label="목적">{row.purpose}</td>
                <td data-label="방식">
                  <Badge tone="accent">{row.method}</Badge>
                </td>
                <td data-label="구현 예시">{row.exampleIsCode ? <code className={styles.example}>{row.example}</code> : row.example}</td>
                <td data-label="비고" className={styles.note}>
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section id="components" tone="white" labelledBy="components-title">
        <SectionHeading id="components-title" title="핵심 보안 구성 요소" lead="엔터프라이즈급 보안을 위한 3가지 핵심 컴포넌트" />
        <FeatureGrid items={COMPONENTS} columns={3} />
      </Section>

      <Section id="roadmap" tone="tint" labelledBy="roadmap-title">
        <SectionHeading id="roadmap-title" title="보안 도입 로드맵" lead="단계별 보안 강화 계획" />
        <ol className={styles.roadmap} data-reveal-group="">
          {SECURITY_ROADMAP.map((stage, index) => (
            <li key={stage.title}>
              <Card className={styles.stage} spotlight>
                <div className={styles.stageHead}>
                  <span className={styles.stageNo} aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Badge tone="accent" pill>
                    {stage.level}
                  </Badge>
                </div>
                <h3 className={styles.stageTitle}>{stage.title}</h3>
                <p className={styles.stageText}>{stage.text}</p>
                <ul className={styles.tags} aria-label="적용 기술">
                  {stage.tags.map((tag) => (
                    <li key={tag}>
                      <Badge>{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="extras" tone="white" labelledBy="extras-title">
        <SectionHeading id="extras-title" title="추가 보안 기능" />
        <ul className={styles.extras} data-reveal-group="">
          <li>
            <Card className={styles.extra} spotlight>
              <IconTile>
                <BellIcon size={22} />
              </IconTile>
              <h3 className={styles.extraTitle}>Webhook 결과 알림</h3>
              <ul className={styles.bullets}>
                {WEBHOOK_POINTS.map((point) => (
                  <li key={point}>
                    <CheckIcon size={16} weight="bold" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
              <code className={styles.sample}>X-Signature: HMAC-SHA256=58af0c3e...</code>
            </Card>
          </li>
          <li>
            <Card className={styles.extra} spotlight>
              <IconTile>
                <ListChecksIcon size={22} />
              </IconTile>
              <h3 className={styles.extraTitle}>감사 로그 &amp; 추적</h3>
              <p className={styles.extraText}>
                모든 요청, 서명, 결과는 해시체인 기반으로 기록되어 변경 불가하며 대시보드에서 실시간으로 조회 가능합니다.
              </p>
            </Card>
          </li>
          <li>
            <Card className={styles.extra} spotlight>
              <IconTile>
                <UsersThreeIcon size={22} />
              </IconTile>
              <h3 className={styles.extraTitle}>RBAC 역할 기반 권한</h3>
              <p className={styles.extraText}>
                운영자, 개발자, 검증자 등 역할별로 민감 API 접근을 제한합니다. 최소 권한 원칙으로 보안 위험을 최소화합니다.
              </p>
            </Card>
          </li>
        </ul>

        <div className={styles.onprem} data-reveal="">
          <IconTile>
            <BuildingsIcon size={22} />
          </IconTile>
          <div>
            <h3 className={styles.onpremTitle}>온프레미스 및 데이터 주권 옵션</h3>
            <p className={styles.onpremText}>
              기업 보안정책에 따라 Vault 및 HSM을 내부망에 배치할 수 있습니다. 동일한 API 프로토콜을 유지하면서 데이터 주권을 완전히
              보존할 수 있으며, 규제 준수 요구사항을 충족합니다.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="tint" spacing="compact" label="보안 상담">
        <BannerRow
          title="보안 상담이 필요하신가요?"
          text="엔터프라이즈 보안 요구사항에 맞춘 맞춤형 솔루션을 제공합니다."
          action={
            <Button href="/network#apply" variant="accent">
              도입 상담 요청
              <ArrowRightIcon size={16} weight="bold" aria-hidden />
            </Button>
          }
        />
      </Section>
    </>
  )
}
