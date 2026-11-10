'use client'

/**
 * 로그인 상태. 세션 토큰은 httpOnly 쿠키라 스크립트가 읽지 못하고, 서버(/api/auth/session)에 물어 복구한다.
 * 로그인 흔적(ms_auth 쿠키)이 없는 방문자는 서버에 묻지 않는다.
 * 어떤 회원 API든 401/403(disabled)을 받으면 즉시 로그아웃 상태로 바꾸고 이유를 남긴다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SessionUser } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { MemberApiError, memberApi, setUnauthenticatedHandler } from './memberApi'

export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in'
export type AuthUser = SessionUser
/** 로그아웃 상태가 된 이유 (화면 안내용) */
export type SignedOutReason = 'expired' | 'disabled' | null

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  reason: SignedOutReason
  /** 서버에 세션을 다시 묻는다 (권한 변경 반영 등) */
  refresh: () => Promise<AuthUser | null>
  /** 로그인 API가 성공한 직후 */
  signedIn: (user: AuthUser) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function hasSessionHint(): boolean {
  try {
    return document.cookie.split(';').some((part) => part.trim() === 'ms_auth=1')
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('unknown')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [reason, setReason] = useState<SignedOutReason>(null)

  const apply = useCallback((next: AuthUser | null) => {
    setUser(next)
    setStatus(next ? 'signed-in' : 'signed-out')
    if (next) setReason(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { user: next } = await memberApi<{ user: AuthUser }>('/api/auth/session')
      apply(next)
      return next
    } catch (error) {
      if (!(error instanceof MemberApiError && (error.code === 'unauthenticated' || error.code === 'disabled'))) {
        logDevError('auth:restore', error)
      }
      apply(null)
      return null
    }
  }, [apply])

  useEffect(() => {
    setUnauthenticatedHandler((code) => {
      setReason(code === 'disabled' ? 'disabled' : 'expired')
      apply(null)
    })
    if (hasSessionHint()) void refresh()
    else setStatus('signed-out')
    return () => setUnauthenticatedHandler(null)
  }, [apply, refresh])

  const signOut = useCallback(async () => {
    try {
      await memberApi('/api/auth/logout', { method: 'POST', body: {} })
    } catch (error) {
      logDevError('auth:signOut', error)
    }
    setReason(null)
    apply(null)
  }, [apply])

  const value = useMemo(
    () => ({ status, user, reason, refresh, signedIn: apply, signOut }),
    [status, user, reason, refresh, apply, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
