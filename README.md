# MUSTSEM 5.5

엔터프라이즈 Web3 인프라 & 토큰화 API 플랫폼 **머스트셈 네트워크** 웹사이트.
기존 정적 HTML 사이트(`../mustsem`)와 같은 기능을 Next.js + TypeScript로 새로 만든 버전입니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 http://localhost:3000
npm run build      # 프로덕션 빌드 (.next/)
npm run preview    # 빌드 결과 실행 http://localhost:4173 (npm start는 3000번)
npm run typecheck  # 타입 검사
```

Node.js 20.9 이상이 필요합니다.

## 기술 스택

- Next.js 16 (App Router, Turbopack). 페이지는 모두 빌드 때 정적으로 만들어지고, 서버 함수는 `/api/market-data` 하나
- React 19, TypeScript (strict)
- ethers v6: 지갑 도구 페이지에서만 로드
- Supabase Auth: 로그인 흔적이 있거나 계정 페이지를 열 때만 SDK 로드
- Motion (`motion/react`): 스크롤 위치·포인터 좌표를 모션 값으로만 다루는 효과(헤더, 머리 빛, 자석 버튼, 절차 선)
- Chart.js: 대시보드 가치 변화 차트에서만, 데이터가 준비된 뒤 로드
- Phosphor Icons (`@phosphor-icons/react/ssr`)
- CSS Modules + 디자인 토큰(`src/app/globals.css`), 서체 Pretendard Variable

## 페이지

| 경로 | 내용 |
| --- | --- |
| `/` | 홈 (영상 히어로, 시작점 선택, 서비스 목록과 함께 움직이는 네트워크 구성도, 사양, 스크롤로 채워지는 도입 절차, FAQ) |
| `/network` | 전용 네트워크 생성 신청 · 지원 네트워크 목록(지갑에 추가) |
| `/bridge` | TMZ → wTMZ 래핑 → 승인 → wMST 브릿지 요청 |
| `/staking` | MST ↔ wMST 래핑, wMST 스테이킹·보상 |
| `/nft` · `/sbt` · `/rwa` | 네트워크 선택 → 코드 생성 · MetaMask 발행 (RWA는 IPFS 업로드 포함) |
| `/ipfs` | AI 모델 IPFS 보안 등록 API 소개 |
| `/developers` · `/developers/guide` | API 카탈로그 · API 가이드 |
| `/security` | 보안 아키텍처 |
| `/dashboard` | 머스트리 코인 가치 변화 차트(MST·BTC·QQQ, 1일/1주/1달) · 운영 지갑 잔액 모니터링 |
| `/api/market-data` | 차트용 일별 시세 (서버 함수, 30분 CDN 캐시) |
| `/login` · `/signup` · `/confirm` | 계정 (Supabase) |
| `/privacy` · `/terms` | 개인정보처리방침 · 이용약관 |

기존 주소(`/network.html`, `/api.html`, `/api-guide.html` 등)는 `next.config.ts`의 `redirects()`에서 새 주소로 영구 이동합니다.

## 설정 바꾸기

| 바꿀 것 | 파일 |
| --- | --- |
| 체인 RPC · 체인 ID · 심볼 | `src/config/networks.ts` |
| 컨트랙트 주소 · ABI | `src/config/contracts.ts` (미배포 네트워크는 `null`) |
| API 서버 · IPFS 게이트웨이 · Supabase URL/키 | `src/config/site.ts` |
| 메뉴 구조 | `src/config/navigation.ts` |
| 보안 헤더 · 리다이렉트 · `/fx` 프록시 | `next.config.ts` |
| 차트 시세 원본(Stooq·Yahoo·CoinGecko) | `src/app/api/market-data/route.ts` |

## 폴더 구조

```
src/
  app/                  라우트 (page.tsx = 서버 컴포넌트, *Tool.tsx 등 = 클라이언트)
  components/
    ui/                 버튼·카드·입력·탭·다이얼로그·표 등 공용 부품
    layout/             헤더(메가메뉴·지갑·계정)·모바일 메뉴·푸터
    marketing/          소개 페이지 블록 (특징·수치·CTA·FAQ·흐름도)
    motion/             모션 런타임(등장·스포트라이트)·수치 애니메이션·포인터 빛·자석 버튼
    wallet/ tx/ tools/  지갑 상태·서명·트랜잭션 상태·도구 레이아웃
    auth/ legal/        인증 상태·계정 폼·법적 문서
  config/               네트워크·컨트랙트·사이트·메뉴 설정
  content/              페이지 문구 데이터
  lib/                  형식·금액·오류·지갑(EIP-1193)·코드 생성 도우미
