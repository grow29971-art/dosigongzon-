-- ============================================================
-- profiles 민감컬럼 보호 — 1단계: profiles_public 뷰 생성 (2026-07-20)
-- ============================================================
-- 문제(중간·개인정보 컴플라이언스): 로그인 유저(authenticated)가 Supabase REST로
--   전 회원의 coins·invite_code·invited_by·마케팅/이메일 수신동의·약관동의 시각·
--   출석/보상 날짜를 교차 조회 가능(앱 UI로는 재현 불가, 안전컬럼만 조회하므로
--   실악용 확률은 낮지만 통신판매업·LBS 신고 프라이버시 감사에서 지적 소지).
--
-- 올바른 해법: 안전컬럼만 담은 공개 뷰(이 파일) + base profiles의 SELECT를
--   본인·admin 행으로 제한(2단계). 컬럼 REVOKE는 본인 coins 조회까지 막아 부적절.
--
-- ⚠️ 이 파일은 "무해한 1단계"다. 뷰만 만들고 base RLS는 건드리지 않으므로
--   지금 실행해도 아무것도 깨지지 않지만, 아직 보호 효과도 없다.
--   실제 잠금은 2단계(box/supabase_profiles_authenticated_lockdown_migration.sql,
--   앱 코드 repoint 배포 + 실서비스 검증 후)에서 이뤄진다.
-- ============================================================

-- 안전 컬럼만 투영. (기본 security_invoker=off = 뷰 소유자 권한으로 실행되어
--  base RLS와 무관하게 '공개 작성자 정보'만 노출 — 2단계에서 base가 잠겨도 동작.)
create or replace view public.profiles_public as
select
  id,
  nickname,
  avatar_url,
  admin_title,
  suspended,
  created_at,
  boss_defeats,
  best_win_streak,
  perfect_catch_count
from public.profiles;

-- 공개 작성자 정보이므로 익명·로그인 모두 조회 허용
grant select on public.profiles_public to anon, authenticated;

-- ============================================================
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- drop view if exists public.profiles_public;
-- ============================================================
