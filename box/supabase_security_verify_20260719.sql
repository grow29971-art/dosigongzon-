-- ============================================================
-- 도시공존 보안 라이브 검증 SQL (2026-07-19)
-- Supabase SQL Editor에 통째로 붙여넣고 Run 한 번!
-- 결과가 3줄 나옵니다. 각 줄의 '결과' 칸만 보면 됩니다.
--   ✅ = 정상 / 🔴·⚠️ = 조치 필요
-- (조회 전용 — DB를 변경하지 않습니다. 안전)
-- ============================================================

-- [1] 상점 코인 RPC 실행 권한 (🔴 가장 중요)
select
  '1_상점RPC권한' as 검사,
  case when count(*) = 0
       then '✅ 정상 (authenticated 권한 없음 = 잠김)'
       else '🔴 위험! authenticated 열림 → audit_2 + equip_authz 재실행 필요'
  end as 결과
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(p.proacl) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public'
  and p.proname in ('buy_shop_item_atomic', 'equip_item_atomic')
  and a.privilege_type = 'EXECUTE'
  and r.rolname = 'authenticated'

union all

-- [2] 코인 자가발행 차단 트리거
select
  '2_guard트리거' as 검사,
  case when count(*) = 0
       then '🔴 없음 → game_columns_guard 마이그레이션 재실행 필요'
       else '✅ 정상 (' || string_agg(tgname, ', ') || ')'
  end as 결과
from pg_trigger
where tgrelid = 'public.profiles'::regclass
  and not tgisinternal
  and tgname ilike '%guard%'

union all

-- [3] 멱등성·투표 방어 테이블 존재
select
  '3_멱등테이블' as 검사,
  case when count(*) = 3
       then '✅ 정상 (3/3 존재)'
       else '⚠️ ' || count(*) || '/3만 존재 — 누락분 마이그레이션 재실행 필요'
  end as 결과
from information_schema.tables
where table_schema = 'public'
  and table_name in ('weekly_payouts', 'battle_token_uses', 'post_votes')

order by 검사;
