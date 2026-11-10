'use client'

/**
 * 보호 페이지 문지기 (화면 쪽). 실제 차단은 서버 API가 요청마다 한다. 이 부품은 로그인하지 않은 방문자를
 * 로그인 화면으로 보내고, 관리자 페이지에서 일반 회원에게 권한 안내를 보여 줄 뿐이다.
 */
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/DataDisplay'
import { Notice } from '@/components/ui/Notice'
import { useAuth, type AuthUser } from './AuthProvider'
import styles from './Auth.module.css'

interface RequireAuthProps {
  role?: 'ADMIN'
  children: (user: AuthUser) => ReactNode
}

export function RequireAuth({ role, children }: RequireAuthProps) {
  const { status, user, reason } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status !== 'signed-out') return
    const params = new URLSearchParams({ next: pathname })
    if (reason) params.set('reason', reason)
    router.replace(`/login?${params.toString()}`)
  }, [status, reason, pathname, router])

  if (status !== 'signed-in' || !user) {
    return (
      <div className={styles.gate} role="status">
        <Spinner size={22} />
        <span>{status === 'unknown' ? '로그인 상태를 확인하고 있습니다.' : '로그인 화면으로 이동합니다.'}</span>
      </div>
    )
  }

  if (role === 'ADMIN' && user.role !== 'ADMIN') {
    return (
      <Notice
        tone="warning"
        title="관리자만 볼 수 있는 페이지입니다"
        actions={
          <Button href="/account" size="sm" variant="secondary">
            내 정보로 이동
          </Button>
        }
      >
        회원 관리 권한이 필요합니다. 권한이 필요하면 사이트 관리자에게 요청해주세요.
      </Notice>
    )
  }

  return <>{children(user)}</>
}
