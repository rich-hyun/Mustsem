'use client'

import { useScroll } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * 도입 절차 선: 스크롤한 만큼 선이 그려지고, 선이 닿은 단계 번호가 켜진다.
 * 진행도는 Motion의 useScroll 모션 값으로만 받아 --progress 변수에 쓴다 (React 렌더링 없음).
 * 동작 줄이기에서는 처음부터 다 그려진 상태로 둔다.
 */
export function ProcessProgress({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] })

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const markers = Array.from(root.querySelectorAll<HTMLElement>('[data-progress-marker]'))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const apply = (raw: number) => {
      const progress = reduced ? 1 : Math.min(Math.max(raw, 0), 1)
      root.style.setProperty('--progress', progress.toFixed(4))
      markers.forEach((marker, index) => {
        const at = markers.length > 1 ? index / (markers.length - 1) : 0
        marker.toggleAttribute('data-reached', progress >= at - 0.02)
      })
    }

    apply(scrollYProgress.get())
    root.setAttribute('data-ready', '')
    return scrollYProgress.on('change', apply)
  }, [scrollYProgress])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
