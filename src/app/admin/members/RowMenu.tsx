'use client'

/**
 * 회원별 관리 메뉴. 표 전체에 메뉴 하나를 두고, 누른 행의 버튼 아래에 띄운다.
 *
 * 브라우저 popover(맨 위 레이어)라 표의 가로 스크롤 영역에 잘리지 않고, 바깥 클릭·Esc 닫기는 브라우저가 한다.
 * 위치는 CSS 앵커(지원 브라우저)로 버튼에 붙이고, 지원하지 않으면 열 때 잰 좌표를 쓴다.
 */
import { DotsThreeIcon } from '@phosphor-icons/react/ssr'
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import type { AdminMember } from '@/lib/account'
import { cx } from '@/lib/cx'
import { ACTION_TEXT, DELETE_LABEL, allowedActions, restrictionNote, type MemberAction } from './actions'
import styles from './admin.module.css'

const ANCHOR = '--member-menu'

export interface RowMenuControl {
  menuId: string
  openFor: AdminMember | null
  /** 행의 "관리" 버튼에 펼친다 */
  triggerProps: (member: AdminMember) => {
    popoverTarget: string
    'aria-haspopup': 'menu'
    'aria-expanded': boolean
    style: CSSProperties | undefined
    onClick: (event: { currentTarget: HTMLElement }) => void
  }
}

interface RowMenuProps {
  meId: string
  onDetail: (member: AdminMember) => void
  onAction: (member: AdminMember, action: MemberAction) => void
  children: (control: RowMenuControl) => React.ReactNode
}

export function RowMenu({ meId, onDetail, onAction, children }: RowMenuProps) {
  const menuId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [member, setMember] = useState<AdminMember | null>(null)
  const [open, setOpen] = useState(false)

  const control: RowMenuControl = {
    menuId,
    openFor: open ? member : null,
    triggerProps: (target) => {
      const active = open && member?.userId === target.userId
      return {
        popoverTarget: menuId,
        'aria-haspopup': 'menu',
        'aria-expanded': active,
        // 열린 행의 버튼만 앵커가 된다 (같은 이름이 둘이면 브라우저가 마지막 것을 쓴다)
        style: member?.userId === target.userId ? ({ anchorName: ANCHOR } as CSSProperties) : undefined,
        // 클릭 처리 뒤에 브라우저가 popover를 연다. 그 전에 대상과 (앵커 미지원 브라우저용) 좌표를 정해 둔다
        onClick: (event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const menu = ref.current
          if (menu) {
            menu.style.setProperty('--menu-top', `${Math.round(rect.bottom + 6)}px`)
            menu.style.setProperty('--menu-right', `${Math.round(document.documentElement.clientWidth - rect.right)}px`)
          }
          setMember(target)
        },
      }
    },
  }

  const close = () => ref.current?.hidePopover()

  const choose = (run: () => void) => {
    close()
    run()
  }

  // 위·아래 화살표로 항목 이동 (Tab·Esc는 브라우저 기본 동작)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    event.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  const actions = member ? allowedActions(member, meId) : []
  const note = member ? restrictionNote(member, meId) : null

  return (
    <>
      {children(control)}
      <div
        ref={ref}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={member ? `${member.name} 회원 관리` : '회원 관리'}
        className={styles.menu}
        onKeyDown={onKeyDown}
        onToggle={(event) => {
          const opened = event.newState === 'open'
          setOpen(opened)
          if (opened) ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
        }}
      >
        {member && (
          <>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => choose(() => onDetail(member))}>
              회원 상세정보
            </button>
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                className={cx(styles.menuItem, action === 'delete' && styles.menuDanger)}
                onClick={() => choose(() => onAction(member, action))}
              >
                {action === 'delete' ? DELETE_LABEL : ACTION_TEXT[action].label}
              </button>
            ))}
            {note && <p className={styles.menuNote}>{note}</p>}
          </>
        )}
      </div>
    </>
  )
}

/** 행의 "관리" 버튼 */
export function RowMenuButton({ control, member }: { control: RowMenuControl; member: AdminMember }) {
  return (
    <Button size="sm" variant="secondary" aria-label={`${member.name} 회원 관리 메뉴`} {...control.triggerProps(member)}>
      관리 <DotsThreeIcon size={16} weight="bold" aria-hidden />
    </Button>
  )
}
