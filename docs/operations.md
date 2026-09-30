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
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` | 토스 결제. 현재 테스트 키 — **테스트 키로 결제를 켜지 않는다**, 라이브 키는 심사 승인 후. 웹훅 시크릿은 없다(결제 웹훅엔 서명이 없음, contracts.md) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | 이메일 다이제스트 발송 |
| `OPENWEATHERMAP_API_KEY` | 날씨(홈 카드·한파 경보 크론) |
| `PII_ENC_KEY_CURRENT` / `PII_ENC_KEY_PREVIOUS` / `PII_INDEX_KEY` | 개인정보 암호화·키 회전(환불 계좌 등) |
| `KAKAO_REST_API_KEY` / `LOCALDATA_API_KEY` | 카카오 REST(주소 변환)·지방행정 인허가 데이터(병원·약국 동기화) |
| `NEXT_PUBLIC_FF_CJ_*` | 코어 저니 기능 플래그군(단계별 온오프) |

- 관리는 Vercel Dashboard(프로덕션)·`.env.local`(로컬). 등록 시 값 끝 개행 혼입 주의.

## 정기 작업(크론)

- Vercel cron이 `/api/cron/*`을 `CRON_SECRET`으로 호출. **전체 목록(17개)은 `vercel.json`이
  단일 소스**다 — 대표 예: 꿀팁 자동 발행(tips-generate, 월 1편·주제 은행은 라우트 안 TOPICS), 건강 경보 푸시, 주간 다이제스트, 발주 다이제스트(텔레그램), 결제 대사,
  약국·병원 동기화, 스토리지 다이어트(오래된 로그 정리 — auth_error_logs 90일 등), 예약 푸시.
  **journey**(신규 7일 여정 A, 2026-09-30): daily-dispatch 서브잡, 가입 8일 안 유저에게 쪽지(+푸시 동의자 푸시) 단계 안내, 10% 대조군은 `journey_sends`에 기록만. 첫 돌봄 기록 시 종료·하루 1통·단계당 1회. 테이블(`box/supabase_journey_sends_20260930.sql`) 미실행이면 ok 로 무동작.
  크론 결함은 과거 두 번(팬아웃 origin, 실패 200 삼킴) 수리 이력이 있으니 새 크론은 실패를
  200으로 삼키지 말 것.

## 운영 데이터 확인(프로브)

- 가입·케어·퍼널 등 지표는 REST HEAD + `Prefer: count=exact`로 실측한다. 예:
  `/rest/v1/profiles?select=id&created_at=gte.<ISO>` → `content-range` 헤더가 카운트.
- 로그인 실패 분석: `auth_error_logs`를 provider·stage·error_code·UA로 집계(관리자 화면
  `/admin/auth-errors`에도 있음).

## 감시 루프(쓰기 없는 자율 점검)

- `node scripts/watch-probe.mjs` — anon/service 이중 프로브로 보안 계약(프로필 잠금·base cats 좌표
  컬럼 거부·zone_reports/cron_runs/auth_error_logs/funnel_events/orders anon 0행·공개 지도 뷰 생존),
  크론 하트비트(vercel.json 16개 + 디스패처 서브잡 9개, 발화점+90분 여유), 사이트 3경로 응답,
  main 최신 커밋 배포 상태, 24h·7일 지표를 잰다. 코드·DB를 고치지 않는다.
- 산출물은 `docs/tracking/watch/YYYY-MM-DD.md`(+latest.md) — git 추적 안 함(옵시디언 볼트로
  리포 폴더를 열면 보임). FAIL이 있으면 종료코드 1. 새로 나타난 이상은 사람이
  `docs/tracking/findings.md`에 옮긴다 — 스크립트가 findings를 직접 쓰지 않는다.
- 스케줄: Windows 작업 스케줄러 `city-watch-probe` 매일 09:30(로그인 상태에서만 실행,
  로그 `docs/tracking/watch/run.log`). 확인: `schtasks /Query /TN city-watch-probe /V /FO LIST`.
- 새 크론 라우트를 만들면 proxy.ts KNOWN_CRONS와 함께 이 스크립트의 기대 목록(디스패처
  서브잡)도 갱신할 것 — 안 하면 결행 감시가 눈먼다.

## 권리침해 신고 처리 (임시조치, 정보통신망법 제44조의2)

명예훼손·모욕·사생활 침해 신고가 오면 아래 순서를 지킨다. 즉시 영구 삭제도, 방치도 하지 않는다 —
삭제하면 게시자가, 방치하면 신고자가 문제 삼을 수 있다(2026-09-30 법적 감사).

1. **접수 확인** — `/admin/inbox`의 신고 건. 신고자에게 "침해 사실 소명"(어떤 글이 누구의 어떤 권리를 침해하는지)을 받는다.
   소명이 없으면 요청하고, 판단이 어려우면 그대로 2단계로 간다.
2. **임시조치(블라인드)** — 지체 없이 해당 글·댓글을 **숨김**(inbox의 숨김 버튼, 삭제 아님). 기간은 **30일 이내**.
   숨김은 증거 보존·오신고 복원을 위해서다.
3. **양측 통지** — 신청인과 게시자에게 조치 사실을 알린다(쪽지·이메일). 게시자에게는 재게시 요청(이의) 방법과 기한을 함께 알린다.
4. **소명 검토** — 게시자가 이의를 내면 양측 자료를 보고 판단. 판단이 어렵으면 방송통신심의위원회 심의 신청을 안내한다.
5. **최종 처리** — 30일 안에 삭제 확정 또는 복원. 결과를 양측에 통지하고, 처리 내역(신고일·조치일·통지일·결과)을 남긴다.

- 학대 제보(zone_reports)·학대경보 댓글도 같은 절차. 경보는 "미검증 신고" 고지가 붙어 있지만, 지목된 사람의 삭제 요청은 위 순서로 처리.
- 수사기관의 자료 요청은 영장·공문 확인 후에만 응한다. 이용자 개인정보를 전화·메일 요청만으로 넘기지 않는다.

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
