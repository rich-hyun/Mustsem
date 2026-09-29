'use client'

import { useEffect, useState } from 'react'

/** 정적 빌드 시점의 연도로 먼저 그리고, 브라우저에서 올해로 맞춘다 */
export function CurrentYear({ initial }: { initial: number }) {
  const [year, setYear] = useState(initial)
  useEffect(() => setYear(new Date().getFullYear()), [])
  return <>{year}</>
}