public/
  media/                hero.webm(원본) · hero-portrait.webm(세로 모바일용) · hero-poster.webp
  images/               브랜드 배경 이미지
```

## 배포 (Vercel)

`vercel.json`이 프레임워크를 **Next.js**로 지정합니다(기존 프로젝트 설정이 정적 HTML용이어도 이 값이 우선).
페이지는 정적 파일로, `/api/market-data`는 서버리스 함수로 배포되고, `next.config.ts`의 리다이렉트·보안 헤더·`/fx` 프록시가 함께 적용됩니다.
기존 저장소 루트의 `api/market-data.js`(Vercel 함수)는 이 프로젝트에서 `src/app/api/market-data/route.ts`로 옮겼습니다. Next.js 프로젝트에서는 이쪽이 같은 주소로 배포됩니다.

옮긴 함수는 원본과 달리 오류 원문(`errors`)을 응답에 싣지 않고 누락된 시세 이름(`missing`)만 알려 주며, 외부 사이트가 무료 프록시로 쓰지 못하도록 CORS를 열지 않습니다.

## 디자인·코드 규칙

`AGENTS.md`를 참고하세요 (디자인 시스템 규칙, 아이콘·오류 처리 규칙, 검증 방법).

## 운영 시 알아 둘 점 (2026-09-28 점검 기준)

- **Mustsem 체인(7601)에 컨트랙트가 없습니다.** `src/config/contracts.ts`의 wMST·스테이킹·NFT·SBT·RWA 주소 모두
  `eth_getCode`가 비어 있습니다(체인 1번 블록이 2025-12-18이라, 체인 재시작 후 재배포되지 않은 것으로 보임).
  화면은 이를 감지해 "컨트랙트 없음"으로 표시하고, 자산이 빈 주소로 송금되지 않도록 트랜잭션을 보내지 않습니다.
  재배포 후 `contracts.ts`의 주소만 바꾸면 됩니다.
- **JKK-TMZ·KukminBank·MDPCD·NABIZAM RPC가 응답하지 않습니다.** 해당 네트워크의 조회는 "조회 실패"/"네트워크 응답 없음"으로 표시됩니다.
- **네트워크 생성 신청 폼은 서버로 전송하지 않습니다** (기존 사이트와 동일하게 화면 안내만). 접수를 실제로 받으려면 저장처(예: Supabase 테이블)를 정해야 합니다.
- RWA 업로드 API(`/upload`)는 인증 없이 열려 있습니다 (서버 쪽 조치 필요).
- 이메일 인증 링크를 쓰게 되면 Supabase의 허용 리다이렉트 URL에 `https://www.mustsem.co.kr/confirm`을 추가하세요 (현재는 자동 확인이라 메일이 가지 않음).
- 개인정보처리방침은 기존 원문 그대로입니다. 실제 인증 수탁자(Supabase)가 목록에 없고, 꺼져 있는 Google 로그인을 안내하고 있어 검토가 필요합니다.
- 차트 시세: QQQ의 1순위 원본인 Stooq가 서버 요청에 403을 돌려줘 지금은 Yahoo Finance(2순위)로 받습니다. 기존 대시보드가 먼저 시도하던 자체 API(`api.mustree.kr/api/market-history`)는 404(미구현)라 호출하지 않습니다. 서버에 구현되면 `MarketChart.tsx`의 `loadSeries`에 한 단계 추가하면 됩니다.
- 브릿지 원본 체인(JKK-TMZ) RPC 주소 `jkk.mst2.site`는 DNS가 풀리지 않아 브라우저 콘솔에 연결 실패가 남습니다(화면은 "조회 실패"로 안내).
