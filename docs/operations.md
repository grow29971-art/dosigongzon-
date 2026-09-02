# 운영 절차

## 개발 환경

전제: Node 24+, npm, git. 이 저장소는 `C:\Users\grow2\city`.

```bash
npm install          # 의존성 설치
npm run dev          # 개발 서버 (localhost:3000)
npx tsc --noEmit     # 타입 체크 — 배포 전 필수 게이트
npm test             # 단위 테스트 (node --test tests/*.test.mjs)
npx eslint <파일>    # 필요 시 린트
```

- `npm run build`는 이 PC에서 실행 불가(보안 정책이 SWC 바이너리 차단). 빌드 검증은 배포
  파이프라인(Vercel)이 대신한다 — 로컬에서는 tsc·eslint·테스트까지만.

## 배포

```bash
git add <파일> ; git commit -m "fix: ..." ; git push
```

1. `main`에 push하면 Vercel이 자동 배포한다(GitHub 연동). 별도 명령 없음.
2. 성공 확인: `curl -s https://api.github.com/repos/grow29971-art/dosigongzon-/commits/<sha>/status`
   → `state`가 `success`면 완료(빌드 1~3분). `failure`면 Vercel 대시보드에서 로그 확인.
3. 반영 확인: `curl -s https://dosigongzon.com/...`로 변경 문구·상태코드 실측.
- Vercel CLI 직접 배포는 비상시에만: 한글 PC명 때문에 `box/vercel-hostpatch.cjs`(os.hostname
  교체)를 `node -r`로 물려 전역 설치 경로의 CLI를 직접 실행해야 한다.

## DB 마이그레이션

1. `box/supabase_[기능명]_migration.sql` 작성 — 머리에 실행 위치·Chrome 번역 OFF 경고,
   꼬리에 검증 쿼리와 롤백 SQL 주석.
2. 사장님이 Supabase Dashboard → SQL Editor에서 실행(에이전트가 대신 실행하지 않는다).
3. 실행 후 REST 프로브로 반영 실측(service 키 + anon 키 이중). 프로브 스크립트는 세션
   스크래치에 node로 작성하는 게 관례(.env.local 파싱 시 따옴표·`\n` 제거 필수).

## 환경변수 (역할별)

| 변수 | 역할 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 접속(클라이언트 공개) |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS 우회 서버 키 — 서버 전용 |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` / `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 지도·공유(공용) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 가입 봇 방어 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | 웹푸시 |
| `NEXT_PUBLIC_META_PIXEL_ID` / `META_PIXEL_ACCESS_TOKEN` | 광고 전환(후자 미설정 시 CAPI silent skip) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini(AI 집사·이미지 변환) — 무료 쿼터 일 20회 |
| `CRON_SECRET` / `CRON_DISPATCH_ORIGIN` | `/api/cron/*` 호출 인증 / 크론 팬아웃 자기호출 origin |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ADMIN_CHAT_ID` | 운영자 텔레그램 알림(미설정 시 silent skip) |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` / `TOSS_WEBHOOK_SECRET` | 토스 결제. 현재 테스트 키 — **테스트 키로 결제를 켜지 않는다**, 라이브 키·웹훅 시크릿은 심사 승인 후 |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | 이메일 다이제스트 발송 |
| `OPENWEATHERMAP_API_KEY` | 날씨(홈 카드·한파 경보 크론) |
| `PII_ENC_KEY_CURRENT` / `PII_ENC_KEY_PREVIOUS` / `PII_INDEX_KEY` | 개인정보 암호화·키 회전(환불 계좌 등) |
| `KAKAO_REST_API_KEY` / `LOCALDATA_API_KEY` | 카카오 REST(주소 변환)·지방행정 인허가 데이터(병원·약국 동기화) |
| `NEXT_PUBLIC_FF_CJ_*` | 코어 저니 기능 플래그군(단계별 온오프) |

- 관리는 Vercel Dashboard(프로덕션)·`.env.local`(로컬). 등록 시 값 끝 개행 혼입 주의.

## 정기 작업(크론)

- Vercel cron이 `/api/cron/*`을 `CRON_SECRET`으로 호출. **전체 목록(16개)은 `vercel.json`이
  단일 소스**다 — 대표 예: 건강 경보 푸시, 주간 다이제스트, 발주 다이제스트(텔레그램), 결제 대사,
  약국·병원 동기화, 스토리지 다이어트(오래된 로그 정리 — auth_error_logs 90일 등), 예약 푸시.
  크론 결함은 과거 두 번(팬아웃 origin, 실패 200 삼킴) 수리 이력이 있으니 새 크론은 실패를
  200으로 삼키지 말 것.

## 운영 데이터 확인(프로브)

- 가입·케어·퍼널 등 지표는 REST HEAD + `Prefer: count=exact`로 실측한다. 예:
  `/rest/v1/profiles?select=id&created_at=gte.<ISO>` → `content-range` 헤더가 카운트.
- 로그인 실패 분석: `auth_error_logs`를 provider·stage·error_code·UA로 집계(관리자 화면
  `/admin/auth-errors`에도 있음).

## 백업·보조 스크립트

- DB 백업: `node scripts/backup-db.mjs`. 스크린샷 생성·약국 스크래핑 등 일회성 도구도
  `scripts/`에 있다(운영 필수 아님).

## Android TWA (city-android)

- Bubblewrap 기반 TWA로 dosigongzon.com을 래핑해 Play 스토어에 출시돼 있다. 웹 배포만으로 앱
  내용은 갱신되며, TWA 재빌드는 매니페스트·아이콘 변경 때만 필요.
- **서명 키스토어는 Desktop 컴퓨터에만 있고 비밀번호는 기록돼 있지 않다(사장님 기억 의존)** —
  재출시 전 키스토어·비밀번호 확보가 선행 조건.

## 도메인·계정

- 프로덕션 도메인 dosigongzon.com(+ city-amber-omega.vercel.app). 인프라 비용: Supabase Pro
  $25/월 결제 중, 나머지는 무료 티어. 유료 전환 검토 순서는 Vercel → Gemini → Sentry.
