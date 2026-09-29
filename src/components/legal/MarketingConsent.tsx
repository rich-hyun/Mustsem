import { LegalDocument, type LegalHeadingLevel } from './LegalMeta'
import styles from './Legal.module.css'

/** 마케팅 정보 수신 동의(선택) 안내 — 회원가입 모달 전용 */
export function MarketingConsent({ headingLevel = 'h3' }: { headingLevel?: LegalHeadingLevel }) {
  const Tag = headingLevel
  return (
    <LegalDocument compact>
      <Tag className={styles.subheading}>마케팅 정보 수신 동의 (선택)</Tag>
      <p>
        MUSTSEM의 Web3 인프라 서비스 신규 기능, 블록체인 네트워크 업데이트, 스마트컨트랙트 보안 패치, 토큰화 API 소식,
        이벤트 및 프로모션 정보를 이메일로 수신하실 수 있습니다.
      </p>
      <Tag className={styles.subheading}>수신 채널</Tag>
      <p>이메일을 통해 발송됩니다. 수신을 원하지 않으시면 언제든지 수신 거부하실 수 있습니다.</p>
      <Tag className={styles.subheading}>수신 거부</Tag>
      <p>
        마케팅 수신 동의는 선택사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다. 이후 계정 설정에서 언제든지
        변경하실 수 있습니다.
      </p>
    </LegalDocument>
  )
}
