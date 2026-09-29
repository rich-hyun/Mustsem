'use client'

import { useEffect, useRef } from 'react'
import { cx } from '@/lib/cx'

/**
 * 수치 강조: 숫자는 0부터 세어 올리고(10K, 99.9%, 40,000), 기호형 값은 글자를 풀어 낸다(EVM, 24/7).
 * 서버 HTML에는 최종값이 그대로 있어 스크립트가 없어도 읽을 수 있다.
 * 보조기술에는 최종값만 전달되도록 호출하는 쪽에서 sr-only 사본을 둔다 (이 요소는 aria-hidden).
 */
type Mode = 'count' | 'decode'

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+/<>'
const COUNT_MS = 1400
const DECODE_MS = 900
const DECODE_TICK_MS = 45

interface CountSpec {
  prefix: string
  target: number
  decimals: number
  grouped: boolean
  suffix: string
}

/** '10K' '99.9%' '40+' '1,234.5 MST' → 숫자 부분과 앞뒤 글자. 뒤에 숫자가 또 있으면('24/7') 세지 않는다 */
function parseCount(value: string): CountSpec | null {
  const match = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(value)
  if (!match) return null
  const [, prefix = '', raw = '', suffix = ''] = match
  const plain = raw.replace(/,/g, '')
  const decimals = plain.includes('.') ? (plain.split('.')[1]?.length ?? 0) : 0
  return { prefix, target: Number(plain), decimals, grouped: raw.includes(','), suffix }
}

function formatCount(spec: CountSpec, n: number) {
  const fixed = spec.grouped
    ? n.toLocaleString('en-US', { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals })
    : n.toFixed(spec.decimals)
  return `${spec.prefix}${fixed}${spec.suffix}`
}

function scramble(value: string, resolved: number) {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const char = value[i] ?? ''
    out += i < resolved || !/[A-Za-z0-9]/.test(char) ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
  }
  return out
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function AnimatedValue({ value, mode, className }: { value: string; mode?: Mode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  // 한 번 보여 준 뒤 값이 바뀌면(새로고침 등) 다시 세지 않고 바로 바꾼다
  const played = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // React가 가진 텍스트 노드를 그대로 고쳐 써서 이후 렌더링과 어긋나지 않게 한다
    const write = (text: string) => {
      const node = el.firstChild
      if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text
      else el.textContent = text
    }
    const done = () => {
      write(value)
      el.setAttribute('data-anim-state', 'done')
    }
    if (played.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done()
      return
    }

    const spec = mode === 'decode' ? null : parseCount(value)
    const kind: Mode = spec ? 'count' : 'decode'
    // 폭을 최종값 기준으로 고정해 세는 동안 옆 글자가 밀리지 않게 한다
    el.style.minWidth = `${el.getBoundingClientRect().width}px`
    write(spec ? formatCount(spec, 0) : scramble(value, 0))
    el.setAttribute('data-anim-state', 'ready')

    let frame = 0
    let start = 0
    let lastTick = 0

    const tick = (now: number) => {
      if (!start) start = now
      const elapsed = now - start
      if (kind === 'count' && spec) {
        const t = Math.min(elapsed / COUNT_MS, 1)
        write(formatCount(spec, spec.target * easeOutExpo(t)))
        if (t < 1) frame = window.requestAnimationFrame(tick)
        else done()
        return
      }
      if (elapsed >= DECODE_MS) {
        done()
        return
      }
      if (now - lastTick >= DECODE_TICK_MS) {
        lastTick = now
        write(scramble(value, Math.floor((elapsed / DECODE_MS) * value.length)))
      }
      frame = window.requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        played.current = true
        frame = window.requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      write(value)
    }
  }, [value, mode])

  return (
    <span ref={ref} className={cx('tabular', className)} data-anim-value="" aria-hidden style={{ display: 'inline-block' }}>
      {value}
    </span>
  )
}
