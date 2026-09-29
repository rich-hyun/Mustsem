'use client'

import {
  BuildingsIcon,
  CoinsIcon,
  HardDrivesIcon,
  ImageSquareIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
  UsersThreeIcon,
  XIcon,
} from '@phosphor-icons/react/ssr'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { API_GROUPS, type ApiEndpoint, type ApiGroupId, type HttpMethod } from '@/content/api-catalog'
import { Button } from '@/components/ui/Button'
import { Badge, type BadgeTone } from '@/components/ui/DataDisplay'
import { Table, cell } from '@/components/ui/Table'
import styles from './developers.module.css'

const METHOD_TONE: Record<HttpMethod, BadgeTone> = {
  GET: 'accent',
  POST: 'info',
  PUT: 'warning',
  DELETE: 'danger',
}

const GROUP_ICON = {
  nft: ImageSquareIcon,
  sbt: SealCheckIcon,
  rwa: BuildingsIcon,
  token: CoinsIcon,
  governance: UsersThreeIcon,
  node: HardDrivesIcon,
} satisfies Record<ApiGroupId, unknown>

type GroupFilter = 'all' | ApiGroupId

function matches(endpoint: ApiEndpoint, query: string): boolean {
  if (!query) return true
  const haystack = [endpoint.name, endpoint.description, endpoint.method, endpoint.path, ...endpoint.params].join(' ').toLowerCase()
  return query.split(/\s+/).every((word) => haystack.includes(word))
}

/** 제공 API 탐색기 — 검색어와 그룹으로 좁혀 본다. 정적 HTML에는 전체 목록이 그대로 들어간다. */
export function ApiExplorer() {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<GroupFilter>('all')
  // 그룹을 바꾼 뒤부터 결과가 새로 들어오는 전환을 보여 준다 (첫 화면은 정적)
  const [touched, setTouched] = useState(false)
  const normalized = useDeferredValue(query).trim().toLowerCase()

  // 검색어 기준 그룹별 일치 수 (그룹 선택과 무관하게 칩에 표시)
  const counts = useMemo(() => {
    const byGroup = Object.fromEntries(
      API_GROUPS.map((g) => [g.id, g.endpoints.filter((e) => matches(e, normalized)).length]),
    ) as Record<ApiGroupId, number>
    const all = Object.values(byGroup).reduce((sum, n) => sum + n, 0)
    return { all, byGroup }
  }, [normalized])

  const visible = useMemo(
    () =>
      API_GROUPS.filter((g) => group === 'all' || g.id === group)
        .map((g) => ({ ...g, endpoints: g.endpoints.filter((e) => matches(e, normalized)) }))
        .filter((g) => g.endpoints.length > 0),
    [group, normalized],
  )

  const total = visible.reduce((sum, g) => sum + g.endpoints.length, 0)
  const trimmed = query.trim()

  const selectGroup = (next: GroupFilter) => {
    setTouched(true)
    setGroup(next)
  }

  const reset = () => {
    setQuery('')
    selectGroup('all')
  }

  return (
    <div className={styles.explorer}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label htmlFor={searchId} className="sr-only">
            API 검색
          </label>
          <MagnifyingGlassIcon className={styles.searchIcon} size={18} aria-hidden />
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            placeholder="API 이름, 엔드포인트, 파라미터 검색"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="검색어 지우기">
              <XIcon size={16} aria-hidden />
            </button>
          )}
        </div>
        <p className={styles.resultCount} aria-live="polite">
          {trimmed ? `‘${trimmed}’ 검색 결과 ${total}개` : `${total}개 API`}
        </p>
      </div>

      <div className={styles.chips} role="group" aria-label="API 그룹">
        <button type="button" className={styles.chip} aria-pressed={group === 'all'} onClick={() => selectGroup('all')}>
          전체
          <span className={styles.chipCount}>{counts.all}</span>
        </button>
        {API_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={styles.chip}
            aria-pressed={group === g.id}
            onClick={() => selectGroup(g.id)}
            disabled={counts.byGroup[g.id] === 0 && group !== g.id}
          >
            {g.short}
            <span className={styles.chipCount}>{counts.byGroup[g.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {trimmed ? `‘${trimmed}’와(과) 일치하는 API가 없습니다.` : '선택한 그룹에 표시할 API가 없습니다.'}
          </p>
          <Button variant="secondary" size="sm" onClick={reset}>
            검색 초기화
          </Button>
        </div>
      ) : (
        <div key={group} className={styles.groups} data-animate={touched ? '' : undefined}>
          {visible.map((g) => {
            const Icon = GROUP_ICON[g.id]
            const headingId = `${g.id}-api-title`
            return (
              <section key={g.id} id={`${g.id}-api`} className={styles.group} aria-labelledby={headingId}>
                <header className={styles.groupHead}>
                  <span className={styles.groupIcon} aria-hidden>
                    <Icon size={26} />
                  </span>
                  <div className={styles.groupText}>
                    <h3 id={headingId} className={styles.groupTitle}>
                      {g.title}
                    </h3>
                    <p className={styles.groupDesc}>{g.description}</p>
                  </div>
                </header>
                <Table
                  caption={`${g.title} 목록: 이름, 설명, 메서드, 엔드포인트, 주요 파라미터`}
                  stackOnMobile
                  className={styles.groupTable}
                >
                  {/* 그룹마다 표가 따로 있어도 열 위치가 같도록 너비를 고정한다.
                      가장 긴 엔드포인트(/v1/policies/transfer-restriction)가 1440px에서 한 줄에 들어가는 비율 */}
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '26%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">API 이름</th>
                      <th scope="col">설명</th>
                      <th scope="col">메서드</th>
                      <th scope="col">엔드포인트</th>
                      <th scope="col">주요 파라미터</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.endpoints.map((endpoint) => (
                      <tr key={`${endpoint.method} ${endpoint.path}`}>
                        <td data-label="API 이름" className={cell.strong}>
                          {endpoint.name}
                        </td>
                        <td data-label="설명">{endpoint.description}</td>
                        <td data-label="메서드">
                          <Badge tone={METHOD_TONE[endpoint.method]} mono>
                            {endpoint.method}
                          </Badge>
                        </td>
                        <td data-label="엔드포인트">
                          <code className={styles.endpoint}>{endpoint.path}</code>
                        </td>
                        <td data-label="주요 파라미터">
                          <span className={styles.params}>
                            {endpoint.params.map((param) => (
                              <code key={param} className={styles.param}>
                                {param}
                              </code>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
