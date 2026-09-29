/**
 * Supabase 클라이언트 — 필요할 때만 SDK를 내려받아 한 개만 만든다.
 * 로그인 흔적이 없는 방문자는 SDK를 아예 받지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE } from '@/config/site'

let clientPromise: Promise<SupabaseClient> | null = null

export function loadSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    )
    // 네트워크 오류로 SDK를 못 받았다면 다음 호출에서 다시 시도한다
    clientPromise.catch(() => {
      clientPromise = null
    })
  }
  return clientPromise
}

/** supabase-js 기본 세션 저장 키 (sb-<project-ref>-auth-token) */
const STORAGE_KEY = `sb-${new URL(SUPABASE.url).hostname.split('.')[0]}-auth-token`

export function hasStoredSession(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
