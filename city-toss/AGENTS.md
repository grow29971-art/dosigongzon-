# city-toss/ — 앱인토스(Apps in Toss) 미니앱

토스 앱 안에서 도는 도시공존. **본 앱(Next.js)의 화면·repo를 그대로 번들하는 Vite/React SPA**다 —
앱인토스는 정적 번들(.ait)만 받고 SSR·외부 URL·iframe·자사 로그인·토스페이 외 결제를 금지한다
(`docs/tracking/decisions/0008`). 백엔드(Supabase RLS·본 앱 API)는 공유한다.

## 범위 (v2, 2026-09-21)

본 앱 전 화면 중 앱인토스 규칙상 못 넣는 것만 뺐다. **제외**: 쇼핑(`/shop/*`, 토스페이 IAP 별도 계약 전엔 불가),
쪽지·동네 채팅·서클 채팅(`/messages`, `/circle/*`, `/mypage/circle` — "채팅 필수 사항" 미충족), 웹푸시,
본 앱 로그인/가입/온보딩(`/login`·`/signup`·`/welcome`·`/onboarding`), 관리자. 제외 경로 목록은
`src/shims/miniapp-routes.ts` 한 곳이고, 라우터·Link·router.push 모두 이 목록으로 홈으로 돌린다.
위치 권한은 요청하지 않는다(위치정보 무의무 아키텍처, decisions/0001).

## 구조 — 본 앱 코드를 어떻게 돌리나

- `vite.config.ts` — `@` → 저장소 루트(`../app`, `../lib`)로 alias. Next 전용 모듈은 `src/shims/`로 치환:
  `next/link`(react-router Link, 외부 http는 `Device.openURL`) · `next/navigation`(useRouter·usePathname·
  useSearchParams·useParams·notFound·redirect) · `next/image`(`<img>`) · `next/dynamic`(React.lazy) ·
  `next/script` · `next/cache`(통과) · `@sentry/nextjs`(콘솔) · `server-only`(빈 모듈) ·
  `@/lib/supabase/{client,server,anon}`(전부 `src/lib/supabase.ts`의 localStorage 세션 클라이언트 하나) ·
  `@/lib/supabase/service`·`next/headers`(import 자체가 throw — 서버 전용 코드가 번들에 들어오면 즉시 터진다) ·
  `@/lib/html-sanitize-server`(DOMParser 버전). `process.env.NEXT_PUBLIC_*`는 본 앱 `.env.local`에서 읽어 define.
- `src/ServerPage.tsx` — async 서버 컴포넌트 페이지 어댑터. 서버 페이지는 훅이 없으므로 **함수로 호출**해
  결과 JSX를 그린다(`params`/`searchParams`는 Promise로 전달). notFound/redirect는 shim이 던지는 예외.
- `src/AsyncNode.tsx` — 페이지 안에 박힌 async 서버 컴포넌트(홈 슬롯 3종) 어댑터. `src/pages/Home.tsx`가 사용.
- `src/App.tsx` — 라우트 표. `C()` = "use client" 페이지, `S()` = 서버 페이지, `P()` = `use(params)` 패턴 클라 페이지.
  `(main)/layout.tsx`의 게이트류(Welcome·FeatureTour·Announcement·Push*)는 싣지 않고 BottomNav만 싣는다.
- `src/lib/api-bridge.ts` — `window.fetch` 패치: `/api/...` → `https://dosigongzon.com/api/...` + `Authorization: Bearer <access_token>`.
  본 앱 `lib/supabase/server.ts`가 Bearer를 세션 쿠키로 합성해 인식하고, `next.config.ts`가 tossmini 오리진에 CORS를 연다.
- `src/lib/auth.ts` — `TossAuth.login()` → 본 앱 `/api/toss/login` → `verifyOtp(magiclink)`. `src/pages/Login.tsx`가 진입 화면.
- 본 앱 쪽 표식: `lib/miniapp.tsx`의 `isMiniApp()`(main.tsx가 `window.__DOSIGONGZON_MINIAPP__` 세움)·`hideInMiniApp()`.
  쇼핑 탭·SendDMButton·지도 채팅 FAB·Push*·ShopPreviewStrip·MyCircleQuickEntry·InviteSection이 이걸로 숨는다.
