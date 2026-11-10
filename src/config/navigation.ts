/**
 * 헤더·모바일 메뉴·푸터가 함께 쓰는 사이트 구조.
 * 아이콘은 문자열 키로만 둔다 — 이 모듈은 서버 컴포넌트(푸터)에서도 불리므로
 * 클라이언트 전용 아이콘 컴포넌트를 여기서 import하지 않는다.
 */
export type NavIconKey =
  | 'network'
  | 'bridge'
  | 'staking'
  | 'nft'
  | 'sbt'
  | 'rwa'
  | 'ipfs'
  | 'agent'
  | 'anomaly'
  | 'catalog'
  | 'guide'
  | 'dashboard'

export interface NavLink {
  href: string
  label: string
  description: string
  icon: NavIconKey
}

export interface NavGroup {
  title: string
  links: NavLink[]
}

/**
 * 올인원 구성: 구축(Build) · 운영(Operate) · 보호(Protect). 홈의 올인원 구획(src/content/home.ts PILLARS)과 같은 묶음이다.
 */
export const PRODUCT_GROUPS: NavGroup[] = [
  {
    title: '구축 (Build)',
    links: [
      { href: '/network', label: '전용 네트워크', description: 'MST 담보로 기업 전용 체인 개설', icon: 'network' },
      { href: '/nft', label: 'NFT', description: '디지털 자산 발행과 소유권 관리', icon: 'nft' },
      { href: '/sbt', label: 'SBT', description: '양도할 수 없는 자격·인증 토큰', icon: 'sbt' },
      { href: '/rwa', label: 'RWA', description: '실물자산 정보의 등록과 토큰화', icon: 'rwa' },
    ],
  },
  {
    title: '운영 (Operate)',
    links: [
      { href: '/agent', label: 'Biz-Ops 에이전트', description: '지원사업 준비와 운영 질의응답 AI', icon: 'agent' },
      { href: '/bridge', label: '브릿지', description: '네트워크 간 자산 이동과 래핑', icon: 'bridge' },
      { href: '/staking', label: '스테이킹', description: 'wMST 예치와 MST 보상', icon: 'staking' },
    ],
  },
  {
    title: '보호 (Protect)',
    links: [
      { href: '/network#anomaly', label: '이상거래 탐지', description: '실제 체인 거래의 위험도 분석과 대응', icon: 'anomaly' },
      { href: '/ipfs', label: 'IPFS 보안 등록', description: 'AI 모델 분산 저장과 무결성 검증', icon: 'ipfs' },
    ],
  },
]

export const DEVELOPER_LINKS: NavLink[] = [
  { href: '/developers', label: 'API 카탈로그', description: '제공 API와 구축 사례', icon: 'catalog' },
  { href: '/developers/guide', label: 'API 가이드', description: '호출 방식과 동작 흐름', icon: 'guide' },
  { href: '/dashboard', label: '대시보드', description: '운영 지갑 잔액 모니터링', icon: 'dashboard' },
]

export const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: '플랫폼',
    links: PRODUCT_GROUPS.flatMap((group) => group.links).map(({ href, label }) => ({ href, label })),
  },
  {
    title: '개발자',
    links: DEVELOPER_LINKS.map(({ href, label }) => ({ href, label })),
  },
  {
    title: '회사',
    links: [
      { href: '/security', label: '보안' },
      { href: '/network#apply', label: '도입 상담' },
      { href: '/privacy', label: '개인정보처리방침' },
      { href: '/terms', label: '이용약관' },
    ],
  },
]

/**
 * 현재 경로가 링크 대상과 같은지 (끝 슬래시 무시).
 * /developers와 /developers/guide처럼 형제 메뉴가 있으므로 하위 경로는 활성으로 보지 않는다.
 * 페이지 안 구획(#)을 가리키는 링크는 활성으로 보지 않는다 (같은 페이지의 메뉴 둘이 함께 켜지지 않게).
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href.includes('#')) return false
  const normalize = (value: string) => (value.length > 1 ? value.replace(/\/+$/, '') : value)
  return normalize(pathname) === normalize(href)
}
