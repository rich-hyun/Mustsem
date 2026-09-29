/**
 * API 카탈로그 데이터 — 제공 이력(산업별 구축 사례)과 제공 가능한 API 목록.
 * 아이콘은 화면 쪽에서 id로 연결한다.
 */

export const CATALOG_STATS = [
  { value: '40+', label: '제공 API 수', description: '40개 이상의 API 제공' },
  { value: '8', label: '산업 분야', description: '8개 산업 분야' },
  { value: '15+', label: '구축 사례', description: '15건 이상의 구축 사례' },
  { value: '99.9%', label: '가동률', description: '가동률 99.9퍼센트' },
]

export type IndustryId = 'beauty' | 'health' | 'manufacturing' | 'fashion' | 'kpop' | 'food' | 'finance' | 'event'

export interface IndustryCase {
  title: string
  /** YYYY.MM */
  date: string
  description: string
}

export interface Industry {
  id: IndustryId
  name: string
  cases: IndustryCase[]
}

export const INDUSTRIES: Industry[] = [
  {
    id: 'beauty',
    name: '뷰티테크',
    cases: [
      {
        title: '시술 이미지 분석 AI',
        date: '2025.09',
        description: '고객 스타일·컬러 MyData 추출·표준화, NFT 기반 시술 경험 자산화, 시술권/리워드 발행 인프라 구축',
      },
      {
        title: '얼굴형·두상 분석 AI',
        date: '2025.08',
        description: '맞춤 가발 추천 알고리즘 API, SBT 기반 스타일 이력 관리, NFT 리워드 구조 설계',
      },
      {
        title: '피부진단 AI',
        date: '2024.11',
        description: '주름·모공·잡티 분석, 추천 API, SBT 기반 피부 이력 관리, NFT 리워드 인프라 구축',
      },
    ],
  },
  {
    id: 'health',
    name: '디지털 헬스케어',
    cases: [
      {
        title: '심리·체력 통합 코칭',
        date: '2025.10',
        description: 'SBT 구조 설계, 코칭 프로그램 리워드 시스템, 자격증·성과 이력 SBT 발급 시스템 구축',
      },
      {
        title: '체성분 분석 AI',
        date: '2024.10',
        description: '위험 신호 탐지, 건강 데이터 연계 블록체인 구조, NFT 건강 미션 시스템 구축',
      },
      {
        title: '운동 자세·체형 분석 AI',
        date: '2024.01',
        description: '운동 기록 NFT 발급, 지속도 기반 리워드 시스템 설계',
      },
    ],
  },
  {
    id: 'manufacturing',
    name: '스마트제조',
    cases: [
      {
        title: '경량 공정 자동화',
        date: '2025.05',
        description: 'AI·로봇 기반 공정 자동화, 데이터 수집·진단, 블록체인 기반 공정 이력·품질 추적',
      },
      {
        title: '차량 외판 손상 감지 AI',
        date: '2025.02',
        description: '로봇 스캔 분석 엔진, IPFS 기반 정비·견적 데이터 무결성 보증 인프라',
      },
    ],
  },
  {
    id: 'fashion',
    name: '패션테크',
    cases: [
      {
        title: '체형·핏 분석 AI',
        date: '2025.10',
        description: '의류 이미지 기반 체형·치수 분석, NFT 등급제·포인트 리워드, 동대문 백오피스 구축',
      },
      {
        title: '3D 정장 자동측정 AI',
        date: '2024.01',
        description: '신체 치수 자동측정, SBT 기반 정장 대여·착용 이력 관리, NFT 리워드 제공',
      },
    ],
  },
  {
    id: 'kpop',
    name: 'K-POP 산업',
    cases: [
      {
        title: '음원 온체인 NFT',
        date: '2025.08',
        description: 'K-POP 영상·음원 NFT 구조 설계, 저작권·수익 배분 스마트컨트랙트, 글로벌 P2P NFT 마켓',
      },
    ],
  },
  {
    id: 'food',
    name: '푸드테크',
    cases: [
      {
        title: '맞춤형 건강식 AI',
        date: '2025.08',
        description: '건강·질환·복용 정보 SBT 저장, 맞춤형 건강식 추천 AI, FitTable 주문·배송·수익분배',
      },
    ],
  },
  {
    id: 'finance',
    name: '금융권',
    cases: [
      {
        title: 'IP 가치 평가서',
        date: '2026.06',
        description: 'IP 가치 평가서 자동 생성 API, 평가 지표·시장 가격 분석, 무결성 검증 보고서 발행',
      },
      {
        title: 'IP 담보대출',
        date: '2025.10',
        description: 'IP 담보 기반 대출 심사 API, 지식재산권 평가·담보 관리, 대출 한도 자동 산정',
      },
    ],
  },
  {
    id: 'event',
    name: '이벤트 산업',
    cases: [
      {
        title: '가족 촬영 NFT',
        date: '2025.09',
        description: '가족·자녀 촬영 사진 NFT 발행, 등급제 멤버십·리워드, 초상권 암호화 딥페이크 방지',
      },
    ],
  },
]

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiEndpoint {
  name: string
  description: string
  method: HttpMethod
  path: string
  params: string[]
}

