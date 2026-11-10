import type { BadgeTone } from '@/components/ui/DataDisplay'
import type { MemberRole, MemberStatus } from '@/lib/account'

export const statusTone = (status: MemberStatus): BadgeTone => (status === 'ACTIVE' ? 'success' : 'danger')
/** 최고 관리자(보호 계정)만 틸 포인트, 관리자는 파랑, 일반 회원은 회색 */
export const roleTone = (member: { role: MemberRole; protected?: boolean }): BadgeTone =>
  member.role !== 'ADMIN' ? 'neutral' : member.protected ? 'accent' : 'info'
