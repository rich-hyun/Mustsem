import type { NavIconKey } from '@/config/navigation'
import styles from '../home.module.css'

/**
 * 전용 네트워크 구성도: 로고의 육각형 모티프를 잇는 자체 일러스트.
 * 노드 순서는 옆 서비스 목록과 같아서, 목록을 따라가면 허브 둘레를 시계 방향으로 돈다.
 * 각 노드·연결선에 서비스 키를 달아 두면 PlatformLinker가 강조와 신호를 입힌다.
 */
const NODES: { id: NavIconKey; label: string; x: number; y: number; w: number }[] = [
  { id: 'nft', label: 'NFT', x: 375, y: 75, w: 58 },
  { id: 'sbt', label: 'SBT', x: 450, y: 205, w: 56 },
  { id: 'rwa', label: 'RWA', x: 375, y: 335, w: 60 },
  { id: 'bridge', label: '브릿지', x: 225, y: 335, w: 70 },
  { id: 'staking', label: '스테이킹', x: 150, y: 205, w: 82 },
  { id: 'ipfs', label: 'IPFS', x: 225, y: 75, w: 60 },
]

export const HUB = { x: 300, y: 205 } as const

export function NetworkDiagram() {
  return (
    <svg
      className={styles.diagramSvg}
      viewBox="0 0 600 420"
      role="img"
      aria-label="머스트셈 전용 네트워크 구성도. 기업 전용 체인을 중심으로 NFT, SBT, RWA, 브릿지, 스테이킹, IPFS가 하나의 궤도로 연결된 구조"
    >
      <defs>
        <linearGradient id="diagramGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00D09C" />
          <stop offset="100%" stopColor="#00B4D8" />
        </linearGradient>
        <pattern id="diagramGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#0f1e38" strokeOpacity="0.045" />
        </pattern>
        <filter id="diagramHubShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#0f1e38" floodOpacity="0.12" />
        </filter>
        <filter id="diagramPillShadow" x="-40%" y="-60%" width="180%" height="220%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0f1e38" floodOpacity="0.07" />
        </filter>
      </defs>

      <rect x="0.5" y="0.5" width="599" height="419" rx="14" fill="#ffffff" stroke="#e2e7ee" />
      <rect x="0.5" y="0.5" width="599" height="419" rx="14" fill="url(#diagramGridPattern)" />

      {/* 캡션 행: 브랜드 라벨 · 성능 칩 */}
      <path d="M37 37 L41.3 39.5 V44.5 L37 47 L32.7 44.5 V39.5 Z" fill="url(#diagramGrad)" />
      <text x="50" y="46" fontSize="10" fontWeight="700" letterSpacing="0.15em" fill="#5b6778">
        MUSTSEM NETWORK
      </text>
      <rect x="456" y="29" width="112" height="24" rx="12" fill="rgba(0, 208, 156, 0.08)" stroke="rgba(0, 208, 156, 0.24)" />
      <text x="512" y="45" textAnchor="middle" fontSize="11" fontWeight="700" fill="#077a64">
        10,000 TPS
      </text>

      {/* 서비스 궤도: 천천히 돈다 */}
      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <circle
          className={styles.orbit}
          r="150"
          fill="none"
          stroke="#b9c4d6"
          strokeWidth="1.5"
          strokeDasharray="0.1 7"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      {/* 허브 펄스: 두 개를 엇갈려 연속 신호로 */}
      <g transform={`translate(${HUB.x}, ${HUB.y})`} fill="none" stroke="#00D09C" strokeWidth="1.5">
        <circle className={styles.pulse} r="54" />
        <circle className={`${styles.pulse} ${styles.pulseLate}`} r="54" />
      </g>

      <g>
        {NODES.map((node) => (
          <line key={node.id} className={styles.spoke} data-spoke={node.id} x1={HUB.x} y1={HUB.y} x2={node.x} y2={node.y} />
        ))}
      </g>

      {/* 신호 점: PlatformLinker가 허브에서 노드로 보낸다 */}
      <g aria-hidden>
        {[0, 1, 2].map((index) => (
          <circle key={index} className={styles.packet} data-packet="" r="4.5" cx="0" cy="0" />
        ))}
      </g>

      {/* 허브: 기업 전용 체인 */}
      <g filter="url(#diagramHubShadow)">
        <path d="M300 155 L343.3 180 V230 L300 255 L256.7 230 V180 Z" fill="#ffffff" stroke="url(#diagramGrad)" strokeWidth="3" strokeLinejoin="round" />
      </g>
      <path d="M284 224 V190 L300 206 L316 190 V224" fill="none" stroke="url(#diagramGrad)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="300" y="283" textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing="-0.01em" fill="#111a2b">
        기업 전용 체인
      </text>

      {NODES.map((node) => (
        <g
          key={node.id}
          className={styles.node}
          data-node={node.id}
          data-x={node.x}
          data-y={node.y}
          filter="url(#diagramPillShadow)"
        >
          <rect className={styles.nodePill} x={node.x - node.w / 2} y={node.y - 14} width={node.w} height="28" rx="14" />
          <text className={styles.nodeLabel} x={node.x} y={node.y + 4} textAnchor="middle" fontSize="12" fontWeight="600">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
