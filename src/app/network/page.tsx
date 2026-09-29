import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { PageHero } from '@/components/ui/PageHero'
import { Section, SectionHeading } from '@/components/ui/Section'
import { ApplyForm } from './ApplyForm'
import { NetworkDirectory } from './NetworkDirectory'
import styles from './network.module.css'

export const metadata: Metadata = {
  title: '전용 네트워크',
  description: 'MST 코인을 담보로 기업 전용 블록체인 네트워크 개설을 신청하는 페이지입니다.',
  alternates: { canonical: '/network' },
}

const FLOW = [
  { name: '신청 정보 입력', text: '회사명, 연락처, 예치할 MST 수량을 남겨 주세요.' },
  { name: '내부 확인', text: '담보 조건과 요청사항을 확인하고 구성을 정리합니다.' },
  { name: '24시간 내 개설', text: '확인 후 24시간 이내에 네트워크를 개설해 안내드립니다.' },
]

export default function NetworkPage() {
  return (
    <>
      <PageHero
        visual="infra"
        eyebrow="네트워크"
        title={
          <>
            귀사 전용 네트워크를{' '}
            <br />
            최대 24시간 내 개설합니다
          </>
        }
        lead="MST 코인을 담보로 귀사 전용 네트워크를 개설합니다."
      />

      <Section id="apply" tone="tint" labelledBy="apply-title">
        <div className={styles.layout}>
          <Card elevation="raised" padding="lg" feature>
            <h2 id="apply-title" className={styles.formTitle}>
              네트워크 생성 신청
            </h2>
            <p id="apply-lead" className={styles.formLead}>
              아래 정보를 입력하시면 내부 확인 후 <strong>24시간 이내</strong> 생성이 진행됩니다.
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
                <li>신청 후 24시간 이내 생성 완료</li>
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

      <Section tone="white" labelledBy="directory-title">
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
