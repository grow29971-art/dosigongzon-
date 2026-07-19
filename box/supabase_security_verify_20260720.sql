-- ============================================================
-- 7/20 보안 마이그레이션 적용 확인 (region CHECK + profiles_public 뷰)
-- Supabase SQL Editor에 붙여넣고 Run 한 번. 결과 2줄의 '결과' 칸만 보면 됨.
--   ✅ = 적용됨 / 🔴 = 미적용(마이그레이션 재실행)
-- (조회 전용 — DB 미변경)
-- ============================================================

-- [1] cats.region XSS 차단 CHECK 제약
select
  '1_region_CHECK' as 검사,
  case when count(*) > 0
       then '✅ 적용됨 (cats_region_no_html)'
       else '🔴 미적용 → cats_region_check 마이그레이션 재실행'
  end as 결과
from pg_constraint
where conrelid = 'public.cats'::regclass
  and conname = 'cats_region_no_html'

union all

-- [2] profiles_public 뷰 + anon/authenticated SELECT 권한
select
  '2_profiles_public' as 검사,
  case when count(*) >= 2
       then '✅ 적용됨 (뷰 + anon·authenticated 권한)'
       else '🔴 미적용/권한부족 → profiles_public_view 마이그레이션 재실행'
  end as 결과
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'profiles_public'
  and privilege_type = 'SELECT'
  and grantee in ('anon', 'authenticated')

order by 검사;
