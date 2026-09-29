/**
 * 사이트 전역 설정 — 도메인·외부 서비스 주소는 여기 한 곳에서 관리한다.
 * (체인 RPC는 networks.ts, 컨트랙트 주소는 contracts.ts)
 */
export const SITE = {
  name: '머스트셈 네트워크',
  brand: 'MUSTSEM',
  url: 'https://www.mustsem.co.kr',
  tagline: '엔터프라이즈 Web3 & 토큰화 API 플랫폼',
  description:
    '머스트셈은 초당 10,000건 처리 가능한 고성능 Web3 인프라와 토큰화 API를 제공하는 탈중앙화 네트워크 전문 기업입니다.',
  contactEmail: 'mustree1213@gmail.com',
} as const

/** REST API 서버 — 대시보드 잔액 조회, RWA 원본 업로드 */
export const API_BASE = 'https://api.mustree.kr'

/** IPFS 게이트웨이 — RWA 원본 파일 열람·다운로드 */
export const IPFS_GATEWAY = 'https://rwa-gw.mustree.kr/ipfs'

/**
 * Supabase 인증 — anon 키는 브라우저 공개용 키다(권한은 Supabase RLS가 통제).
 * 프로젝트를 옮기면 url·anonKey 두 값만 바꾸면 된다.
 */
export const SUPABASE = {
  url: 'https://qkqhpzyazsvpggtyhuft.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcWhwenlhenN2cGdndHlodWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MTU1ODUsImV4cCI6MjA4OTM5MTU4NX0.p1RJDLt4v3O_3PvGhfsFiKnu54OMDD0YJ7WvBpfv3TE',
} as const
