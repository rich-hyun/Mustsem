'use client'

/**
 * 관리자 회원 관리. 화면은 관리자에게만 열리지만(RequireAuth), 실제 권한 확인은 /api/admin/* 가 요청마다 한다.
 *
 * 현황(L1 수치) · 검색·필터 도구(L2) · 회원 표(L1) · 페이지 이동 · 상세 대화상자(상태·권한 변경, 삭제, 작업 기록)
 */
import { ArrowClockwiseIcon, CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { memberErrorMessage } from '@/components/auth/authErrors'
import { memberApi } from '@/components/auth/memberApi'
import { AnimatedValue } from '@/components/motion/AnimatedValue'
import { Badge, Spinner } from '@/components/ui/DataDisplay'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SelectField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Table, cell } from '@/components/ui/Table'
import { ROLE_LABELS, STATUS_LABELS, type MemberProfile, type MemberRole, type MemberStatus, type SessionUser } from '@/lib/account'
import { logDevError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { MemberDetail } from './MemberDetail'
import { roleTone, statusTone } from './tones'
import styles from './admin.module.css'

interface Stats {
  total: number
  active: number
  disabled: number
  recent: number
  admins: number
}

interface ListResponse {
  stats: Stats
  items: MemberProfile[]
  total: number
  page: number
  pages: number
  pageSize: number
  recentDays: number
}

interface Filters {
  q: string
  status: MemberStatus | 'ALL'
  role: MemberRole | 'ALL'
  from: string
  to: string
  sort: 'newest' | 'oldest'
  pageSize: number
}

const INITIAL: Filters = { q: '', status: 'ALL', role: 'ALL', from: '', to: '', sort: 'newest', pageSize: 20 }

export function MembersAdmin() {
  return <RequireAuth role="ADMIN">{(user) => <MembersBoard me={user} />}</RequireAuth>
}

function Counted({ value }: { value: number }) {
  const text = value.toLocaleString('ko-KR')
  return (
    <>
      <AnimatedValue value={text} />
      <span className="sr-only">{text}</span>
    </>
  )
}

function MembersBoard({ me }: { me: SessionUser }) {
  const [filters, setFilters] = useState<Filters>(INITIAL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const requestId = useRef(0)

  // 검색어는 입력이 멈춘 뒤 0.3초에 반영한다
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === search.trim() ? current : { ...current, q: search.trim() }))
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useMemo(() => {
    const params = new URLSearchParams({ sort: filters.sort, page: String(page), pageSize: String(filters.pageSize) })
    if (filters.q) params.set('q', filters.q)
    if (filters.status !== 'ALL') params.set('status', filters.status)
    if (filters.role !== 'ALL') params.set('role', filters.role)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    return params.toString()
  }, [filters, page])

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const response = await memberApi<ListResponse>(`/api/admin/users?${query}`)
      if (id !== requestId.current) return
      setData(response)
      if (response.page !== page) setPage(response.page)
    } catch (caught) {
      logDevError('admin:list', caught)
      if (id === requestId.current) setError(memberErrorMessage(caught, 'admin'))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [query, page])

  useEffect(() => {
    void load()
  }, [load])

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  const filtered = Boolean(filters.q || filters.status !== 'ALL' || filters.role !== 'ALL' || filters.from || filters.to)
  const stats = data?.stats

  return (
    <div className={styles.board}>
      {/* 회원 현황 */}
      <ul className={styles.stats} aria-label="회원 현황">
        {[
          { label: '전체 회원', value: stats?.total, hint: stats ? `관리자 ${stats.admins.toLocaleString('ko-KR')}명` : null },
          { label: '활성 회원', value: stats?.active, hint: null },
          { label: '비활성 회원', value: stats?.disabled, hint: null },
          { label: '최근 가입', value: stats?.recent, hint: `최근 ${data?.recentDays ?? 7}일` },
        ].map((item) => (
          <li key={item.label}>
            <Card padding="md" className={styles.stat}>
              <span className={styles.statLabel}>{item.label}</span>
              <span className={styles.statValue}>
                {item.value === undefined ? '-' : <Counted value={item.value} />}
                <span className={styles.statUnit}>명</span>
              </span>
              {item.hint && <span className={styles.statHint}>{item.hint}</span>}
            </Card>
          </li>
        ))}
      </ul>

      {/* 검색·필터 */}
      <Card elevation="raised" padding="md" as="section" aria-label="회원 검색과 필터" className={styles.tools}>
        <div className={styles.searchRow}>
          <TextField
            id="admin-search"
            label="검색"
            type="search"
            placeholder="이름 또는 이메일"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            trailing={<MagnifyingGlassIcon size={18} aria-hidden className={styles.searchIcon} />}
            trailingWidth={34}
          />
        </div>
        <div className={styles.filterRow}>
          <SelectField id="admin-status" label="상태" value={filters.status} onChange={(event) => update('status', event.target.value as Filters['status'])}>
            <option value="ALL">전체</option>
            <option value="ACTIVE">활성</option>
            <option value="DISABLED">비활성</option>
          </SelectField>
          <SelectField id="admin-role" label="권한" value={filters.role} onChange={(event) => update('role', event.target.value as Filters['role'])}>
            <option value="ALL">전체</option>
            <option value="USER">일반 회원</option>
            <option value="ADMIN">관리자</option>
          </SelectField>
          <TextField id="admin-from" label="가입일 (부터)" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} />
          <TextField id="admin-to" label="가입일 (까지)" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} />
          <SelectField id="admin-sort" label="정렬" value={filters.sort} onChange={(event) => update('sort', event.target.value as Filters['sort'])}>
            <option value="newest">가입일 최신순</option>
            <option value="oldest">가입일 오래된순</option>
          </SelectField>
        </div>
        <div className={styles.toolFoot}>
          <p className={styles.resultCount} aria-live="polite">
            {data ? `${filtered ? '검색 결과' : '전체'} ${data.total.toLocaleString('ko-KR')}명` : ' '}
          </p>
          <div className={styles.toolActions}>
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setFilters({ ...INITIAL, pageSize: filters.pageSize })
                  setPage(1)
                }}
              >
                필터 초기화
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
              <ArrowClockwiseIcon size={15} aria-hidden /> 새로 고침
            </Button>
          </div>
        </div>
      </Card>

      {flash && (
        <Notice tone="success" live>
          {flash}
        </Notice>
      )}
      {error && (
        <div role="alert">
          <Notice
            tone="danger"
            actions={
              <Button size="sm" variant="secondary" onClick={() => void load()}>
                다시 시도
              </Button>
            }
          >
            {error}
          </Notice>
        </div>
      )}

      {/* 회원 목록 */}
      {!data && loading ? (
        <div className={styles.placeholder} role="status">
          <Spinner size={22} /> 회원 목록을 불러오고 있습니다.
        </div>
      ) : data && data.items.length === 0 ? (
        <Card padding="lg" className={styles.empty}>
          <UsersThreeIcon size={36} aria-hidden className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{filtered ? '조건에 맞는 회원이 없습니다' : '아직 가입한 회원이 없습니다'}</p>
          <p className={styles.emptyText}>
            {filtered ? '검색어나 필터를 바꿔 보세요.' : '회원가입이 완료되면 이 목록에 나타납니다.'}
          </p>
        </Card>
      ) : data ? (
        <div className={styles.tableWrap} aria-busy={loading}>
          <Table caption="회원 목록" stackOnMobile>
            <thead>
              <tr>
                <th scope="col">회원</th>
                <th scope="col">회원 ID</th>
                <th scope="col">가입일</th>
                <th scope="col">최근 로그인</th>
                <th scope="col">상태</th>
                <th scope="col">권한</th>
                <th scope="col">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((member) => (
                <tr key={member.userId}>
                  <td data-label="회원">
                    <span className={styles.who}>
                      <span className={cell.strong}>
                        {member.name}
                        {member.userId === me.userId && <span className={styles.meTag}>나</span>}
                      </span>
                      <span className={styles.email} data-break="anywhere">
                        {member.email}
                      </span>
                    </span>
                  </td>
                  <td data-label="회원 ID" className={cell.mono} title={member.userId}>
                    {member.userId.slice(0, 8)}
                  </td>
                  <td data-label="가입일" className={cell.nowrap}>
                    {formatDate(member.createdAt)}
                  </td>
                  <td data-label="최근 로그인" className={cell.nowrap}>
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : '-'}
                  </td>
                  <td data-label="상태">
                    <Badge tone={statusTone(member.status)} pill>
                      {STATUS_LABELS[member.status]}
                    </Badge>
                    {!member.emailVerified && (
                      <Badge tone="warning" pill className={styles.badgeGap}>
                        인증 대기
                      </Badge>
                    )}
                  </td>
                  <td data-label="권한">
                    <Badge tone={roleTone(member.role)} pill>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </td>
                  <td data-label="관리" className={styles.actionCell}>
                    <Button size="sm" variant="secondary" onClick={() => setSelected(member.userId)} aria-label={`${member.name} 회원 상세`}>
                      상세
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {loading && (
            <div className={styles.overlay} aria-hidden>
              <Spinner size={22} />
            </div>
          )}
        </div>
      ) : null}

      {/* 페이지 이동 */}
      {data && data.total > 0 && (
        <nav className={styles.pager} aria-label="회원 목록 페이지">
          <SelectField
            id="admin-page-size"
            label="페이지당"
            className={styles.pageSize}
            value={String(filters.pageSize)}
            onChange={(event) => update('pageSize', Number(event.target.value))}
          >
            <option value="10">10명</option>
            <option value="20">20명</option>
            <option value="50">50명</option>
          </SelectField>
          <div className={styles.pages}>
            <Button size="sm" variant="ghost" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)} aria-label="이전 페이지">
              <CaretLeftIcon size={15} aria-hidden />
            </Button>
            {pageList(data.page, data.pages).map((item, index) =>
              item === null ? (
                <span key={`gap-${index}`} className={styles.pageGap} aria-hidden>
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={styles.pageButton}
                  aria-current={item === data.page ? 'page' : undefined}
                  disabled={loading}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <Button size="sm" variant="ghost" disabled={data.page >= data.pages || loading} onClick={() => setPage(data.page + 1)} aria-label="다음 페이지">
              <CaretRightIcon size={15} aria-hidden />
            </Button>
          </div>
        </nav>
      )}

      <MemberDetail
        userId={selected}
        meId={me.userId}
        onClose={() => setSelected(null)}
        onChanged={(text) => {
          setFlash(text)
          void load()
        }}
      />
    </div>
  )
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageList(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const list: Array<number | null> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) list.push(null)
  for (let page = start; page <= end; page++) list.push(page)
  if (end < total - 1) list.push(null)
  list.push(total)
  return list
}
