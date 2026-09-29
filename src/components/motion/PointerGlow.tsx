'use client'

import { useMotionValue, useSpring } from 'motion/react'
import { useEffect, useRef } from 'react'

interface PointerGlowProps {
  className?: string
  /** 빛이 기우는 기준점 (부모 기준 비율) */
  anchor?: { x: number; y: number }
  /** 기준점에서 커서까지 얼마나 다가갈지. 0이면 기준점에 고정, 1이면 커서와 같은 자리 */
  lean?: number
}

/**
 * 부모 면 위에서 마우스 쪽으로 기우는 은은한 빛.
 * - 커서를 쫓지 않고 기준점과 커서 사이(lean 비율)에 머문다. 튕김 없이 약 0.45초에 따라간다.
 * - 마우스가 들어오면 그 자리에서 나타나고, 벗어나면 그 자리에서 사라진다. 다른 곳으로 날아가지 않는다.
 * - 좌표는 모션 값으로만 다뤄 React 렌더링을 일으키지 않는다. 터치·동작 줄이기 환경에서는 켜지지 않는다.
 * 움직이는 장식은 글 읽기를 방해하기 쉬워서(시야 가장자리의 움직임은 주의를 끈다) 작고 옅게, 느리게 둔다.
 */
export function PointerGlow({ className, anchor = { x: 0.62, y: 0.5 }, lean = 0.5 }: PointerGlowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const smoothX = useSpring(x, { visualDuration: 0.45, bounce: 0 })
  const smoothY = useSpring(y, { visualDuration: 0.45, bounce: 0 })

  useEffect(() => {
    const glow = ref.current
    const surface = glow?.parentElement
    if (!glow || !surface) return

    const apply = () => {
      glow.style.translate = `${smoothX.get()}px ${smoothY.get()}px`
    }
    const unsubscribeX = smoothX.on('change', apply)
    const unsubscribeY = smoothY.on('change', apply)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let active = false

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches || !fine.matches) return
      const rect = surface.getBoundingClientRect()
      const ax = rect.width * anchor.x
      const ay = rect.height * anchor.y
      const tx = ax + (event.clientX - rect.left - ax) * lean
      const ty = ay + (event.clientY - rect.top - ay) * lean
      if (!active) {
        // 들어온 자리에 바로 놓고 나타나게 한다
        x.jump(tx)
        y.jump(ty)
        smoothX.jump(tx)
        smoothY.jump(ty)
        apply()
        active = true
        glow.setAttribute('data-active', '')
        return
      }
      x.set(tx)
      y.set(ty)
    }

    const onLeave = () => {
      active = false
      glow.removeAttribute('data-active')
    }

    surface.addEventListener('pointerenter', onPointer, { passive: true })
    surface.addEventListener('pointermove', onPointer, { passive: true })
    surface.addEventListener('pointerleave', onLeave)

    return () => {
      unsubscribeX()
      unsubscribeY()
      surface.removeEventListener('pointerenter', onPointer)
      surface.removeEventListener('pointermove', onPointer)
      surface.removeEventListener('pointerleave', onLeave)
    }
  }, [x, y, smoothX, smoothY, anchor.x, anchor.y, lean])

  return <div ref={ref} className={className} aria-hidden />
}
