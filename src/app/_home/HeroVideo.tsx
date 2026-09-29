'use client'

import { useEffect, useRef } from 'react'
import styles from '../home.module.css'

type NetworkInfo = { saveData?: boolean }

/**
 * 홈 히어로 배경 영상. 첫 프레임 포스터를 먼저 보이고,
 * 동작 줄이기·데이터 절약 설정이 꺼져 있을 때만 영상을 받아 재생한다.
 * 세로 모바일은 가운데를 잘라 만든 가벼운 영상을, 그 외에는 원본을 쓴다.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const saveData = (navigator as Navigator & { connection?: NetworkInfo }).connection?.saveData === true

    const apply = () => {
      if (reduced.matches || saveData) {
        video.pause()
        return
      }
      video.muted = true
      if (video.preload !== 'auto') {
        video.preload = 'auto'
        video.load()
      }
      video.play().catch(() => {
        /* 자동 재생이 막히면 포스터가 그대로 남는다 */
      })
    }

    apply()
    reduced.addEventListener('change', apply)
    return () => reduced.removeEventListener('change', apply)
  }, [])

  return (
    <video ref={ref} className={styles.heroVideo} muted loop playsInline preload="none" poster="/media/hero-poster.webp" tabIndex={-1}>
      {/* media를 모르는 구형 브라우저는 첫 번째(원본)를 고른다 */}
      <source src="/media/hero.webm" type="video/webm" media="(min-width: 768px), (orientation: landscape)" />
      <source src="/media/hero-portrait.webm" type="video/webm" />
    </video>
  )
}
