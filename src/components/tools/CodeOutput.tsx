'use client'

import { CodeIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { CopyButton } from '@/components/ui/CopyButton'
import { CodeBlock } from '@/components/ui/DataDisplay'
import styles from './Tool.module.css'

/** 결과가 아직 없을 때의 자리 표시 */
export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      {icon}
      <p>{children}</p>
    </div>
  )
}

interface CodeOutputProps {
  code: string | null
  /** 코드 블록 머리 (예: 'Solidity · Mustsem') */
  title: string
  emptyText: ReactNode
}

/** 생성된 코드 + 복사 버튼. 아직 생성 전이면 안내를 보여 준다. */
export function CodeOutput({ code, title, emptyText }: CodeOutputProps) {
  if (!code) return <EmptyState icon={<CodeIcon size={28} aria-hidden />}>{emptyText}</EmptyState>
  // 코드가 새로 만들어질 때마다 한 번 훑고 지나가는 빛으로 생성을 알린다
  return (
    <div key={code} className={styles.generated}>
      <CodeBlock title={title} code={code} action={<CopyButton value={code} label="코드 복사" />} />
    </div>
  )
}
