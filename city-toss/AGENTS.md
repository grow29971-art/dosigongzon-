# city-toss/ — 앱인토스(Apps in Toss) 미니앱

토스 앱 안에서 도는 도시공존 축소판. **본 앱(Next.js)의 래핑이 아니라 별도 Vite/React SPA**다 —
앱인토스는 정적 번들(.ait)만 받고 SSR·외부 URL·iframe·자사 로그인·토스페이 외 결제를 금지한다
(`docs/tracking/decisions/0008`). 백엔드(Supabase RLS·본 앱 API)만 공유한다.

## 범위 (v1)

지도(고양이 핀) → 고양이 상세 → 돌봄 기록. 커뮤니티·서클·쇼핑·고양이 등록은 없다.
위치 권한은 요청하지 않는다(본 앱과 같은 위치정보 무의무 아키텍처, decisions/0001).

## 구조

- `apps-in-toss.config.ts` — appName `dosigongzon`(콘솔 등록값과 일치 필수), 라이트 테마, 권한 0.
- `src/lib/supabase.ts` — supabase-js, 세션은 localStorage(iOS WebView 서드파티 쿠키 차단).
- `src/lib/auth.ts` — `TossAuth.login()` → 본 앱 `/api/toss/login` → `verifyOtp(magiclink)`.
- `src/lib/data.ts` — cats/care_logs 읽기·쓰기. 본 앱 repo와 컬럼·스냅샷 규칙 동일하게 유지할 것.
- `src/pages/` — Login · MapPage · CatDetail. `src/components/CatMap.tsx` — 카카오맵 + 클러스터러.

## 서버 측 (본 앱)

- `app/api/toss/login/route.ts` — 브릿지. `lib/toss-ait.ts` — mTLS 파트너 API·복호화.
- `next.config.ts` — `/api/toss/*` CORS를 tossmini.com 오리진에 허용.
- `box/supabase_toss_identities_20260917.sql` — userKey ↔ auth.users 매핑 테이블.
- Vercel 환경변수: `TOSS_AIT_CLIENT_CERT` · `TOSS_AIT_CLIENT_KEY` · `TOSS_AIT_DECRYPT_KEY` · `TOSS_AIT_AAD`.

## 명령

```
npm install
cp .env.example .env.local   # VITE_* 채우기
npm run dev                   # http://localhost:5173 (토스 로그인은 샌드박스/토스 앱에서만 동작)
npm run build                 # tsc + vite build + ait build → dosigongzon.ait
npx ait deploy --api-key ...  # 콘솔 API 키로 업로드 (또는 콘솔에서 .ait 직접 업로드 → QR 테스트)
```

## 규칙

- 위치 계약 그대로: 좌표는 DB 값(이미 오프셋)만 쓰고, 정확 위치를 받는 코드는 만들지 않는다.
- 외부 도메인 이동은 약관·개인정보처리방침 링크(`Device.openURL`)만. 그 외 외부 이동·iframe 금지.
- 다크 모드 없음(체크리스트: 라이트 고정). 진입 시 바텀시트·강제 액션 금지.
- 카카오맵 JS 키는 카카오 개발자 콘솔에 `dosigongzon.web.tossmini.com`·`dosigongzon.private-web.tossmini.com`
  (+ `apps`/`private-apps` 변형)이 등록돼 있어야 한다.
- 본 앱을 앱인토스 규칙에 맞춰 고치지 않는다(카카오 로그인·SSR·PG 유지). 이쪽이 맞춘다.
