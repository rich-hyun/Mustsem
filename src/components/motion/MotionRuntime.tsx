'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * 사이트 전역 모션 런타임. 서버 컴포넌트가 단 속성을 읽어 상태만 바꾸고, 움직임은 CSS가 맡는다.
 * - data-reveal / data-reveal-group: 화면 밖에서 시작한 요소만 들어올 때 등장시킨다.
 * - data-live: 화면 밖으로 나간 반복 애니메이션을 멈춘다.
 * - data-spotlight: 마우스 위치를 --spot-x/--spot-y로 넘긴다 (정밀 포인터 전용).
 * 스크롤 이벤트 대신 IntersectionObserver만 쓴다.
 */
const REVEAL_SELECTOR = '[data-reveal], [data-reveal-group]'
const LIVE_SELECTOR = '[data-live]'

function revealAttr(el: Element) {
  return el.hasAttribute('data-reveal-group') ? 'data-reveal-group' : 'data-reveal'
}

export function MotionRuntime() {
  const pathname = usePathname()

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute(revealAttr(entry.target), 'shown')
          reveal.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    )

    const live = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.setAttribute('data-live', entry.isIntersecting ? 'on' : 'off')
    })

    const classify = (root: ParentNode) => {
      const viewport = window.innerHeight
      if (!reduced) {
        const targets: Element[] = []
        if (root instanceof Element && root.matches(REVEAL_SELECTOR)) targets.push(root)
        targets.push(...root.querySelectorAll(REVEAL_SELECTOR))
        for (const el of targets) {
          const attr = revealAttr(el)
          const state = el.getAttribute(attr)
          // 아직 들어오지 않은 요소는 관찰자가 바뀌어도(페이지 이동 중 재실행) 새 관찰자에 다시 맡긴다.
          // 이걸 건너뛰면 이전 관찰자와 함께 끊겨 영영 투명한 채로 남는다.
          if (state === 'pending') {
            reveal.observe(el)
            continue
          }
          if (state) continue // 'in' · 'shown': 이미 보이는 상태
          const rect = el.getBoundingClientRect()
          const visible = rect.top < viewport && rect.bottom > 0
          el.setAttribute(attr, visible ? 'in' : 'pending')
          if (!visible) reveal.observe(el)
        }
      }
      const lives: Element[] = []
      if (root instanceof Element && root.matches(LIVE_SELECTOR)) lives.push(root)
      lives.push(...root.querySelectorAll(LIVE_SELECTOR))
      for (const el of lives) live.observe(el)
    }

    classify(document)

    // 데이터를 받은 뒤 늦게 그려지는 클라이언트 영역도 같은 규칙을 따르게 한다
    let queued: Element[] = []
    let frame = 0
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) queued.push(node)
        })
      }
      if (queued.length && !frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0
          const batch = queued
          queued = []
          for (const node of batch) if (node.isConnected) classify(node)
        })
      }
    })
    const main = document.getElementById('main')
    if (main) mutations.observe(main, { childList: true, subtree: true })

    return () => {
      reveal.disconnect()
      live.disconnect()
      mutations.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [pathname])

  // 스포트라이트: 문서 한 곳에서 포인터를 받아 가장 가까운 대상에만 좌표를 넘긴다
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let target: HTMLElement | null = null
    let x = 0
    let y = 0
    let frame = 0

    const paint = () => {
      frame = 0
      if (!target) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--spot-x', `${x - rect.left}px`)
      target.style.setProperty('--spot-y', `${y - rect.top}px`)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches) return
      const hit = (event.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]') ?? null
      if (!hit) return
      target = hit
      x = event.clientX
      y = event.clientY
      if (!frame) frame = window.requestAnimationFrame(paint)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
