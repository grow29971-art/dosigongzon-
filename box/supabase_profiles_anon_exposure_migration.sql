-- ══════════════════════════════════════════
-- 🟡 보안: profiles 민감 컬럼 익명(anon) 노출 축소 — 2026-07-16
-- 문제: 이메일 핫픽스(profiles_email_leak_hotfix) 이후에도 anon 키(로그아웃/공개 클라이언트)가
--       전 회원의 coins·invite_code·invited_by·보상날짜·알림설정을 그대로 SELECT 가능.
--       (RLS는 USING(true) 행단위라 컬럼을 못 막음)
--       → GET /rest/v1/profiles?select=invite_code  로 초대코드 대량 수집(초대보상 파밍),
--         coins·전적 스크래핑 가능.
-- 해결: 로그아웃 대량 스크래핑부터 차단 — anon 역할에서 민감 컬럼 SELECT만 회수.
--       authenticated는 손대지 않음 → 마이페이지 본인 coins/invite_code 조회 등 앱 동작 무영향.
--       공개 카드에 필요한 nickname·avatar_url·admin_title·전적·rep_card는 anon 유지.
-- ⚠ 잔여(후속 과제): 로그인 유저가 '타인'의 민감 컬럼을 REST로 읽는 경로는 남음.
--       완전 차단은 public 안전컬럼 전용 VIEW 분리 + 앱의 교차유저 조회를 그 VIEW로 이관해야 함
--       (앱 전역 쿼리 감사 필요 → 별도 마이그레이션으로 분리).
-- 실행 위치: Supabase Dashboard → SQL Editor (⚠ Chrome 번역 OFF)
-- 선행: supabase_profiles_email_leak_hotfix.sql
-- ══════════════════════════════════════════

-- anon 역할에서 민감 컬럼 SELECT 회수 (authenticated는 그대로 두어 본인 조회 유지)
revoke select (
  invite_code, invited_by, coins,
  email_digest_enabled, marketing_push_enabled, last_digest_sent_at,
  last_login_bonus_date, last_care_coin_date, care_coin_count_today,
  last_checkin_date, feature_tour_completed_at, terms_agreed_at
) on public.profiles from anon;

notify pgrst, 'reload schema';

-- 검증(실행 후): anon 키로
--   GET /rest/v1/profiles?select=invite_code → 400/403 (컬럼 권한 없음)
--   GET /rest/v1/profiles?select=nickname,avatar_url → 200 (공개 컬럼 정상)
--   로그인 유저의 마이페이지 coins/초대코드 표시 → 정상(authenticated 권한 유지).

-- ── 롤백 (anon에 민감 컬럼 재부여 — 권장 안 함) ──
-- grant select (
--   invite_code, invited_by, coins,
--   email_digest_enabled, marketing_push_enabled, last_digest_sent_at,
--   last_login_bonus_date, last_care_coin_date, care_coin_count_today,
--   last_checkin_date, feature_tour_completed_at, terms_agreed_at
-- ) on public.profiles to anon;
-- notify pgrst, 'reload schema';
