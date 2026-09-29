'use client'

import { CheckIcon, CopyIcon } from '@phosphor-icons/react/ssr'
import { useEffect, useRef, useState } from 'react'
import { cx } from '@/lib/cx'
import styles from './CopyButton.module.css'

interface CopyButtonProps {
  value: string
  /** 스크린리더·툴팁용 설명 (예: "주소 복사") */
  label?: string
  /** 글자 없이 아이콘만 */
  iconOnly?: boolean
  className?: string
}

type CopyState = 'idle' | 'done' | 'failed'

export function CopyButton({ value, label = '복사', iconOnly = false, className }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState('done')
    } catch {
      setState('failed')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  const text = state === 'done' ? '복사됨' : state === 'failed' ? '복사 실패' : label
  return (
    <button
      type="button"
      className={cx(styles.copy, iconOnly && styles.iconOnly, state === 'done' && styles.done, state === 'failed' && styles.failed, className)}
      onClick={copy}
      aria-label={iconOnly ? text : undefined}
      title={iconOnly ? text : undefined}
    >
      {state === 'done' ? <CheckIcon size={14} weight="bold" aria-hidden /> : <CopyIcon size={14} aria-hidden />}
      {!iconOnly && <span aria-live="polite">{text}</span>}
    </button>
  )
}
