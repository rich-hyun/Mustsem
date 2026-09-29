import { CheckIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import styles from './Tool.module.css'

interface ToolStepProps {
  index: number
  title: string
  /** 제목 옆 흐름 표기 (예: 'TMZ → wTMZ') */
  meta?: string
  description?: ReactNode
  done?: boolean
  children: ReactNode
}

/** 번호가 매겨진 실행 단계 — 사용자가 조작하는 면이라 L2(그림자) 카드로 올린다 */
export function ToolStep({ index, title, meta, description, done, children }: ToolStepProps) {
  return (
    <li className={styles.step} data-state={done ? 'done' : undefined}>
      <span className={styles.marker} aria-hidden>
        {done ? <CheckIcon size={16} weight="bold" /> : index}
      </span>
      <Card elevation="raised" padding="lg">
        <div className={styles.stepHead}>
          <h3 className={styles.stepTitle}>
            <span className="sr-only">{index}단계{done ? ' (완료)' : ''}: </span>
            {title}
          </h3>
          {meta && <span className={styles.stepMeta}>{meta}</span>}
        </div>
        {description && <p className={styles.stepDesc}>{description}</p>}
        {children}
      </Card>
    </li>
  )
}

export function ToolSteps({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {children}
    </ol>
  )
}
