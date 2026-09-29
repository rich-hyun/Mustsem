'use client'

import { useMotionValue, useSpring } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

const LIMIT_X = 8
const LIMIT_Y = 5

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit)

/**
 * 버튼이 커서 쪽으로 살짝 끌려오는 자석 효과. 좌표는 모션 값 + 스프링으로만 다룬다.
 * 정밀 포인터에서만 동작하고, 동작 줄이기 환경에서는 제자리에 있다.
 */
export function Magnetic({ children, strength = 0.2 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 })
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const apply = () => {
      el.style.translate = `${springX.get().toFixed(2)}px ${springY.get().toFixed(2)}px`
    }
    const offX = springX.on('change', apply)
    const offY = springY.on('change', apply)

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches || reduced.matches) return
      const rect = el.getBoundingClientRect()
      x.set(clamp((event.clientX - (rect.left + rect.width / 2)) * strength, LIMIT_X))
      y.set(clamp((event.clientY - (rect.top + rect.height / 2)) * strength, LIMIT_Y))
    }
    const onLeave = () => {
      x.set(0)
      y.set(0)
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      offX()
      offY()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [x, y, springX, springY, strength])

  return (
    <span ref={ref} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  )
}
