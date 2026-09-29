import {
  ArrowRightIcon,
  BuildingsIcon,
  CheckCircleIcon,
  CodeIcon,
  CubeIcon,
  DesktopIcon,
  FileTextIcon,
  GlobeIcon,
  HardDrivesIcon,
  ImageSquareIcon,
  KeyIcon,
  LockKeyIcon,
  SealCheckIcon,
} from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BannerRow, FeatureGrid, IconTile } from '@/components/marketing/Blocks'
import { FlowDiagram } from '@/components/marketing/FlowDiagram'
import { HeroBadges } from '@/components/marketing/HeroMeta'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { Badge, CodeBlock } from '@/components/ui/DataDisplay'
import { Notice } from '@/components/ui/Notice'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { GuideToc } from './GuideToc'
import styles from './guide.module.css'

export const metadata: Metadata = {
  title: 'API 가이드',
  description: '스마트 컨트랙트 호출을 일반 HTTP API처럼 사용하는 방법을 안내하는 초보자용 가이드입니다.',
  alternates: { canonical: '/developers/guide' },
}

const QUICK_START = [
  {
    icon: <KeyIcon size={22} />,
    title: 'API 키 발급',
    text: (
      <>
        발급받은 <code>x-api-key</code>를 모든 요청 헤더에 포함합니다.
      </>
    ),
  },
  {
    icon: <CodeIcon size={22} />,
    title: 'API 호출',
    text: 'REST API로 NFT·SBT·RWA 등 블록체인 기능을 간편하게 사용합니다.',
  },
  {
    icon: <CheckCircleIcon size={22} />,
    title: '결과 확인',
    text: (
      <>
        응답의 <code>transactionHash</code>로 블록체인 기록 증거를 확인합니다.
      </>
    ),
  },
]

const FLOW = [
  { icon: <DesktopIcon size={20} />, title: '클라이언트 요청', text: 'JSON 형태의 API 요청 전송 (REST API)' },
  { icon: <HardDrivesIcon size={20} />, title: 'MST 서버 처리', text: '인증 확인, 스마트 컨트랙트 함수 자동 실행', via: 'HTTP Request' },
  { icon: <CubeIcon size={20} />, title: '블록체인 기록', text: '트랜잭션 기록 완료 → transactionHash 반환', via: 'Transaction' },
]

const TOC = [
  { id: 'what', label: 'MST-Contract API란?' },
  { id: 'how', label: '어떻게 동작하나요?' },
  { id: 'steps', label: '사용 절차' },
  { id: 'examples', label: '예시로 이해하기' },
]

const EXAMPLES: { icon: ReactNode; title: string; text: string; code: string }[] = [
  {
    icon: <ImageSquareIcon size={20} />,
    title: 'NFT 발행하기',
    text: '“NFT를 발행한다” → 아래 API를 호출하면 서버가 블록체인에 NFT를 생성합니다.',
    code: 'POST /v1/nfts/mint',
  },
  {
    icon: <BuildingsIcon size={20} />,
    title: 'RWA 등록하기',
    text: '“실물자산을 블록체인에 등록한다” → RWA 토큰이 생성되고 기록됩니다.',
    code: 'POST /v1/rwa/mint',
  },
  {
    icon: <SealCheckIcon size={20} />,
    title: 'SBT 발급하기',
    text: '“권리를 부여한다” → 양도 불가한 인증·권한 토큰을 발급합니다.',
    code: 'POST /v1/sbts/mint',
  },
]

function ArticleHead({ id, title, tag }: { id: string; title: string; tag: string }) {
  return (
    <div className={styles.articleHead}>
      <h3 id={id} className={styles.articleTitle}>
        {title}
      </h3>
      <Badge>{tag}</Badge>
    </div>
  )
}