export type ApiGroupId = 'nft' | 'sbt' | 'rwa' | 'token' | 'governance' | 'node'

export interface ApiGroup {
  id: ApiGroupId
  /** 표 제목 */
  title: string
  /** 필터 칩에 쓰는 짧은 이름 */
  short: string
  description: string
  endpoints: ApiEndpoint[]
}

export const API_GROUPS: ApiGroup[] = [
  {
    id: 'nft',
    title: 'NFT API',
    short: 'NFT',
    description: '디지털 자산 발행, 전송, 소각 및 메타데이터 관리',
    endpoints: [
      { name: 'NFT 발행', description: '메타데이터와 정책 기반 발행', method: 'POST', path: '/v1/nfts/mint', params: ['contract', 'to', 'metadataURI'] },
      { name: 'NFT 전송', description: '보유자 간 NFT 전송', method: 'POST', path: '/v1/nfts/transfer', params: ['contract', 'tokenId', 'from', 'to'] },
      { name: 'NFT 소각', description: '영구 소각', method: 'POST', path: '/v1/nfts/burn', params: ['contract', 'tokenId'] },
      { name: '메타데이터 업데이트', description: '온체인/오프체인 수정', method: 'PUT', path: '/v1/nfts/metadata', params: ['contract', 'tokenId', 'metadataURI'] },
      { name: 'NFT 조회', description: '소유자별/단일 토큰 조회', method: 'GET', path: '/v1/nfts', params: ['owner', 'tokenId'] },
      { name: '컬렉션 등록', description: '프로젝트 초기 등록', method: 'POST', path: '/v1/nfts/collection', params: ['name', 'symbol', 'baseURI'] },
      { name: '화이트리스트 민팅', description: '사전 허용 사용자만 민팅', method: 'POST', path: '/v1/nfts/mint-whitelist', params: ['contract', 'whitelistProof'] },
    ],
  },
  {
    id: 'sbt',
    title: 'SBT API',
    short: 'SBT',
    description: '양도 불가능한 자격증명 토큰 발행 및 검증',
    endpoints: [
      { name: 'SBT 발행', description: '양도 불가 토큰 발행', method: 'POST', path: '/v1/sbts/mint', params: ['contract', 'to', 'metadataURI'] },
      { name: 'SBT 폐기', description: '만료/철회 시 회수', method: 'POST', path: '/v1/sbts/revoke', params: ['contract', 'tokenId'] },
      { name: 'SBT 검증', description: '보유/유효성 체크', method: 'GET', path: '/v1/sbts/verify', params: ['contract', 'holder'] },
      { name: '메타데이터 갱신', description: '온체인 상태 갱신', method: 'PUT', path: '/v1/sbts/metadata', params: ['contract', 'tokenId'] },
    ],
  },
  {
    id: 'rwa',
    title: 'RWA API',
    short: 'RWA',
    description: '실물자산 토큰화, 평가, 담보 관리',
    endpoints: [
      { name: 'RWA 발행', description: '실물자산 기반 토큰 발행', method: 'POST', path: '/v1/rwa/mint', params: ['contract', 'to', 'complianceRef'] },
      { name: '평가 업데이트', description: '실물자산 평가가치 변경', method: 'PUT', path: '/v1/rwa/valuation', params: ['contract', 'tokenId', 'newValue'] },
      { name: '담보 설정', description: '대출 등을 위한 담보 등록', method: 'POST', path: '/v1/rwa/collateralize', params: ['contract', 'tokenId', 'loanId'] },
      { name: '담보 해제', description: '담보 해제 처리', method: 'POST', path: '/v1/rwa/uncollateralize', params: ['contract', 'tokenId'] },
      { name: '거래(양도)', description: 'RWA 소유권 이전', method: 'POST', path: '/v1/rwa/transfer', params: ['contract', 'from', 'to'] },
      { name: '인증서 조회', description: '감정/문서 등 연계 자료 조회', method: 'GET', path: '/v1/rwa/certificate', params: ['contract', 'tokenId'] },
    ],
  },
  {
    id: 'token',
    title: '토큰 정책 및 거래 API',
    short: '토큰 정책·거래',
    description: '토큰 정책, 스왑, 브릿지, 분할 발행',
    endpoints: [
      { name: '예약 소각', description: '특정 시간 이후 자동 소각', method: 'POST', path: '/v1/tokens/burn-scheduled', params: ['contract', 'tokenId', 'burnAt'] },
      { name: '수수료 정책', description: '트랜잭션별 정책 등록', method: 'POST', path: '/v1/policies/fees', params: ['contract', 'feeBps', 'feeCollector'] },
      { name: '거래 제한', description: '주소/국가/시간 기반 제한', method: 'POST', path: '/v1/policies/transfer-restriction', params: ['contract', 'ruleType', 'value'] },
      { name: '분할 토큰 생성', description: 'NFT → ERC20 분할 발행', method: 'POST', path: '/v1/tokens/fractionalize', params: ['nftContract', 'tokenId', 'parts'] },
      { name: '토큰 스왑', description: 'Token-to-token 교환', method: 'POST', path: '/v1/swaps/execute', params: ['fromToken', 'toToken', 'amount'] },
      { name: '브릿지', description: '체인 간 자산 이동', method: 'POST', path: '/v1/bridge/transfers', params: ['sourceChain', 'targetChain', 'token'] },
      { name: '토큰 상태 조회', description: '발행/소각/유통량', method: 'GET', path: '/v1/tokens/status', params: ['contract'] },
    ],
  },
  {
    id: 'governance',
    title: '거버넌스 및 권한 관리 API',
    short: '거버넌스·권한',
    description: '온체인 제안, 투표, 위임 및 테넌트 관리',
    endpoints: [
      { name: '제안 생성', description: '온체인 제안 제출', method: 'POST', path: '/v1/governance/proposals', params: ['title', 'description', 'actions'] },
      { name: '투표', description: '토큰 보유자 투표', method: 'POST', path: '/v1/governance/vote', params: ['proposalId', 'voter', 'support'] },
      { name: '거버넌스 실행', description: '투표 종료 후 실행', method: 'POST', path: '/v1/governance/execute', params: ['proposalId'] },
      { name: '위임', description: '투표권 위임', method: 'POST', path: '/v1/governance/delegate', params: ['from', 'to'] },
      { name: '테넌트 등록', description: '조직별 서명 정책 등록', method: 'POST', path: '/v1/tenants/register', params: ['tenantId', 'adminWallet'] },
    ],
  },
  {
    id: 'node',
    title: '분석 및 체인 운영 API',
    short: '분석·체인 운영',
    description: '트랜잭션 로그, 모니터링, 노드 관리',
    endpoints: [
      { name: '트랜잭션 로그', description: 'API 요청/응답 감사 로그', method: 'GET', path: '/v1/logs/transactions', params: ['tenant', 'fromDate', 'toDate'] },
      { name: '체인 상태 모니터링', description: '블록/노드/TPS/가스', method: 'GET', path: '/v1/chain/status', params: ['chainId'] },
      { name: '노드 등록', description: '검증자 노드 추가', method: 'POST', path: '/v1/nodes/register', params: ['nodeAddress', 'role'] },
      { name: '노드 스테이킹', description: '검증자 토큰 예치', method: 'POST', path: '/v1/nodes/stake', params: ['validator', 'amount'] },
    ],
  },
]
