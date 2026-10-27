import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { AnomalyMonitor } from './AnomalyMonitor'
import { ApplyForm } from './ApplyForm'
import { NetworkDirectory } from './NetworkDirectory'
import styles from './network.module.css'

export const metadata: Metadata = {
  title: '전용 네트워크',
  description: 'MST 코인을 담보로 기업 전용 블록체인 네트워크를 자동 개설하고, 온체인 이상거래 탐지를 함께 적용하는 페이지입니다.',
  alternates: { canonical: '/network' },
}

const FLOW = [
  { name: '정보 입력', text: '회사명, 네트워크명, 심볼, 예치할 MST 수량과 구성 옵션을 입력합니다.' },
  { name: '사양 자동 생성', text: '체인 ID 할당, 발행량 계산, 제네시스 설정이 자동으로 만들어집니다.' },
  { name: '단계별 자동 개설', text: '담보 락업 확인, 검증자 노드 배포, RPC 개설, 이상탐지 적용 순으로 진행됩니다.' },
]

export default function NetworkPage() {
  return (
    <>
      <PageHero
        visual="infra"
        eyebrow="네트워크"
        title={
          <>
            정보만 입력하면{' '}
            <br />
            전용 네트워크가 자동 개설됩니다
          </>
        }
        lead="MST 담보 예치부터 체인 ID 할당, 제네시스 생성, 검증자 노드 배포, RPC 개설까지 한 번에 진행하고 이상거래 탐지를 함께 적용합니다."
      />

      <Section id="apply" tone="tint" labelledBy="apply-title">
        <div className={styles.layout}>
          <Card elevation="raised" padding="lg" feature>
            <h2 id="apply-title" className={styles.formTitle}>
              네트워크 자동 개설
            </h2>
            <p id="apply-lead" className={styles.formLead}>
              아래 정보를 입력하고 개설을 누르면 <strong>체인 사양이 자동으로 생성</strong>되고 단계별로 네트워크가 구성됩니다.
            </p>
            <ApplyForm />
          </Card>

          <div className={styles.side} data-reveal-group="">
            <Card>
              <h3 className={styles.sideTitle}>개설 절차</h3>
              <ol className={styles.timeline}>
                {FLOW.map((step) => (
                  <li key={step.name}>
                    <span>
                      <span className={styles.stepName}>{step.name}</span>
                      <span className={styles.stepText}>{step.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card>
              <h3 className={styles.sideTitle}>서비스 개요</h3>
              <ul className={styles.bullets}>
                <li>
                  예치된 MST를 담보로 <strong>1:1000 비율</strong> 네이티브 코인 발행
                </li>
                <li>GT(거버넌스 토큰)는 원하는 경우 추가 발행 가능</li>
                <li>모든 수수료 및 확장 비용은 MST로 결제</li>
                <li>고위험 거래는 지갑 동결과 블랙리스트 등록으로 자동 대응</li>
              </ul>
            </Card>
            <Card>
              <h3 className={styles.sideTitle}>정책</h3>
              <ul className={styles.bullets}>
                <li>
                  <strong>글로벌 담보정책</strong>: 무담보 발행 없음
                </li>
                <li>다운사이드 감액 금지 (Non-Decreasing Collateral)</li>
                <li>락업된 MST는 네트워크 운영 기간 동안 담보 유지</li>
              </ul>
            </Card>
          </div>
        </div>
      </Section>

      <Section tone="white" id="anomaly" labelledBy="anomaly-title">
        <SectionHeading
          id="anomaly-title"
          title="온체인 이상거래 탐지"
          lead="거래마다 위험도를 0~100으로 산출해 정상, 경고, 고위험 구간으로 나누고, 고위험 거래는 정책에 따라 자동 대응합니다. 아래는 가상 거래로 동작을 확인하는 시연 화면이며 실제 체인 데이터가 아닙니다."
        />
        <AnomalyMonitor />
      </Section>

      <Section tone="tint" labelledBy="directory-title">
        <SectionHeading
          id="directory-title"
          title="지원 네트워크"
          lead="MUSTSEM이 운영하는 EVM 호환 네트워크입니다. 체인 정보를 지갑에 바로 등록할 수 있습니다."
        />
        <NetworkDirectory />
      </Section>
    </>
  )
}