export default function ApiGuidePage() {
  return (
    <>
      <PageHero
        visual="api"
        eyebrow="API 가이드"
        title="스마트 컨트랙트 기반 API 사용 설명"
        lead={
          <>
            복잡한 스마트 컨트랙트 호출을 <strong>일반 HTTP API 방식</strong>으로{' '}
            <br />
            누구나 사용할 수 있도록 구성된 가이드입니다.
          </>
        }
      >
        <HeroBadges
          items={[
            { key: 'openapi', icon: <FileTextIcon size={14} aria-hidden />, label: 'OpenAPI 3.1' },
            {
              key: 'auth',
              icon: <LockKeyIcon size={14} aria-hidden />,
              label: (
                <>
                  Auth: <code>x-api-key</code>
                </>
              ),
            },
            { key: 'network', icon: <GlobeIcon size={14} aria-hidden />, label: 'Network: 사내 전용/테스트넷' },
          ]}
        />
      </PageHero>

      <Section id="quick-start" tone="white" labelledBy="quick-start-title">
        <SectionHeading id="quick-start-title" title="빠른 시작" />
        <FeatureGrid items={QUICK_START} columns={3} />
      </Section>

      <Section id="flow" tone="tint" labelledBy="flow-title">
        <div className={styles.flowLayout}>
          <SectionHeading
            id="flow-title"
            className={styles.flowHeading}
            title="API 동작 흐름"
            lead="여러분의 요청이 블록체인에 기록되는 과정입니다. 요청을 보내면 서버가 컨트랙트를 실행하고, 기록이 끝나면 transactionHash를 돌려줍니다."
          />
          <FlowDiagram nodes={FLOW} label="API 요청이 블록체인에 기록되는 순서" />
        </div>
      </Section>

      <Section tone="white" labelledBy="guide-title">
        <div className={styles.docLayout}>
          <GuideToc items={TOC} />

          <div className={styles.docBody}>
            <SectionHeading id="guide-title" title="초보자를 위한 API 설명" lead="MST-Contract API를 처음 사용하는 분들을 위한 친절한 가이드" />

            <article id="what" className={styles.article} aria-labelledby="what-title">
              <ArticleHead id="what-title" title="MST-Contract API란?" tag="개요" />
              <p>
                블록체인 상의 스마트 컨트랙트를 직접 다루지 않아도, <strong className={styles.em}>일반적인 웹 API 호출만으로</strong> NFT
                발행, SBT 발급, RWA 등록과 같은 기능을 사용할 수 있게 만든 서비스입니다.
              </p>
              <p>지갑 연결, 가스 설정, 서명 처리 등 복잡한 과정은 모두 서버가 대신 처리합니다.</p>
            </article>

            <article id="how" className={styles.article} aria-labelledby="how-title">
              <ArticleHead id="how-title" title="어떻게 동작하나요?" tag="원리" />
              <p>
                여러분은 단순히 <strong className={styles.em}>JSON 형태의 API 요청</strong>만 보냅니다. 그러면 서버가 해당 요청에 맞는 스마트
                컨트랙트 함수를 자동으로 실행합니다. 트랜잭션이 블록체인에 기록되면 그 결과를 API 응답으로 전달합니다.
              </p>
              <Notice tone="info" title="동작 구조" className={styles.callout}>
                블록체인 사용 = 서버에 API 요청 → 서버가 대신 처리 → 블록체인 기록
              </Notice>
            </article>

            <article id="steps" className={styles.article} aria-labelledby="steps-title">
              <ArticleHead id="steps-title" title="사용 절차" tag="실전" />
              <ol className={styles.procedure} data-reveal-group="">
                <li>
                  <span>
                    API 키를 발급받습니다. 요청 헤더에 <code>x-api-key</code>를 포함합니다.
                  </span>
                </li>
                <li>
                  <span>
                    Base URL을 확인합니다. 예: <code>https://api.mst.network/v1</code>
                  </span>
                </li>
                <li>
                  <span>필요한 기능(NFT·SBT·RWA 등)에 맞는 API를 호출합니다.</span>
                </li>
                <li>
                  <span>
                    응답의 <code>transactionHash</code>는 ‘블록체인 기록 증거’입니다.
                  </span>
                </li>
                <li>
                  <span>관리 대시보드에서 처리 상태와 로그를 확인합니다.</span>
                </li>
              </ol>
            </article>

            <article id="examples" className={styles.article} aria-labelledby="examples-title">
              <ArticleHead id="examples-title" title="예시로 이해하기" tag="코드" />
              <ul className={styles.examples} data-reveal-group="">
                {EXAMPLES.map((example) => (
                  <li key={example.code}>
                    <div className={styles.exampleHead}>
                      <IconTile>{example.icon}</IconTile>
                      <div>
                        <h4 className={styles.exampleTitle}>{example.title}</h4>
                        <p className={styles.exampleText}>{example.text}</p>
                      </div>
                    </div>
                    <CodeBlock title="HTTP" code={example.code} scroll={false} action={<CopyButton value={example.code} label="복사" />} />
                  </li>
                ))}
              </ul>
              <p className={styles.closing}>
                즉, 스마트 컨트랙트를 직접 코드로 작성하거나 배포할 필요 없이{' '}
                <strong className={styles.em}>기존 REST API 쓰듯이 블록체인을 활용</strong>할 수 있습니다.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section tone="tint" spacing="compact" label="API 카탈로그 안내">
        <BannerRow
          title="API 카탈로그 확인하기"
          text="전체 API 목록과 주요 파라미터를 한눈에 확인하세요."
          action={
            <div className={styles.bannerActions}>
              <Button href="/developers" variant="accent">
                API 카탈로그 보기
                <ArrowRightIcon size={16} weight="bold" aria-hidden />
              </Button>
            </div>
          }
        />
      </Section>
    </>
  )
}
