/** 보안 센터 데이터 — 사양 요약, 구간별 보안 설계, 도입 로드맵 */

export const SECURITY_STATS = [
  { value: '256bit', label: 'AES 암호화 강도', description: 'AES 256비트 암호화' },
  { value: '3단계', label: '보안 레이어', description: '3단계 보안 레이어' },
  { value: 'FIPS 140-2', label: 'HSM 인증', description: 'HSM FIPS 140-2 인증' },
  { value: '24/7', label: '보안 모니터링', description: '연중무휴 24시간 보안 모니터링' },
]

export interface SecurityLayer {
  segment: string
  purpose: string
  method: string
  example: string
  /** 구현 예시가 코드·제품명이면 고정폭 글꼴로 */
  exampleIsCode: boolean
  note: string
}

export const SECURITY_LAYERS: SecurityLayer[] = [
  {
    segment: '클라이언트 ↔ API',
    purpose: '전송 보호',
    method: 'TLS 1.3 + 요청 서명',
    example: 'Nginx/Cloudflare + HMAC/JWT',
    exampleIsCode: true,
    note: '멱등키(Idempotency-Key)로 중복 방지',
  },
  {
    segment: 'API ↔ Vault',
    purpose: '암호화 서비스 호출',
    method: 'Vault Transit API',
    example: 'POST /v1/transit/encrypt',
    exampleIsCode: true,
    note: '서버는 키 평문 미보관',
  },
  {
    segment: 'API ↔ DB/IPFS',
    purpose: '민감데이터 보호',
    method: 'AES-256-GCM',
    example: 'Vault가 암/복호화 수행',
    exampleIsCode: false,
    note: 'IPFS는 암호문만 저장',
  },
  {
    segment: 'API ↔ HSM',
    purpose: '서명 키 보호',
    method: 'HSM 내부 서명',
    example: 'PKCS#11 / CloudHSM',
    exampleIsCode: true,
    note: '키 외부 반출 금지',
  },
  {
    segment: 'Webhook',
    purpose: '결과 위조 방지',
    method: 'HMAC-SHA256 서명',
    example: 'X-Signature 헤더',
    exampleIsCode: false,
    note: '재전송 백오프 + 멱등성',
  },
  {
    segment: '로그/백업',
    purpose: '유출 대응',
    method: '해시체인 + AES',
    example: 'WORM/S3-SSE',
    exampleIsCode: true,
    note: '감사 추적 무결성',
  },
]

export const SECURITY_ROADMAP = [
  {
    level: '기본',
    title: '전송 계층 보호 + 요청 서명',
    text: '클라이언트와 서버 간 통신 암호화 및 요청 무결성 검증',
    tags: ['TLS 1.3', 'HMAC', 'Idempotency-Key', 'JWT'],
  },
  {
    level: '강화',
    title: 'AES 암호문 저장/조회',
    text: '민감 데이터 암호화 저장 및 Vault 기반 키 관리',
    tags: ['Vault Transit', 'AES-256-GCM', 'Zero Knowledge'],
  },
  {
    level: '고급',
    title: '개인키 외부 반출 금지',
    text: 'HSM 기반 서명으로 개인키 노출 위험 완전 차단',
    tags: ['HSM 서명', 'PKCS#11', 'CloudHSM'],
  },
  {
    level: '완성',
    title: 'Webhook/로그 무결성',
    text: '감사 로그 위변조 방지 및 결과 알림 보안',
    tags: ['HMAC 서명', '해시체인', 'WORM Storage'],
  },
]
