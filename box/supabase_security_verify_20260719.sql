-- ============================================================
-- 도시공존 보안 라이브 검증 SQL (2026-07-19)
-- Supabase SQL Editor에 통째로 붙여넣고 실행하세요.
-- 각 쿼리 결과를 아래 "기대값"과 비교하면 됩니다.
-- (조회 전용 — DB를 변경하지 않습니다. 안전)
-- ============================================================


-- ────────────────────────────────────────────────
-- [1] 상점 코인 RPC 실행 권한  (🔴 가장 중요)
-- 기대값: rolname 이 'service_role' 만 나와야 정상.
--         'authenticated' 가 보이면 = 구멍 열림 →
--         supabase_security_audit_20260716_2_migration.sql
--         + supabase_equip_item_authz_migration.sql 즉시 재실행.
-- 결과가 0행이면: authenticated 권한이 이미 회수됨(= 정상).
-- ────────────────────────────────────────────────
select p.proname as function_name, r.rolname as granted_to
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(p.proacl) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and p.proname in ('buy_shop_item_atomic', 'equip_item_atomic')
  and a.privilege_type = 'EXECUTE'
order by p.proname, r.rolname;


-- ────────────────────────────────────────────────
-- [2] 코인 자가발행 차단 트리거 존재 여부
-- 기대값: 'game_columns_guard' 계열 트리거가 1행 이상 나와야 정상.
--         아무것도 안 나오면 = 차단 없음 →
--         supabase_game_columns_guard_migration.sql 재실행.
-- ────────────────────────────────────────────────
select tgname as trigger_name
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
order by tgname;


-- ────────────────────────────────────────────────
-- [3] 멱등성·투표 방어 테이블 존재 여부
-- 기대값: 아래 3개가 모두 나와야 정상.
--   weekly_payouts     (주간배틀 이중지급 방지)
--   battle_token_uses  (배틀 토큰 재사용 방지)
--   post_votes         (무한좋아요 방지)
-- 빠진 이름이 있으면 해당 마이그레이션 SQL 재실행.
-- ────────────────────────────────────────────────
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('weekly_payouts', 'battle_token_uses', 'post_votes')
order by table_name;
