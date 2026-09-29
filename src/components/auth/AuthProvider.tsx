'use client'

/**
 * 로그인 상태. 저장된 세션이 있을 때만 Supabase SDK를 불러와 확인하고,
 * 로그인·회원가입·인증 페이지가 SDK를 쓰는 순간 구독을 시작해 헤더에 즉시 반영한다.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { logDevError } from '@/lib/errors'
import { hasStoredSession, loadSupabase } from '@/lib/supabase'

export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in'

export interface AuthUser {
  email: string
  name: string | null
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  /** SDK를 불러오고(최초 1회) 세션 변화를 구독한 클라이언트 */
  getClient: () => Promise<SupabaseClient>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toUser(session: Session | null): AuthUser | null {
  const user = session?.user
  if (!user) return null
  const fullName = user.user_metadata?.full_name
  return { email: user.email ?? '', name: typeof fullName === 'string' && fullName ? fullName : null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('unknown')
  const [user, setUser] = useState<AuthUser | null>(null)
  const subscribed = useRef(false)

  const apply = useCallback((session: Session | null) => {
    const next = toUser(session)
    setUser(next)
    setStatus(next ? 'signed-in' : 'signed-out')
  }, [])

  const getClient = useCallback(async () => {
    const client = await loadSupabase()
    if (!subscribed.current) {
      subscribed.current = true
      client.auth.onAuthStateChange((_event, session) => apply(session))
      const { data } = await client.auth.getSession()
      apply(data.session)
    }
    return client
  }, [apply])

  useEffect(() => {
    if (!hasStoredSession()) {
      setStatus('signed-out')
      return
    }
    getClient().catch((error: unknown) => {
      logDevError('auth:restore', error)
      setStatus('signed-out')
    })
  }, [getClient])

  const signOut = useCallback(async () => {
    try {
      const client = await getClient()
      await client.auth.signOut()
    } catch (error) {
      logDevError('auth:signOut', error)
    }
    apply(null)
  }, [getClient, apply])

  const value = useMemo(() => ({ status, user, getClient, signOut }), [status, user, getClient, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
