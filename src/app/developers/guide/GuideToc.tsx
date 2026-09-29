'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './guide.module.css'

interface TocItem {
  id: string
  label: string
}

/**
 * 가이드 목차: 지금 읽는 글을 표시하고, 표시줄이 해당 항목으로 미끄러져 옮겨 간다.
 * 스크롤 이벤트 대신 IntersectionObserver로 화면 가운데 띠에 걸린 글을 찾는다.
 */
export function GuideToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting)
        const current = items.find((item) => seen.get(item.id))
        if (current) setActive(current.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    for (const item of items) {
      const target = document.getElementById(item.id)
      if (target) observer.observe(target)
    }
    return () => observer.disconnect()
  }, [items])

  useLayoutEffect(() => {
    const list = listRef.current
    const bar = barRef.current
    if (!list || !bar) return
    const link = active ? list.querySelector<HTMLElement>(`a[href="#${active}"]`) : null
    if (!link) {
      bar.removeAttribute('data-on')
      return
    }
    bar.style.height = `${link.offsetHeight}px`
    bar.style.transform = `translateY(${link.offsetTop}px)`
    bar.setAttribute('data-on', '')
  }, [active])

  return (
    <nav className={styles.toc} aria-label="가이드 목차">
      <p className={styles.tocTitle}>목차</p>
      <div className={styles.tocTrack}>
        <span ref={barRef} className={styles.tocBar} aria-hidden />
        <ol ref={listRef} className={styles.tocList}>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
