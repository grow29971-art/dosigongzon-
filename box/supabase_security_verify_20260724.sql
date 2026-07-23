-- ============================================================
-- 도시공존 보안 라이브 검증 SQL (2026-07-24)
-- Supabase SQL Editor에 통째로 붙여넣고 Run 한 번!
-- 결과 5줄. 각 줄의 '결과' 칸만 보면 됩니다.
--   ✅ = 정상 / 🔴·🟡 = 조치 필요
-- (조회 전용 — DB를 변경하지 않습니다. 안전)
-- 7/23 4에이전트 팬테스트 확정 항목 A·B·supplier·dm 라이브 상태 점검.
-- ============================================================

-- [1] profiles 민감컬럼 authenticated SELECT 권한 (🔴 위험 B — 가장 중요)
--     로그인 유저가 REST로 전 회원 invite_code/coins/마케팅동의를 교차조회 가능한지.
select
  '1_profiles민감컬럼' as 검사,
  case when count(*) = 0
       then '✅ 정상 (민감컬럼 authenticated 잠김)'
       else '🔴 위험! authenticated 조회 가능: ' || string_agg(column_name, ', ')
            || ' → profiles_authenticated_lockdown 실행 필요'
  end as 결과
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'authenticated'
  and privilege_type = 'SELECT'
  and column_name in (
    'email', 'invite_code', 'invited_by', 'coins',
    'marketing_push_enabled', 'email_digest_enabled'
  )

union all

-- [2] products.supplier anon/authenticated SELECT 권한 (🟡 도매처 유출)
select
  '2_products도매처' as 검사,
  case when count(*) = 0
       then '✅ 정상 (supplier 컬럼 잠김)'
       else '🟡 유출! ' || string_agg(distinct grantee, '/') || ' 조회 가능'
            || ' → products_supplier_lockdown 실행 필요'
  end as 결과
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'products'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT'
  and column_name = 'supplier'

union all

-- [3] direct_messages UPDATE 정책 with_check (🟡 수신자 body 위조)
select
  '3_dm업데이트정책' as 검사,
  case when count(*) = 0
       then '🔴 UPDATE 정책 없음'
       when bool_or(with_check is not null)
       then '✅ 정상 (with_check 존재)'
       else '🟡 with_check 누락 → dm_update_hardening 실행 필요'
  end as 결과
from pg_policies
where schemaname = 'public'
  and tablename = 'direct_messages'
  and cmd = 'UPDATE'

union all

-- [4] 상점 코인 RPC 실행 권한 (🔴 위험 A — 무한 코인)
select
  '4_상점RPC권한' as 검사,
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

-- [5] direct_messages 컬럼 레벨 UPDATE 권한 (🟡 body 위조 근본차단 확인)
--     authenticated가 is_read 외 컬럼도 UPDATE 가능하면 body 위조 여지.
select
  '5_dm컬럼UPDATE권한' as 검사,
  case when count(*) filter (where column_name not in ('is_read', 'read_at')) = 0
            and count(*) filter (where column_name = 'is_read') > 0
       then '✅ 정상 (is_read만 UPDATE 가능)'
       when count(*) = 0
       then '🟡 컬럼 grant 없음 (테이블 전체 UPDATE 열림 가능 — hardening 권장)'
       else '🟡 body 등 UPDATE 가능: ' || string_agg(column_name, ', ')
            || ' → dm_update_hardening 실행 필요'
  end as 결과
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'direct_messages'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'

order by 검사;
