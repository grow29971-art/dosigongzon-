# 시스템 구성

## 전체 위상

```
브라우저(PWA) / Android TWA(city-android, dosigongzon.com 래핑)
   │
   ▼
Vercel (Next.js 16 App Router, Turbopack) ── Sentry(오류 수집, redaction 적용)
   │  ├─ 서버 컴포넌트(RSC) ──────────┐
   │  ├─ API 라우트(app/api/*) ───────┤
   │  └─ 클라이언트 컴포넌트 ─────────┤
   ▼                                  ▼
Supabase (PostgreSQL + RLS + Auth + Storage + Realtime)
   │
   └─ 외부: Kakao Maps SDK(지도·장소검색) · Toss Payments(결제, 게이트 꺼짐)
           Cloudflare Turnstile(가입 봇 방어) · Google Gemini(AI 집사 챗봇)
           web-push/VAPID(푸시) · Meta Pixel+CAPI(광고 전환, 동의 게이트)
           Telegram Bot(운영자 알림) · Resend(이메일 다이제스트) · OpenWeatherMap(날씨)
```

- 배포 단위는 Vercel 하나. 별도 백엔드 서버 없음 — 모든 서버 로직은 RSC와 API 라우트.
- DB 접근 클라이언트는 4종 + 세션 갱신 프록시로 분리되며 각자 권한이 다르다:
  - `lib/supabase/client.ts` — 브라우저용(anon 키, RLS 적용, 로그인 세션 쿠키).
  - `lib/supabase/server.ts` — RSC/API용(요청 쿠키의 세션으로 RLS 적용).
  - `lib/supabase/anon.ts` — 쿠키 없는 익명 서버 조회(랜딩·ISR·SEO 페이지처럼 요청 컨텍스트에
    묶이면 안 되는 곳). 세션이 필요 없는 공개 조회는 server.ts가 아니라 이걸 쓴다.
  - `lib/supabase/service.ts` — service_role. 서버 전용, RLS 우회. API 라우트에서 검증 후에만 사용.
  - `lib/supabase/proxy.ts` — 루트 `proxy.ts`(미들웨어)가 쓰는 세션 갱신 경로.
- 비로그인 조회는 base 테이블이 아니라 공개 뷰를 탄다(대표: `cats_public_map`, `profiles_public`).
  anon에게 base `cats`는 컬럼 단위 권한만 열려 있어 임의 컬럼 필터가 거부된다.

## 코드 배치와 의존 방향

| 위치 | 역할 | 의존 방향 |
|---|---|---|
| `app/(main)/*` | 사용자 화면(지도·커뮤니티·마이·쇼핑·보호지침·관리자 등). `(main)` 레이아웃이 BottomNav 제공 | → lib, app/components |
| `app/` 루트 라우트 | 랜딩·로그인·가입·welcome·약관 등 셸 밖 화면 | → lib, app/components |
| `app/api/*` | 인증 콜백, 크론, 결제, 푸시, 챗봇 등 서버 엔드포인트 | → lib (service 클라이언트 사용 가능) |
| `app/components/*` | 공용 UI 컴포넌트 | → lib |
| `lib/*-repo.ts` | 도메인별 데이터 접근(repo 패턴). 클라이언트 컴포넌트가 직접 호출 | → lib/supabase |
| `lib/*-server.ts` | 서버 전용 조회(RSC용) | → lib/supabase/server |
| `box/` | SQL 마이그레이션·개발일지 보관함. **빌드에 포함되지 않음** | 없음 |
| `city-android/` | Bubblewrap TWA(웹뷰 아님) 빌드 유닛. 웹과 코드 공유 없음 | 독립 |
| `scripts/` | 일회성 운영 스크립트(백업·스크린샷·스크래핑) | 독립 |
| `tests/` | node --test 단위 테스트(mjs) | → lib |

- 방향 규칙: 화면 → repo → supabase 클라이언트. repo가 화면을 참조하는 역방향 없음.
- 홈(`app/(main)/page.tsx`)은 세션 유무로 분기: 비로그인 → `HomeLanding`(SEO 서버 렌더),
  로그인 → `HomeAuthed`(클라이언트 fetch 중심).

## 대표 흐름 — 돌봄 기록 1건

1. 클라이언트가 `lib/care-logs-repo.ts::createCareLog` 호출.
2. repo가 도배 제한 확인(분당 8·일 120) 후 `care_logs`에 insert — RLS가 본인·비정지 확인.
3. insert 성공 후 repo가 돌봄 레벨 EXP 적립 RPC(`add_cat_card_exp`, +10)를 fire-and-forget으로
   직접 호출한다 — DB 트리거 보장 경로가 아니라서 실패하면 EXP만 조용히 누락된다(기록은 유지).
4. 같은 방식의 후속: 고양이 주인에게 푸시(`/api/push/send`), 하트 누른 유저들에게 푸시
   (`/api/cats/notify-watchers` — 서버가 5분 내 실기록 존재·공개묘 여부·쿨다운 검증 후 발송),
   지도 마커 연출 이벤트 dispatch.
5. 실패해도 기록 자체는 성공으로 처리(푸시는 부가 경로).

## 대표 흐름 — 소셜 로그인

1. `/login` → Supabase OAuth(카카오/구글) → `/api/auth/callback`.
2. 콜백이 코드 교환, 첫 가입이면 닉네임 자동 생성·profiles 갱신·(동의 시) Meta CAPI 발사.
3. auth.users insert 시 DB 트리거 `handle_new_user`가 profiles 행 생성(닉네임 충돌 회피 내장).
4. 첫 소셜 가입자는 `/welcome`(슬라이드→알림 스텝→iOS 설치 안내→의도 선택) 경유 후 목적지로.
5. 실패는 전 단계에서 `auth_error_logs`에 적재(관리자 화면 `admin/auth-errors`에서 조회).

## 데이터 계층의 특기 사항

- 게시글·댓글·케어로그는 작성자 정보(author_name/avatar/level)를 **행에 스냅샷**으로 저장한다.
  프로필 변경 시 과거 글이 따라 바뀌지 않는 것이 의도된 동작.
- 좌표(lat/lng)는 등록 시점에 브라우저에서 ±444m 오프셋이 적용된 값만 DB에 저장된다(실좌표는
  시스템에 없음). 로그인 유저는 저장값 그대로, 비로그인은 추가 500m 결정적 퍼징을 얹어 받는다 —
  두 응답이 다르므로 좌표 응답을 익명 공유 캐시에 넣지 않는다.
- 크론(`app/api/cron/*`)은 Vercel cron이 `CRON_SECRET`으로 호출. 운영자 통지는 Telegram 봇.
