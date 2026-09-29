import type { NavIconKey } from '@/config/navigation'
import type { FaqItem } from '@/components/marketing/Faq'

export const START_PATHS = [
  {
    href: '/network',
    image: '/images/hero-infra.webp',
    category: '독립적인 인프라가 필요하다면',
    title: '기업 전용 네트워크',
    text: '기업별 전용 체인과 운영 정책으로 우리 서비스의 기반을 구축하세요.',
    flow: ['신청', '내부 확인', '24시간 내 개설'],
    action: '네트워크 알아보기',
  },
  {
    href: '/developers',
    image: '/images/hero-api.webp',
    category: '기존 시스템에 Web3를 더하려면',
    title: '토큰화 API',
    text: '자산 발행과 스마트컨트랙트 실행을 API로 연결하세요.',
    flow: ['API 키 발급', 'REST 호출', '블록체인 기록'],
    action: 'API 살펴보기',
  },
] as const

export const SERVICES: { href: string; icon: NavIconKey; title: string; text: string }[] = [
  { href: '/nft', icon: 'nft', title: 'NFT', text: '디지털 자산 발행과 소유권 관리' },
  { href: '/sbt', icon: 'sbt', title: 'SBT', text: '양도할 수 없는 자격·인증 토큰' },
  { href: '/rwa', icon: 'rwa', title: 'RWA', text: '실물자산 정보의 등록과 토큰화' },
  { href: '/bridge', icon: 'bridge', title: '브릿지', text: '네트워크 간 자산 이동과 래핑' },
  { href: '/staking', icon: 'staking', title: '스테이킹', text: 'wMST 예치와 보상 관리' },
  { href: '/ipfs', icon: 'ipfs', title: 'IPFS', text: 'AI 모델 분산 저장과 무결성 검증' },
]

export const SPECS = [
  { value: '10K', label: 'TPS 처리 성능', description: '초당 1만 건 처리 성능' },
  { value: 'EVM', label: '완전 호환 네트워크', description: 'EVM 완전 호환 네트워크' },
  { value: 'REST', label: 'API 기반 시스템 연동', description: 'REST API 기반 시스템 연동' },
  { value: '24H', label: '내부 확인 후 네트워크 구축', description: '내부 확인 후 24시간 내 네트워크 구축' },
]

export const PROCESS = [
  {
    title: '요구사항 정리',
    text: '서비스 목적과 필요한 기능, 연동할 시스템을 정리합니다.',
    link: { href: '/#platform', label: '서비스 범위 살펴보기' },
  },
  {
    title: '네트워크 구성 확인',
    text: '전용 체인의 운영 정책과 MST 담보 조건, 구축 범위를 확인합니다.',
    link: { href: '/network', label: '구축 조건 확인' },
  },
  {
    title: 'API 연동과 운영 준비',
    text: '호출 방식과 보안 구성을 확인하고, 서비스에 필요한 기능을 연결합니다.',
    link: { href: '/developers/guide', label: '개발 가이드 보기' },
  },
]

export const HOME_FAQ: FaqItem[] = [
  {
    question: '어떤 서비스부터 시작하면 되나요?',
    answer:
      '독립적인 인프라가 필요하면 기업 전용 네트워크를, 기존 시스템에 자산 발행이나 컨트랙트 실행을 연결하려면 토큰화 API를 먼저 확인하세요.',
    link: { href: '/#services', label: '서비스별 용도 보기' },
  },
  {
    question: '24시간 안에 네트워크가 구축되나요?',
    answer:
      '네트워크 생성은 신청 정보의 내부 확인 후 24시간 이내 진행을 기준으로 안내합니다. 필요한 설정과 운영 조건은 신청 전에 확인해 주세요.',
    link: { href: '/network', label: '네트워크 구축 조건 보기' },
  },
  {
    question: '기존 시스템이나 스마트컨트랙트와 연동할 수 있나요?',
    answer:
      'EVM 호환 네트워크와 REST API를 제공합니다. 기존 시스템의 구성에 맞춰 호출 방식과 컨트랙트 연동 범위를 확인할 수 있습니다.',
    link: { href: '/developers/guide', label: 'API 동작 흐름과 사용 예시 보기' },
  },
  {
    question: '어떤 보안 구조를 사용하나요?',
    answer:
      'AES 기반 암호화, Vault 키 관리, HSM 내부 서명으로 역할을 나눈 보안 아키텍처를 안내합니다. 서비스에 적용할 범위와 운영 환경은 도입 시 확인할 수 있습니다.',
    link: { href: '/security', label: '보안 아키텍처 확인' },
  },
  {
    question: '도입 비용과 MST 담보 조건은 어떻게 되나요?',
    answer:
      '전용 네트워크는 MST를 담보로 개설하며, 수수료와 확장 비용도 MST 기준으로 안내합니다. 필요한 구성과 운영 범위에 따라 조건이 달라질 수 있으므로 도입 전에 확인해 주세요.',
    link: { href: '/network', label: '서비스 개요와 정책 보기' },
  },
  {
    question: '도입 전에 무엇을 준비하면 좋을까요?',
    answer:
      '서비스 목적, 필요한 기능, 기존 시스템의 연동 방식과 희망 일정을 정리해 주세요. 네트워크 신청 시에는 회사명, 연락처, MST 예치 수량과 기타 요청사항을 입력합니다.',
  },
]
