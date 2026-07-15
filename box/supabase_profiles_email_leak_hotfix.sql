-- ══════════════════════════════════════════
-- 🔴 긴급 핫픽스: profiles 이메일 유출 차단 (2026-07-15)
-- 문제: RLS가 USING(true)라 익명(anon 키=클라이언트 공개)이 전체 회원 email을 조회 가능.
--       (실측: GET /rest/v1/profiles?select=email → 313명 이메일 덤프됨)
-- 원인: RLS는 '행' 단위지 '컬럼' 단위가 아님. 앱이 email을 안 읽어도 REST로 컬럼 직접 지정 가능.
-- 해결: 컬럼 권한으로 email만 가린다. 테이블 SELECT를 회수하고, email 제외 전 컬럼만 다시 부여.
--       service_role(서버)은 권한 무관하게 계속 읽음. 앱은 email을 클라에서 안 읽으므로 무해.
--       (본인 email이 필요하면 auth.getUser() JWT에서 얻으면 됨)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1) 테이블 전체 SELECT 회수 (컬럼 권한을 켜기 위한 전제)
revoke select on public.profiles from anon, authenticated;

-- 2) email 제외한 모든 컬럼만 다시 부여
grant select (
  id, user_id, nickname, avatar_url, suspended, terms_agreed_at, created_at,
  admin_title, invite_code, invited_by, email_digest_enabled, last_digest_sent_at,
  marketing_push_enabled, rep_card_cat_id, coins, last_login_bonus_date,
  last_care_coin_date, care_coin_count_today, boss_defeats, best_win_streak,
  perfect_catch_count, feature_tour_completed_at, pve_seen_keys, pve_defeated_keys,
  last_checkin_date
) on public.profiles to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   익명 키로 GET /rest/v1/profiles?select=email → 400 (email 컬럼 권한 없음)
--   익명 키로 GET /rest/v1/profiles?select=nickname,avatar_url → 200 (공개 컬럼 정상)

-- ── 롤백 (다시 전체 공개로 — 권장 안 함) ──
-- grant select on public.profiles to anon, authenticated;