- 의존성: react·react-dom은 본 앱과 **같은 버전으로 고정**(`-E`)해야 한다 — 다르면 "Incompatible React versions"로 부팅 실패.
  `resolve.dedupe`가 react·react-dom·supabase-js를 한 벌로 묶는다.

## 서버 측 (본 앱)

- `app/api/toss/login/route.ts` — 브릿지. `lib/toss-ait.ts` — mTLS 파트너 API·복호화.
- `lib/supabase/server.ts` — Bearer 세션 합성. `next.config.ts` — `/api/:path*` CORS(tossmini 4종).
- `box/supabase_toss_identities_20260917.sql` — userKey ↔ auth.users 매핑 테이블(실행 완료).
- Vercel 환경변수: `TOSS_AIT_CLIENT_CERT` · `TOSS_AIT_CLIENT_KEY` · `TOSS_AIT_DECRYPT_KEY` · `TOSS_AIT_AAD`.

## 명령

```
npm install
cp .env.example .env.local   # VITE_* 채우기 (NEXT_PUBLIC_*는 ../.env.local에서 자동)
npm run dev                   # http://localhost:5173 — 토스 로그인은 토스 앱에서만. 렌더 점검은 ?dev_anon=1(세션 없이, 공개 데이터만)
node scripts/dev-session.mjs <이메일>   # 로컬 세션 링크(?dev_token_hash=) — service_role은 로컬 Node에서만
npm run build                 # tsc(본 앱 소스 포함) + vite build + ait build → dosigongzon.ait
```

## 배포 모델 — 무엇이 자동이고 무엇이 심사인가

- **자동 반영**: DB 데이터와 본 앱 `/api/*`(AI 집사·토스 로그인 브릿지·결제 서버 로직). 본 앱 배포 즉시 토스 사용자에게 적용.
- **번들 업데이트 필요(심사 영업일 ~3일)**: 화면 코드(`app/`·`lib/`의 클라이언트 부분). 토스가 `.ait`를 자기 서버에 호스팅하므로
  본 앱을 고쳐도 토스 쪽 화면은 그대로다. `npm run build` → 콘솔 버전 등록 → QR 테스트 1회 → 검토 요청 → 승인 → 출시.
- 그래서 **API 응답 형태를 바꾸는 배포는 하위 호환 필수** — 구버전 번들이 토스에서 계속 돈다. 필드 삭제·의미 변경 금지, 추가만.
- 웹 배포마다 번들을 올리지 않는다. 화면 변화가 크거나 토스 사용자에게 필요한 버그 픽스일 때만 묶어서.

## 규칙

- 본 앱을 앱인토스 규칙에 맞춰 고치지 않는다(카카오 로그인·SSR·PG 유지). 미니앱 분기는 `isMiniApp()` 한 줄로만.
- 새 화면을 본 앱에 추가하면 `src/App.tsx` 라우트 표에도 한 줄 추가한다. 서버 전용 import(service·headers)가
  섞이면 빌드는 되지만 런타임에 그 화면이 throw — `npm run build` 뒤 dev로 열어 확인.
- 위치 계약 그대로: 좌표는 DB 값(이미 오프셋)만 쓰고, 정확 위치를 받는 코드는 만들지 않는다.
- 외부 도메인 이동은 `Device.openURL`만(Link shim이 http(s)를 자동으로 그리로 보냄). iframe 금지.
- 다크 모드 없음(체크리스트: 라이트 고정). 진입 시 바텀시트·강제 액션 금지.
- 카카오맵 JS 키는 카카오 개발자 콘솔에 `dosigongzon.web.tossmini.com`·`dosigongzon.private-web.tossmini.com`
  (+ `apps`/`private-apps` 변형)이 등록돼 있어야 한다.
