/**
 * API 카탈로그 데이터 — 제공 이력(산업별 구축 사례)과 제공 가능한 API 목록.
 * 아이콘은 화면 쪽에서 id로 연결한다.
 */

export const CATALOG_STATS = [
  { value: '50', label: '제공 API 수', description: '10개 분야 50종의 API 제공' },
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

/** "호출해 보기" 입력 칸. value는 처음 채워 두는 예시 값 */
export interface TryField {
  name: string
  value: string
  hint?: string
}

export interface ApiEndpoint {
  name: string
  description: string
  method: HttpMethod
  path: string
  params: string[]
  /** 2026년 확장분(33종 → 50종) */
  isNew?: boolean
  /**
   * 이 사이트 서버(/api + path)에서 바로 호출해 볼 수 있는 조회 API. 체인을 읽기만 하고 서명 키가 필요 없다.
   * 처리 코드는 src/server/gateway/handlers.ts
   */
  tryIt?: TryField[]
}

export type ApiGroupId = 'nft' | 'sbt' | 'rwa' | 'token' | 'governance' | 'node' | 'oracle' | 'bridge' | 'did' | 'composite'

/** 호출해 보기의 기본 네트워크 (지금 RPC가 응답하는 Mustsem 메인넷) */
const CHAIN: TryField = { name: 'chainId', value: '7601', hint: '네트워크 체인 ID' }

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
      { name: 'NFT 조회', description: '소유자별/단일 토큰 조회', method: 'GET', path: '/v1/nfts', params: ['owner', 'tokenId'], tryIt: [CHAIN, { name: 'contract', value: '', hint: '비우면 해당 네트워크의 기본 NFT 컨트랙트' }, { name: 'tokenId', value: '1' }, { name: 'owner', value: '', hint: '보유 수량을 볼 지갑 주소 (선택)' }] },
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
      { name: 'SBT 검증', description: '보유/유효성 체크', method: 'GET', path: '/v1/sbts/verify', params: ['contract', 'holder'], tryIt: [CHAIN, { name: 'contract', value: '', hint: '비우면 해당 네트워크의 기본 SBT 컨트랙트' }, { name: 'holder', value: '', hint: '확인할 지갑 주소' }, { name: 'tokenId', value: '', hint: '특정 토큰만 확인 (선택)' }] },
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
      { name: '인증서 조회', description: '감정/문서 등 연계 자료 조회', method: 'GET', path: '/v1/rwa/certificate', params: ['contract', 'tokenId'], tryIt: [CHAIN, { name: 'contract', value: '', hint: '비우면 해당 네트워크의 기본 RWA 컨트랙트' }, { name: 'tokenId', value: '1' }] },
      { name: '수익 분배', description: '지분 보유자에게 수익을 지분율대로 분배', method: 'POST', path: '/v1/rwa/distribute', params: ['vault', 'amount'], isNew: true },
      { name: '지분 보유 조회', description: '보유 지분, 지분율, 받을 수익 조회', method: 'GET', path: '/v1/rwa/holders', params: ['vault', 'holder'], isNew: true, tryIt: [CHAIN, { name: 'vault', value: '', hint: 'RWA 지분 토큰(RWAVault) 주소' }, { name: 'holder', value: '', hint: '보유자 지갑 주소' }] },
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
      { name: '토큰 상태 조회', description: '발행/소각/유통량', method: 'GET', path: '/v1/tokens/status', params: ['contract'], tryIt: [CHAIN, { name: 'contract', value: '0x2affeb7a958851645092cce8de9d2dbc88f2adf1', hint: '토큰 컨트랙트 주소' }] },
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
      { name: '체인 상태 모니터링', description: '블록/노드/TPS/가스', method: 'GET', path: '/v1/chain/status', params: ['chainId'], tryIt: [CHAIN] },
      { name: '노드 등록', description: '검증자 노드 추가', method: 'POST', path: '/v1/nodes/register', params: ['nodeAddress', 'role'] },
      { name: '노드 스테이킹', description: '검증자 토큰 예치', method: 'POST', path: '/v1/nodes/stake', params: ['validator', 'amount'] },
    ],
  },
  {
    id: 'oracle',
    title: '오라클 가격 피드 API',
    short: '오라클',
    description: '외부 시세를 온체인에 올리고 컨트랙트와 서비스가 같은 가격을 읽는다',
    endpoints: [
      { name: '최신 가격 조회', description: '피드의 최신 가격과 갱신 시각', method: 'GET', path: '/v1/oracle/prices', params: ['pair'], isNew: true, tryIt: [CHAIN, { name: 'pair', value: 'BTC/USD', hint: '예: BTC/USD, QQQ/USD' }] },
      { name: '가격 이력 조회', description: '라운드별 과거 가격', method: 'GET', path: '/v1/oracle/prices/history', params: ['pair', 'roundId'], isNew: true, tryIt: [CHAIN, { name: 'pair', value: 'BTC/USD' }, { name: 'roundId', value: '1' }] },
      { name: '가격 피드 등록', description: '거래쌍, 소수 자릿수, 갱신 주기 등록', method: 'POST', path: '/v1/oracle/feeds', params: ['pair', 'decimals', 'heartbeat'], isNew: true },
      { name: '가격 제출', description: '허가된 리포터의 가격 기록', method: 'POST', path: '/v1/oracle/prices', params: ['pair', 'price', 'observedAt'], isNew: true },
    ],
  },
  {
    id: 'bridge',
    title: '크로스체인 브릿지 API',
    short: '크로스체인',
    description: '체인 간 전송 경로, 진행 상태, 수령과 환불',
    endpoints: [
      { name: '전송 상태 조회', description: '잠금, 수령, 환불 진행 상태', method: 'GET', path: '/v1/bridge/transfers/status', params: ['transferId'], isNew: true, tryIt: [CHAIN, { name: 'transferId', value: '', hint: '전송 요청 때 받은 ID (0x로 시작하는 64자리)' }] },
      { name: '지원 경로 조회', description: '체인·토큰별 경로, 수수료, 한도', method: 'GET', path: '/v1/bridge/routes', params: ['sourceChain', 'targetChain', 'token'], isNew: true, tryIt: [] },
      { name: '도착 체인 수령', description: '릴레이어 서명으로 도착 체인에서 수령', method: 'POST', path: '/v1/bridge/claim', params: ['transferId', 'recipient', 'signatures'], isNew: true },
      { name: '전송 환불', description: '처리 불가 건을 출발 체인에서 환불', method: 'POST', path: '/v1/bridge/refund', params: ['transferId', 'signatures'], isNew: true },
    ],
  },
  {
    id: 'did',
    title: 'DID 신원인증 API',
    short: 'DID',
    description: '분산 신원(DID) 등록과 자격증명 발급, 검증, 폐기',
    endpoints: [
      { name: 'DID 등록', description: '신원 식별자와 문서 주소 등록', method: 'POST', path: '/v1/did/register', params: ['did', 'documentURI'], isNew: true },
      { name: 'DID 조회', description: '컨트롤러, 문서 주소, 활성 여부', method: 'GET', path: '/v1/did/resolve', params: ['did'], isNew: true, tryIt: [CHAIN, { name: 'did', value: 'did:mst:mustsem', hint: 'DID 문자열 (예: 머스트셈 회사 DID)' }] },
      { name: '자격증명 발급', description: '자격증명 해시를 온체인에 기록', method: 'POST', path: '/v1/did/credentials/issue', params: ['issuer', 'subject', 'credentialHash'], isNew: true },
      { name: '자격증명 검증', description: '발급, 만료, 폐기 여부 확인', method: 'GET', path: '/v1/did/credentials/verify', params: ['credentialHash'], isNew: true, tryIt: [CHAIN, { name: 'credentialHash', value: '0xc3b05b8627199f49fbfea364951eae3a9e2d41a2b9f410ed061018d7f718f867', hint: '자격증명 해시 (예시는 시연용 자격증명)' }] },
      { name: '자격증명 폐기', description: '발급자가 자격증명을 무효화', method: 'POST', path: '/v1/did/credentials/revoke', params: ['credentialHash'], isNew: true },
    ],
  },
  {
    id: 'composite',
    title: '복합 컨트랙트 API',
    short: '복합 실행',
    description: '여러 컨트랙트 호출을 한 트랜잭션으로 묶어 실행',
    endpoints: [
      { name: '복합 실행', description: '여러 호출을 한 번에, 하나라도 실패하면 전부 취소', method: 'POST', path: '/v1/composite/execute', params: ['calls', 'atomic'], isNew: true },
      { name: '실행 시뮬레이션', description: '실행 전에 호출별 결과 미리 확인', method: 'POST', path: '/v1/composite/simulate', params: ['calls'], isNew: true },
    ],
  },
]

/** 전체 API 수와 확장분 수 (화면 문구와 점검에 쓴다) */
export const API_TOTAL = API_GROUPS.reduce((sum, group) => sum + group.endpoints.length, 0)
export const API_NEW_TOTAL = API_GROUPS.reduce((sum, group) => sum + group.endpoints.filter((endpoint) => endpoint.isNew).length, 0)
