-- ══════════════════════════════════════════
-- 신규 객체의 쓰기 권한 자동 상속 차단 (2026-08-04 보안감사)
--
-- 배경: 2026-08-02에 profiles_public·cats_public_map 같은 공개 뷰가 anon/authenticated
--       쓰기 권한을 갖고 태어난 것이 발견돼 supabase_public_view_write_revoke_migration.sql
--       로 회수했다. 그 파일이 스스로 적어둔 근본원인이 이것이다:
--
--         "신규 뷰에 anon/authenticated 쓰기권한이 default privileges 로 자동 상속됨
--          → 다음에 만드는 단순 단일테이블 뷰는 또 태어나며 뚫린다"
--
--       box/ 전체에 ALTER DEFAULT PRIVILEGES 문이 한 줄도 없어, 지금도 새 뷰는
--       뚫린 채로 생성된다. 이 파일이 그 구멍을 닫는다.
--
-- 범위: INSERT/UPDATE/DELETE/TRUNCATE 만 회수한다. SELECT 는 건드리지 않는다
--       (읽기까지 막으면 새 테이블마다 grant 를 잊어 앱이 조용히 깨진다).
--
-- ⚠ 실행 후 영향: 앞으로 만드는 테이블에 클라이언트가 직접 INSERT/UPDATE 해야 한다면
--    그 마이그레이션에 명시적 grant 를 함께 적어야 한다. 지금 코드의 쓰기 경로는
--    대부분 RPC(security definer) + service_role 이라 기존 기능에는 영향이 없다.
--    기존 객체에는 소급 적용되지 않으므로, 아래 STEP 2 로 현재 뷰도 함께 정리한다.
-- ══════════════════════════════════════════

-- ── STEP 0. 먼저 확인 — 어떤 역할의 기본권한이 걸려 있는지 (읽기 전용) ──
-- 결과의 defaclrole 이 아래 STEP 1 의 "for role" 대상이다.
-- select defaclrole::regrole as owner_role,
--        defaclnamespace::regnamespace as schema,
--        defaclobjtype as obj_type,   -- 'r' = table/view
--        defaclacl
--   from pg_default_acl;

-- ── STEP 1. 기본권한에서 쓰기 회수 ──
-- 뷰·테이블을 만드는 역할이 여럿이면 각각에 대해 반복해야 한다.
-- (Supabase SQL Editor 는 보통 postgres 로 실행된다)
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;

-- 소유 역할이 다른 경우(STEP 0 결과에 따라) 아래 주석을 해제해 함께 실행:
-- alter default privileges for role supabase_admin in schema public
--   revoke insert, update, delete, truncate on tables from anon, authenticated;

-- 실행자 자신의 기본권한도 함께 (role 미지정 = current_user)
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon, authenticated;

-- ── STEP 2. 이미 만들어진 뷰에 소급 적용 ──
-- 기본권한 변경은 과거 객체에 적용되지 않는다. 현재 존재하는 뷰의 쓰기 권한을 회수한다.
-- (donation_totals 는 집계 전용, 나머지는 security_invoker 뷰 — 어느 쪽도 쓰기가 필요 없다)
do $$
declare v record;
begin
  for v in
    select table_name from information_schema.views where table_schema = 'public'
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon, authenticated',
      v.table_name
    );
  end loop;
end $$;

-- ── 검증 (실행 후) ──
-- 1. 기본권한에서 쓰기가 빠졌는지
-- select defaclrole::regrole, defaclacl from pg_default_acl
--  where defaclnamespace = 'public'::regnamespace;
--
-- 2. 현재 뷰에 anon/authenticated 쓰기가 남아 있는지 (0행이어야 정상)
-- select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and grantee in ('anon','authenticated')
--    and privilege_type in ('INSERT','UPDATE','DELETE')
--    and table_name in (select table_name from information_schema.views
--                        where table_schema = 'public');

-- ══════════════════════════════════════════
-- 롤백 SQL (되돌리려면 아래를 실행)
-- ⚠ 되돌리면 앞으로 만드는 뷰가 다시 anon 쓰기 권한을 갖고 태어난다.
-- ══════════════════════════════════════════
-- alter default privileges for role postgres in schema public
--   grant insert, update, delete on tables to anon, authenticated;
-- alter default privileges in schema public
--   grant insert, update, delete on tables to anon, authenticated;
-- -- STEP 2 로 회수한 개별 뷰 권한은 자동 복원되지 않는다. 필요한 뷰에만 개별 grant 할 것
-- -- (원래 그 권한이 필요한 뷰는 없다 — 복원하지 않는 편이 맞다).
