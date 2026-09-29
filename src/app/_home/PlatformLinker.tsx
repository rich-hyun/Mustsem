'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const HUB = { x: 300, y: 205 }
const CYCLE_MS = 3200
const RESUME_MS = 2400
const TRAVEL_MS = 760
const PACKET_GAP_MS = 260

/**
 * 서비스 목록과 네트워크 구성도를 잇는다. 목록(또는 노드)에 올리면 같은 서비스의 노드와
 * 연결선이 밝아지고 허브에서 신호가 날아간다. 가만히 두면 목록 순서대로 스스로 돈다.
 * 목록·도면은 서버가 그리고, 여기서는 data-active 속성과 신호 애니메이션만 다룬다.
 */
export function PlatformLinker({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-svc]'))
    const ids = items.map((item) => item.dataset.svc ?? '')
    const nodes = new Map(Array.from(root.querySelectorAll<SVGGElement>('[data-node]')).map((node) => [node.dataset.node ?? '', node]))
    const spokes = new Map(Array.from(root.querySelectorAll<SVGLineElement>('[data-spoke]')).map((line) => [line.dataset.spoke ?? '', line]))
    const packets = Array.from(root.querySelectorAll<SVGCircleElement>('[data-packet]'))
    if (!ids.length) return

    let active = ''
    let index = -1
    let cycle = 0
    let resume = 0
    let visible = false
    let hovering = false
    const timers = new Set<number>()
    let packetCursor = 0

    const setActive = (id: string) => {
      active = id
      root.toggleAttribute('data-linked', Boolean(id))
      for (const item of items) item.toggleAttribute('data-active', item.dataset.svc === id)
      nodes.forEach((node, key) => node.toggleAttribute('data-active', key === id))
      spokes.forEach((line, key) => line.toggleAttribute('data-active', key === id))
    }

    const fire = (id: string) => {
      const node = nodes.get(id)
      if (!node || reduced || !packets.length) return
      const x = Number(node.dataset.x)
      const y = Number(node.dataset.y)
      for (let shot = 0; shot < 2; shot++) {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          const packet = packets[packetCursor++ % packets.length]
          packet?.animate(
            [
              { transform: `translate(${HUB.x}px, ${HUB.y}px)`, opacity: 0 },
              { opacity: 1, offset: 0.15 },
              { opacity: 1, offset: 0.85 },
              { transform: `translate(${x}px, ${y}px)`, opacity: 0 },
            ],
            { duration: TRAVEL_MS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'both' },
          )
        }, shot * PACKET_GAP_MS)
        timers.add(timer)
      }
    }

    const activate = (id: string) => {
      if (id === active) return
      setActive(id)
      fire(id)
    }

    const stopCycle = () => {
      window.clearInterval(cycle)
      cycle = 0
    }

    const startCycle = () => {
      if (reduced || cycle || hovering || !visible) return
      const step = () => {
        index = (index + 1) % ids.length
        activate(ids[index] ?? '')
      }
      if (!active) step()
      cycle = window.setInterval(step, CYCLE_MS)
    }

    const visibility = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting)
        if (visible) startCycle()
        else stopCycle()
      },
      { threshold: 0.3 },
    )
    visibility.observe(root)

    // 목록 항목(포인터·키보드 포커스)과 도면 노드(포인터)가 같은 서비스를 가리킨다
    const enter = (id: string) => {
      hovering = true
      window.clearTimeout(resume)
      stopCycle()
      index = ids.indexOf(id)
      activate(id)
    }
    const leave = () => {
      hovering = false
      window.clearTimeout(resume)
      resume = window.setTimeout(startCycle, RESUME_MS)
    }

    const cleanups: Array<() => void> = []
    const bind = (el: Element, id: string, focusable: boolean) => {
      const onEnter = () => enter(id)
      el.addEventListener('pointerenter', onEnter)
      el.addEventListener('pointerleave', leave)
      if (focusable) {
        el.addEventListener('focusin', onEnter)
        el.addEventListener('focusout', leave)
      }
      cleanups.push(() => {
        el.removeEventListener('pointerenter', onEnter)
        el.removeEventListener('pointerleave', leave)
        el.removeEventListener('focusin', onEnter)
        el.removeEventListener('focusout', leave)
      })
    }
    items.forEach((item) => bind(item, item.dataset.svc ?? '', true))
    nodes.forEach((node, id) => bind(node, id, false))

    return () => {
      visibility.disconnect()
      stopCycle()
      window.clearTimeout(resume)
      timers.forEach((timer) => window.clearTimeout(timer))
      cleanups.forEach((cleanup) => cleanup())
      packets.forEach((packet) => packet.getAnimations().forEach((animation) => animation.cancel()))
      setActive('')
    }
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
