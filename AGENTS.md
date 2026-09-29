<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MUSTSEM 5.5 — 작업 규칙

Next.js 16 App Router 사이트. 페이지는 모두 빌드 때 정적으로 만들어지고, 서버에서 도는 것은 Route Handler `src/app/api/market-data/route.ts`(대시보드 시세) 하나뿐이다. 리다이렉트·보안 헤더·`/fx` 프록시는 `next.config.ts`에 있다(`vercel.json`은 프레임워크 지정만).

## 설정은 한 곳에서
- 체인 RPC·체인 ID: `src/config/networks.ts`
- 컨트랙트 주소·ABI: `src/config/contracts.ts` (미배포 네트워크는 `null`)
- API 서버·IPFS 게이트웨이·Supabase: `src/config/site.ts`
- 메뉴 구조: `src/config/navigation.ts`

## 디자인 시스템 (`src/app/globals.css` 머리 주석이 원본)
- 라이트 테마, 틸→시안 로고. 틸은 포인트로만. 밝은 면의 주 버튼은 네이비(`variant="primary"`), 틸 채움(`accent`)은 어두운 면 전용.
- Shape lock: `--radius-xs/control/card/feature` + pill/원만.
- 고도 사다리: L0 평면 · L1 테두리(정보 면) · L2 그림자(조작 면: 폼·도구 단계) · L3 네이비(페이지당 1~2개). 테두리와 그림자를 한 면에 같이 쓰지 않는다(오버레이 제외).
- 히어로 뒤 섹션은 white/tint 교대. 절제된 타이포 — 큰 장식 숫자·비순차 번호 금지(순차 단계 번호는 허용).
- 한국어 조판: `word-break: keep-all`. 모바일에서 숨길 수 있는 `<br />` 앞에는 `{' '}`. 괄호 뒤 조사처럼 떨어지면 어색한 말덩이는 `.keep`으로 묶는다.
- 화면 글에 em-dash(—, –)를 쓰지 않는다. 쉼표·콜론·마침표로 바꾸고, 빈 값 표시는 `-`.
- 헤더(데스크톱)는 원본과 같은 배치·크기: 로고 | 메뉴 | 버튼을 `space-between`으로 두어 로고↔메뉴, 메뉴↔버튼 간격을 같게 한다. 메뉴 16px, 로고 21px·마크 34px(1079px 이하 20px·32px), 헤더 72px(1079px 이하 68px). "로고 옆 묶음"(가운데가 빔)과 "화면 정가운데"(버튼 묶음이 무거워 오른쪽으로 쏠려 보임)는 사용자가 보고 거절했다(2026-09-29).
  - 원본과 글자 크기를 비교할 때 주의: 원본의 드롭다운 버튼(플랫폼·개발자)은 웹 글꼴을 물려받지 않아 맑은 고딕으로 그려진다. 같은 15px여도 Pretendard보다 한글이 약 16% 크다.
  - 오른쪽 묶음은 원본 순서: `대시보드 | 지갑 연결 · 로그인 · 회원가입`. 대시보드는 데스크톱 개발자 메뉴에서 빼고(중복), 1079px 이하에서는 숨긴다(전체 메뉴 서랍의 개발자 묶음에 있음).
- API 카탈로그(`/developers`)의 아래쪽(제공 이력 · 제공 가능한 API · 배너)은 사용자 요청으로 원본 api.html 구성을 따른다(2026-09-29). 흰/옅은 면 교대 대신 옅은 면 한 톤 위에 흰 카드, 업종별 색 아이콘(색은 아이콘에만), 사례별 작은 카드, API 그룹별 카드와 틸→시안 아이콘, 흰 배너(`BannerRow tone="light"`). 검색·그룹 필터, 모바일 표 쌓기, 등장 모션은 새 버전에서 더한 것.

## 모션 (포인트 인터랙션)
- 서버 컴포넌트는 속성만 단다. 상태 변경은 `src/components/motion/MotionRuntime.tsx`(레이아웃에 1개)가 IntersectionObserver로 한다.
  - `data-reveal` 단독 등장, `data-reveal-group` 직계 자식 순차 등장. 처음부터 화면 안에 있던 요소는 움직이지 않는다.
  - `data-live`: 화면 밖에서는 반복 애니메이션을 멈춘다. `data-spotlight`: 마우스를 따라 테두리가 밝아지는 L1 면(`<Card spotlight>`).
- 숫자·코드 값은 `AnimatedValue`(카운트업·디코딩, aria-hidden이므로 sr-only 사본을 함께 둔다).
- 포인터를 따르는 효과는 Motion 모션 값만 쓴다(`PointerGlow`, `Magnetic`). `useState`로 좌표를 다루지 않는다.
  - 히어로 빛(`PointerGlow`)은 커서를 쫓지 않는다. 기준점과 커서 사이 절반에 튕김 없이(0.45초) 머물고, 들어오면 그 자리에서 나타나며, 벗어나면 그 자리에서 사라진다. "쉬는 자리"로 날아가게 하지 않는다(사용자가 정신없다고 한 동작, 2026-09-29).
- 스크롤 이벤트 리스너 금지: `useScroll`(Motion), IntersectionObserver, CSS 스크롤 연동만.
- transform·opacity(개별 `translate`·`scale` 포함)만 움직인다. 모든 효과는 `prefers-reduced-motion: reduce`에서 정지 화면이 된다.
- 움직임에는 이유가 있어야 한다(순서·상태 변화·조작 반응). 정보만 있는 면에 반복 애니메이션을 넣지 않는다.
- 모션을 바꾸면 새로 고침으로 연 페이지뿐 아니라 **사이트 안 링크로 이동한 페이지**에서도 끝까지 스크롤해 확인한다. 페이지를 옮길 때 관찰자가 교체되므로, 대기(`pending`) 중인 요소를 새 관찰자에 다시 맡기지 않으면 영영 투명하게 남는다(2026-09-28에 실제로 난 버그).

## 코드 규칙
- 아이콘은 Phosphor만: `import { WalletIcon } from '@phosphor-icons/react/ssr'` — `…Icon` 이름 사용(접미사 없는 이름은 deprecated). 서버·클라이언트 모두 `/ssr` 경로.
- 페이지: `page.tsx`는 서버 컴포넌트(`metadata` export), 상호작용은 같은 폴더의 `'use client'` 컴포넌트.
- 공용 부품을 먼저 찾는다: `src/components/ui`(Button, Card, Field, Tabs, Dialog, Table…), `marketing/Blocks`, `tools/*`, `wallet/*`, `tx/*`.
- 지갑 도구: `useSigner()(network)`가 연결→네트워크 전환→서명자를 처리, `useTx()`가 서명 대기→기록 대기→완료/실패 상태를 관리.
- 오류 노출 금지(CWE-209): 사용자에게는 `describeError()`/`UserFacingError` 고정 문구만. 콘솔은 `logDevError()`(개발 모드 전용). UI에 내부 엔드포인트·설정값을 표시하지 않는다.
- 포맷: 금액은 `formatUnitsExact`(bigint, 부동소수 금지), 입력 검증은 `parseAmount`.

## 검증
```bash
npx tsc --noEmit        # 타입
npm run build           # 프로덕션 빌드 (.next/)
npm run preview         # 빌드 결과 실행 (http://localhost:4173). 다시 빌드하면 서버도 재시작한다
```
