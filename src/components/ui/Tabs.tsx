'use client'

import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  label: string
  className?: string
}

/** WAI-ARIA 탭 패턴: 좌우 화살표·Home·End로 이동, 선택된 탭만 Tab 키 순서에 둔다 */
export function Tabs({ items, value, onChange, label, className }: TabsProps) {
  const baseId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

  // 선택 표시가 탭 사이를 미끄러져 옮겨 간다. 측정 전(서버 HTML)에는 선택된 탭이 스스로 칠한다
  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    const place = () => {
      const index = items.findIndex((item) => item.id === value)
      const tab = refs.current[index]
      if (!tab) return
      indicator.style.width = `${tab.offsetWidth}px`
      indicator.style.transform = `translateX(${tab.offsetLeft}px)`
      list.setAttribute('data-indicator', '')
    }
    place()
    // 글꼴이 늦게 적용되어 탭 폭만 바뀌는 경우도 따라간다
    const observer = new ResizeObserver(place)
    observer.observe(list)
    refs.current.forEach((tab) => tab && observer.observe(tab))
    return () => observer.disconnect()
  }, [items, value])

  const focusTab = (index: number) => {
    const item = items[index]
    if (!item) return
    onChange(item.id)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    focusTab(next)
  }

  return (
    <div className={cx(styles.tabs, className)}>
      <div ref={listRef} className={styles.list} role="tablist" aria-label={label}>
        <span ref={indicatorRef} className={styles.indicator} aria-hidden />
        {items.map((item, index) => {
          const selected = item.id === value
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== value}
          tabIndex={0}
          className={styles.panel}
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}
