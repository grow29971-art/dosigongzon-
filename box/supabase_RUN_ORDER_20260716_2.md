# 2026-07-16 SQL 실행 순서 (2차 — 펜테스트 후속, 사장님 실행 필요)

1차 RUN_ORDER 6종(`supabase_RUN_ORDER_20260716.md`)은 실행·검증 완료.
이 문서는 그 뒤 재점검(4에이전트 펜테스트)에서 새로/잔여로 확인된 DB 취약점 수정분이다.
전부 코드에 폴백이 있어 실행 전에도 앱은 안 죽지만, 실행해야 아래 구멍이 닫힌다.
Supabase Dashboard → SQL Editor에서 **순서대로** 실행. ⚠ Chrome 번역 OFF.

## 실행 순서

1. **`supabase_equip_item_authz_migration.sql`** 🟠 HIGH
   - `equip_item_atomic` authenticated 권한 회수 → 타인 인벤토리/장비 조작(IDOR) 차단.
   - 앱은 service_role로 호출하므로 무영향.

2. **`supabase_post_votes_dedup_migration.sql`** 🟠 HIGH
   - `post_votes` 1인1표 테이블 + `post_vote_update` 멱등 재작성 → 게시글 무한 좋아요/랭킹 조작 차단.
   - 클라 코드 변경 불필요(시그니처 유지). 관리자 "+1 누적" 기능은 보존.

3. **`supabase_weekly_payouts_migration.sql`** 🟡 (1차 RUN_ORDER에서 누락됐던 M4)
   - `weekly_payouts` 지급대장 → 주간배틀 크론 재실행 시 TOP10 코인 2배 지급 차단.
   - 공격자가 직접 트리거하진 못하나(CRON_SECRET 필요) 운영 사고 방지용. **꼭 함께 실행.**

4. **`supabase_profiles_anon_exposure_migration.sql`** 🟡 MEDIUM
   - anon 역할에서 profiles의 coins·invite_code·invited_by·보상날짜·알림설정 SELECT 회수.
   - authenticated는 미변경 → 본인 마이페이지 조회 무영향. 로그아웃 대량 스크래핑 차단.

## 실행 후 검증
각 파일 하단 "검증(실행 후)" 주석의 REST 프로브를 anon 키 + 일반 유저 JWT로 실행해 차단 확인.

## 롤백
각 SQL 파일 하단 주석에 롤백 SQL 포함. 코드는 테이블/함수/권한이 없거나 원복돼도 폴백 동작.

## 코드로 이미 수정·배포된 것 (SQL과 별개, 실행 불필요)
- 서클 채팅 저장형 XSS 차단(렌더 sanitize + 쓰기측 검증)
- 카드 배틀 파밍 차단(분당 버스트 + 일일 보상 상한, 자동·수동 공유)
- 저장 URL 앵커 href 렌더 sanitize(event-keyring 관리자 XSS·홈 이슈 링크)
