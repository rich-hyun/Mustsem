/**
 * 회원 관리 작업의 이름·확인 문구·요청 본문. 목록의 관리 메뉴와 상세 대화상자가 같은 것을 쓴다.
 * 여기서 메뉴를 감추는 것은 안내일 뿐이고, 허용 여부는 서버(src/server/members/admin.ts)가 요청마다 다시 판단한다.
 */
import type { AdminMember } from '@/lib/account'

export type MemberAction = 'promote' | 'demote' | 'enable' | 'disable' | 'delete'
export type ConfirmableAction = Exclude<MemberAction, 'delete'>

interface ActionText {
  /** 메뉴·버튼 이름 */
  label: string
  /** 확인 창 제목 */
  title: string
  body: string
  /** 실행 버튼 */
  button: string
  /** 완료 안내 (앞에 회원 이름이 붙는다) */
  done: string
}

export const ACTION_TEXT: Record<ConfirmableAction, ActionText> = {
  promote: {
    label: '관리자 권한 부여',
    title: '관리자 권한 부여',
    body: '해당 회원에게 관리자 권한을 부여하시겠습니까? 관리자 권한을 부여하면 회원 조회 및 관리 기능에 접근할 수 있습니다.',
    button: '권한 부여',
    done: '관리자 권한을 부여했습니다.',
  },
  demote: {
    label: '관리자 권한 회수',
    title: '관리자 권한 회수',
    body: '해당 회원의 관리자 권한을 회수하시겠습니까? 권한 회수 후 해당 회원은 관리자 기능을 사용할 수 없습니다.',
    button: '권한 회수',
    done: '관리자 권한을 회수했습니다.',
  },
  disable: {
    label: '계정 비활성화',
    title: '계정 비활성화',
    body: '이 회원을 비활성화하시겠습니까? 로그인이 막히고, 이미 로그인한 기기의 세션도 다음 요청부터 차단됩니다. 언제든 다시 활성화할 수 있습니다.',
    button: '비활성화',
    done: '계정을 비활성화했습니다.',
  },
  enable: {
    label: '계정 활성화',
    title: '계정 활성화',
    body: '이 회원을 다시 활성화하시겠습니까? 회원이 다시 로그인할 수 있게 됩니다.',
    button: '활성화',
    done: '계정을 활성화했습니다.',
  },
}

export const DELETE_LABEL = '회원 삭제'

/** PATCH /api/admin/users/:id 본문 */
export const actionBody = (action: ConfirmableAction) =>
  action === 'disable' ? { status: 'DISABLED' } : action === 'enable' ? { status: 'ACTIVE' } : { role: action === 'promote' ? 'ADMIN' : 'USER' }

/** 이 회원에게 지금 할 수 있는 작업 (내 계정은 없음, 최고 관리자는 권한 회수·비활성화·삭제 없음) */
export function allowedActions(member: AdminMember, meId: string): MemberAction[] {
  if (member.userId === meId) return []
  const actions: MemberAction[] = []
  if (member.role === 'USER') actions.push('promote')
  else if (!member.protected) actions.push('demote')
  if (member.status === 'DISABLED') actions.push('enable')
  else if (!member.protected) actions.push('disable')
  if (!member.protected) actions.push('delete')
  return actions
}

/** 할 수 있는 작업이 줄어든 이유 (메뉴·상세에 안내) */
export function restrictionNote(member: AdminMember, meId: string): string | null {
  if (member.userId === meId) return '내 계정입니다. 내 계정의 상태·권한 변경과 삭제는 다른 관리자가 해야 합니다.'
  if (member.protected) return '최고 관리자 계정입니다. 권한 회수, 비활성화, 삭제를 할 수 없습니다.'
  return null
}
