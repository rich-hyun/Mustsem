import { CaretDownIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Badge } from '@/components/ui/DataDisplay'
import { IconTile } from './Blocks'
import { FlowPlayer } from './FlowPlayer'
import styles from './FlowDiagram.module.css'

export interface FlowNode {
  title: string
  text: string
  icon: ReactNode
  /** 노드 오른쪽 기술 배지 (예: 'TLS 1.3') */
  badge?: string
  /** 이전 노드에서 이 노드로 넘어오는 경로 라벨 (예: 'HTTPS + HMAC 서명') */
  via?: string
  /** 같은 섹션의 data-flow-trigger 항목과 연결할 식별자 */
  id?: string
}

/**
 * 요청이 거쳐 가는 단계를 위에서 아래로 보여 주는 흐름도.
 * 구조는 서버에서 그리고, 신호가 흐르는 재생만 FlowPlayer(클라이언트)가 맡는다.
 */
export function FlowDiagram({ nodes, label, className }: { nodes: FlowNode[]; label: string; className?: string }) {
  return (
    <FlowPlayer className={cx(styles.flow, className)} label={label}>
      {nodes.map((node, index) => (
        <li key={node.title} className={styles.item}>
          {index > 0 && (
            <div className={styles.via} data-flow-via="">
              <span className={styles.wire} aria-hidden>
                <span className={styles.packet} data-flow-packet="" />
                <CaretDownIcon className={styles.caret} size={12} weight="bold" />
              </span>
              {node.via && <span className={styles.viaLabel}>{node.via}</span>}
            </div>
          )}
          <div className={styles.node} data-flow-node="" data-flow-key={node.id}>
            <IconTile className={styles.nodeIcon}>{node.icon}</IconTile>
            <div className={styles.nodeText}>
              <strong className={styles.nodeTitle}>{node.title}</strong>
              <span className={styles.nodeDesc}>{node.text}</span>
            </div>
            {node.badge && (
              <Badge className={styles.nodeBadge} tone="accent" mono>
                {node.badge}
              </Badge>
            )}
          </div>
        </li>
      ))}
    </FlowPlayer>
  )
}
