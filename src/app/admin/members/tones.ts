import type { BadgeTone } from '@/components/ui/DataDisplay'
import type { MemberRole, MemberStatus } from '@/lib/account'

export const statusTone = (status: MemberStatus): BadgeTone => (status === 'ACTIVE' ? 'success' : 'danger')
export const roleTone = (role: MemberRole): BadgeTone => (role === 'ADMIN' ? 'info' : 'neutral')
