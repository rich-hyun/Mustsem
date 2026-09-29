'use client'

import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react/ssr'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { AuthCard } from '@/components/auth/AuthCard'
import { SERVICE_UNAVAILABLE } from '@/components/auth/authErrors'
import styles from '@/components/auth/Auth.module.css'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/DataDisplay'
import { logDevError } from '@/lib/errors'

type ConfirmState = { phase: 'checking' } | { phase: 'success' } | { phase: 'error'; message: string }

const REDIRECT_SECONDS = 3
const LINK_INVALID = '인증 링크가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.'

/** 인증 메일 링크로 들어온 URL에서 필요한 값만 꺼낸다 (토큰은 화면에 표시하지 않는다) */
function readCallbackParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  return {
    hasError: Boolean(hash.get('error') || hash.get('error_description') || query.get('error') || query.get('error_description')),
    accessToken: hash.get('access_token'),
    refreshToken: hash.get('refresh_token') ?? '',
    code: query.get('code'),
    hasCredentials: window.location.hash.length > 1 || window.location.search.length > 1,
  }
}

export function ConfirmStatus() {
  const router = useRouter()
  const { getClient } = useAuth()
  const [state, setState] = useState<ConfirmState>({ phase: 'checking' })
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    let cancelled = false
    // SDK가 초기화되며 해시를 지우기 전에 먼저 읽는다
    const params = readCallbackParams()
    const clearUrl = () => {
      if (params.hasCredentials) window.history.replaceState(null, '', window.location.pathname)
    }
    const finish = (next: ConfirmState) => {
      if (!cancelled) setState(next)
    }

    const run = async () => {
      if (params.hasError) {
        clearUrl()
        finish({ phase: 'error', message: LINK_INVALID })
        return
      }

      const client = await getClient().catch((error: unknown) => {
        logDevError('confirm:client', error)
        return null
      })
      if (!client) {
        finish({ phase: 'error', message: SERVICE_UNAVAILABLE })
        return
      }

      try {
        if (params.accessToken) {
          const { error } = await client.auth.setSession({ access_token: params.accessToken, refresh_token: params.refreshToken })
          clearUrl()
          finish(error ? { phase: 'error', message: LINK_INVALID } : { phase: 'success' })
          return
        }
        if (params.code) {
          const { error } = await client.auth.exchangeCodeForSession(params.code)
          clearUrl()
          finish(error ? { phase: 'error', message: LINK_INVALID } : { phase: 'success' })
          return
        }
        const { data, error } = await client.auth.getSession()
        clearUrl()
        if (error) {
          logDevError('confirm:session', error)
          finish({ phase: 'error', message: '인증 처리 중 오류가 발생했습니다.' })
          return
        }
        finish(
          data.session
            ? { phase: 'success' }
            : { phase: 'error', message: '인증 링크가 올바르지 않습니다. 이메일의 링크를 다시 확인해주세요.' },
        )
      } catch (error) {
        logDevError('confirm', error)
        clearUrl()
        finish({ phase: 'error', message: '인증 처리 중 오류가 발생했습니다.' })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [getClient])

  // 결과가 나오면 몇 초 뒤 로그인 페이지로 이동한다
  useEffect(() => {
    if (state.phase === 'checking') return
    if (seconds <= 0) {
      router.replace('/login')
      return
    }
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [state.phase, seconds, router])

  return (
    <AuthCard title="MUSTSEM 이메일 인증">
      {state.phase === 'checking' && (
        <div className={styles.result} role="status">
          <span className={styles.resultIcon} data-tone="progress">
            <Spinner size={28} />
          </span>
          <p className={styles.resultTitle}>인증 처리 중</p>
          <p className={styles.resultText}>이메일 인증을 확인하고 있습니다. 잠시만 기다려 주세요.</p>
        </div>
      )}

      {state.phase === 'success' && (
        <div className={styles.result}>
          <span className={styles.resultIcon} data-tone="success">
            <CheckCircleIcon size={36} weight="fill" aria-hidden />
          </span>
          <p className={styles.resultTitle} role="status">
            인증 완료!
          </p>
          <p className={styles.resultText}>
            이메일 인증이 성공적으로 완료되었습니다. MUSTSEM Web3 인프라 플랫폼에 오신 것을 환영합니다.
          </p>
          <p className={styles.countdown} aria-live="polite" aria-atomic="true">
            <strong>{Math.max(seconds, 0)}</strong>초 후 로그인 페이지로 이동합니다.
          </p>
          <Button href="/login" className={styles.resultAction}>
            바로 로그인하기
          </Button>
        </div>
      )}

      {state.phase === 'error' && (
        <div className={styles.result}>
          <span className={styles.resultIcon} data-tone="danger">
            <XCircleIcon size={36} weight="fill" aria-hidden />
          </span>
          <p className={styles.resultTitle}>인증 실패</p>
          <p className={styles.resultText} role="alert">
            {state.message}
          </p>
          <p className={styles.countdown} aria-live="polite" aria-atomic="true">
            <strong>{Math.max(seconds, 0)}</strong>초 후 로그인 페이지로 이동합니다.
          </p>
          <Button href="/login" className={styles.resultAction}>
            로그인 페이지로
          </Button>
        </div>
      )}
    </AuthCard>
  )
}
