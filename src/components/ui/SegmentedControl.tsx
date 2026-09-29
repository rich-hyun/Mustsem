'use client'

import { useLayoutEffect, useRef } from 'react'
import { cx } from '@/lib/cx'
import styles from './Tabs.module.css'

interface Option<T extends string> {
  id: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
}

/**
 * 같은 내용을 다른 단위로 보는 전환 버튼 묶음 (탭이 아니라 aria-pressed 버튼).
 * 선택 표시는 탭과 같은 모양으로, 버튼 사이를 미끄러져 옮겨 간다.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    const place = () => {
      const button = buttons.current[options.findIndex((option) => option.id === value)]
      if (!button) return
      indicator.style.width = `${button.offsetWidth}px`
      indicator.style.transform = `translateX(${button.offsetLeft}px)`
      list.setAttribute('data-indicator', '')
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(list)
    buttons.current.forEach((button) => button && observer.observe(button))
    return () => observer.disconnect()
  }, [options, value])

  return (
    <div ref={listRef} className={cx(styles.list, styles.segmented, className)} role="group" aria-label={label}>
      <span ref={indicatorRef} className={styles.indicator} aria-hidden />
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={(node) => {
            buttons.current[index] = node
          }}
          type="button"
          className={styles.tab}
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
