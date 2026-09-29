'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const STEP_MS = 1300
const TRAVEL_MS = 620
const HOLD_MS = 2200
const REST_MS = 900

/**
 * FlowDiagram 재생기. 화면에 보일 때만 요청 신호(점)가 연결선을 타고 내려가며
 * 도착한 노드를 차례로 밝힌다. 같은 섹션의 [data-flow-trigger]에 마우스를 올리면
 * 재생을 멈추고 관련 노드만 밝힌다. 동작 줄이기 환경에서는 아무것도 하지 않는다.
 */
export function FlowPlayer({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-flow-node]'))
    const vias = Array.from(root.querySelectorAll<HTMLElement>('[data-flow-via]'))
    if (nodes.length < 2) return

    let step = -1
    let timer = 0
    let running = false
    let held = false
    const animations: Animation[] = []

    const paint = (active: number) => {
      nodes.forEach((node, index) => {
        node.dataset.flowState = index < active ? 'passed' : index === active ? 'active' : ''
      })
    }

    const travel = (via: HTMLElement | undefined) => {
      const packet = via?.querySelector<HTMLElement>('[data-flow-packet]')
      if (!via || !packet) return
      const distance = via.getBoundingClientRect().height
      animations.push(
        packet.animate(
          [
            { transform: 'translateY(0)', opacity: 0 },
            { opacity: 1, offset: 0.18 },
            { opacity: 1, offset: 0.82 },
            { transform: `translateY(${distance}px)`, opacity: 0 },
          ],
          { duration: TRAVEL_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
        ),
      )
    }

    const advance = () => {
      if (!running) return
      step += 1
      if (step >= nodes.length) {
        step = -1
        paint(-1)
        timer = window.setTimeout(advance, REST_MS)
        return
      }
      if (step === 0) {
        paint(0)
        timer = window.setTimeout(advance, STEP_MS)
        return
      }
      // 신호가 연결선을 다 내려온 뒤 다음 노드를 켠다
      travel(vias[step - 1])
      timer = window.setTimeout(() => {
        paint(step)
        timer = window.setTimeout(advance, step === nodes.length - 1 ? HOLD_MS : STEP_MS - TRAVEL_MS)
      }, TRAVEL_MS * 0.8)
    }

    const start = () => {
      if (running || held) return
      running = true
      step = -1
      advance()
    }

    const stop = () => {
      running = false
      window.clearTimeout(timer)
      animations.splice(0).forEach((animation) => animation.cancel())
    }

    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) start()
        else {
          stop()
          paint(-1)
        }
      },
      { threshold: 0.35 },
    )
    visibility.observe(root)

    // 설명 목록과 연동: 항목에 올리면 해당 계층을 맡는 노드만 밝힌다
    const section = root.closest('section')
    const triggers = section ? Array.from(section.querySelectorAll<HTMLElement>('[data-flow-trigger]')) : []
    const cleanups = triggers.map((trigger) => {
      const keys = (trigger.dataset.flowTrigger ?? '').split(/\s+/).filter(Boolean)
      const enter = () => {
        held = true
        stop()
        trigger.dataset.flowLit = ''
        nodes.forEach((node) => {
          node.dataset.flowState = keys.includes(node.dataset.flowKey ?? '') ? 'active' : 'dim'
        })
      }
      const leave = () => {
        held = false
        delete trigger.dataset.flowLit
        paint(-1)
        const rect = root.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) start()
      }
      trigger.addEventListener('pointerenter', enter)
      trigger.addEventListener('pointerleave', leave)
      return () => {
        trigger.removeEventListener('pointerenter', enter)
        trigger.removeEventListener('pointerleave', leave)
        delete trigger.dataset.flowLit
      }
    })

    return () => {
      visibility.disconnect()
      stop()
      cleanups.forEach((cleanup) => cleanup())
      paint(-1)
    }
  }, [])

  return (
    <ol ref={ref} className={className} aria-label={label} data-reveal-group="">
      {children}
    </ol>
  )
}
