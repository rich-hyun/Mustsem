import { SITE } from '@/config/site'
import {
  LegalContact,
  LegalDocument,
  LegalHeading,
  LegalMeta,
  LegalTable,
  type LegalContentProps,
} from './LegalMeta'

/** 개인정보처리방침 원문 — /privacy 페이지와 회원가입 모달이 함께 쓴다 */
export function PrivacyContent({ headingLevel = 'h2', compact }: LegalContentProps) {
  return (
    <LegalDocument compact={compact}>
      <LegalMeta />

      <p>
        머스트셈 네트워크(이하 &quot;회사&quot;)는 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하고
        이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <LegalHeading level={headingLevel}>1. 수집하는 개인정보의 항목 및 수집 방법</LegalHeading>
      <p>회사는 서비스 제공을 위해 필요한 최소한의 개인정보를 수집합니다.</p>
      <LegalTable
        caption="수집하는 개인정보의 항목 및 수집 방법"
        head={['구분', '수집 항목', '수집 방법']}
        rows={[
          ['회원가입 (이메일)', '이메일 주소, 비밀번호, 이름(또는 닉네임)', '회원가입 양식 입력'],
          [
            '회원가입 (Google 계정 로그인)',
            '이메일 주소, 이름, 프로필 사진(선택)',
            'Google OAuth 2.0 인증 시 이용자의 동의를 거쳐 Google로부터 제공',
          ],
          [
            '서비스 이용 과정',
            '접속 IP, 브라우저 정보, 접속 일시, 서비스 이용 기록(API 호출 로그 등)',
            '서비스 이용 시 자동 생성·수집',
          ],
        ]}
      />

      <LegalHeading level={headingLevel}>2. 개인정보의 수집 및 이용 목적</LegalHeading>
      <ul>
        <li>회원 가입 의사 확인, 본인 식별·인증 및 회원 자격 유지·관리</li>
        <li>Web3 및 토큰화 API 서비스의 제공, 대시보드 이용 환경 제공</li>
        <li>서비스 관련 공지사항 전달 및 문의 사항 처리</li>
        <li>서비스의 안정성 확보, 부정 이용 방지 및 보안 관리</li>
        <li>서비스 이용 통계 분석을 통한 품질 개선</li>
      </ul>

      <LegalHeading level={headingLevel}>3. Google 사용자 데이터의 처리</LegalHeading>
      <p>
        이용자가 Google 계정으로 로그인하는 경우, 회사는 Google로부터 이메일 주소, 이름, 프로필 사진 정보만을 제공받으며
        이를 계정 생성 및 로그인 인증 목적으로만 사용합니다.
      </p>
      <ul>
        <li>Google로부터 제공받은 정보는 제3자에게 판매·양도하지 않습니다.</li>
        <li>광고 목적으로 사용하지 않습니다.</li>
        <li>
          회사의 Google API로부터 받은 정보의 이용 및 전송은{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API 서비스 사용자 데이터 정책
          </a>
          (제한적 사용 요구사항 포함)을 준수합니다.
        </li>
      </ul>

      <LegalHeading level={headingLevel}>4. 개인정보의 보유 및 이용 기간</LegalHeading>
      <p>
        회사는 원칙적으로 개인정보의 수집·이용 목적이 달성되면 지체 없이 해당 정보를 파기합니다. 다만, 다음의 경우에는
        명시한 기간 동안 보존합니다.
      </p>
      <LegalTable
        caption="개인정보의 보유 및 이용 기간"
        head={['보존 항목', '보존 기간', '근거']}
        rows={[
          ['회원 정보', '회원 탈퇴 시까지', '서비스 제공'],
          ['접속 기록(로그)', '3개월', '통신비밀보호법'],
          ['소비자 불만 또는 분쟁 처리 기록', '3년', '전자상거래법'],
        ]}
      />

      <LegalHeading level={headingLevel}>5. 개인정보의 제3자 제공</LegalHeading>
      <p>
        회사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 이용자가 사전에 동의한 경우 또는 법령에 근거하여
        수사기관 등이 적법한 절차에 따라 요청한 경우는 예외로 합니다.
      </p>

      <LegalHeading level={headingLevel}>6. 개인정보 처리의 위탁</LegalHeading>
      <p>회사는 안정적인 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁할 수 있습니다.</p>
      <LegalTable
        caption="개인정보 처리의 위탁"
        head={['수탁자', '위탁 업무']}
        rows={[
          ['Vercel Inc.', '웹 서비스 호스팅 및 인프라 운영'],
          ['Google LLC', '소셜 로그인(OAuth 2.0) 인증 처리'],
        ]}
      />

      <LegalHeading level={headingLevel}>7. 이용자의 권리와 행사 방법</LegalHeading>
      <p>
        이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요구할 수 있습니다. 권리 행사는 아래
        문의처를 통해 서면, 이메일 등으로 요청할 수 있으며, 회사는 지체 없이 조치합니다. 회원 탈퇴 시 수집된 개인정보는 즉시
        파기됩니다.
      </p>

      <LegalHeading level={headingLevel}>8. 개인정보의 파기 절차 및 방법</LegalHeading>
      <ul>
        <li>전자적 파일 형태: 복구할 수 없는 기술적 방법으로 영구 삭제</li>
        <li>종이 문서: 분쇄 또는 소각</li>
      </ul>

      <LegalHeading level={headingLevel}>9. 개인정보의 안전성 확보 조치</LegalHeading>
      <ul>
        <li>비밀번호 및 주요 정보의 암호화 저장 (AES-256 등)</li>
        <li>전송 구간 암호화 (TLS/HTTPS)</li>
        <li>접근 권한의 최소화 및 접근 통제 (RBAC)</li>
        <li>접속 기록의 보관 및 위·변조 방지</li>
      </ul>

      <LegalHeading level={headingLevel}>10. 쿠키의 사용</LegalHeading>
      <p>
        회사는 로그인 세션 유지 등 서비스 제공에 필요한 최소한의 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키
        저장을 거부할 수 있으나, 이 경우 로그인이 필요한 서비스 이용에 제한이 있을 수 있습니다.
      </p>

      <LegalHeading level={headingLevel}>11. 개인정보 보호책임자 및 문의처</LegalHeading>
      <LegalContact>
        <p>
          <strong>개인정보 보호책임자</strong>머스트셈 네트워크 운영팀
        </p>
        <p>
          <strong>이메일</strong>
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </p>
        <p>
          기타 개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118)에 문의할 수
          있습니다.
        </p>
      </LegalContact>

      <LegalHeading level={headingLevel}>12. 개인정보처리방침의 변경</LegalHeading>
      <p>
        이 개인정보처리방침은 2026년 7월 6일부터 적용됩니다. 법령·정책 또는 서비스의 변경에 따라 내용이 추가, 삭제 및
        수정될 수 있으며, 변경 시 시행 7일 전부터 본 페이지를 통해 공지합니다.
      </p>
    </LegalDocument>
  )
}
