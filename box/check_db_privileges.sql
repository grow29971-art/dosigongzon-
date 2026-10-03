-- ══════════════════════════════════════════
-- 라이브 DB 권한 전수 조회 (읽기 전용 — 아무것도 바꾸지 않는다)
-- 목적: box/ 기록과 라이브가 어긋나는 사례(2026-10-02 shorts_admin_stats)를 잡는다. 감사 때마다 재실행.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF. 결과 0행이 목표가 아니라, 각 행이 의도된 것인지 대조한다.
-- ══════════════════════════════════════════
with
fn as (
  select p.oid, p.proname, p.oid::regprocedure::text as sig, p.prosecdef as definer, p.provolatile as vol
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
tbl as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity as rls,
         coalesce((select array_agg(o) from unnest(c.reloptions) o where o like 'security_invoker%'), '{}') as opts
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','p')
)
-- ① anon이 실행 가능한 DEFINER 함수 (본문이 auth.uid() null 거부인지 개별 확인 대상)
select '1_anon_exec_definer' as kind, sig as name,
       case vol when 'v' then 'volatile(상태변경 가능)' else 'stable/immutable' end as detail
  from fn where definer and has_function_privilege('anon', oid, 'execute')
union all
-- ② anon이 실행 가능한 volatile invoker 함수 (RLS 아래서 돌지만 쓰기 가능성)
select '2_anon_exec_volatile_invoker', sig, ''
  from fn where not definer and vol = 'v' and has_function_privilege('anon', oid, 'execute')
     and proname not like 'tr\_%' and proname not like 'guard\_%'
union all
-- ③ RLS 꺼진 테이블
select '3_rls_off', relname, '' from tbl where relkind in ('r','p') and not rls
union all
-- ④ RLS 켜졌는데 정책 0개 (전면 차단 — 의도 확인)
select '4_rls_no_policy', relname, ''
  from tbl t where relkind in ('r','p') and rls
   and not exists (select 1 from pg_policies pp where pp.schemaname='public' and pp.tablename=t.relname)
union all
-- ⑤ anon에 INSERT/UPDATE/DELETE 테이블 권한 (RLS가 마지막 방어선인 곳)
select '5_anon_write_grant', relname,
       concat_ws(',', case when has_table_privilege('anon', oid, 'insert') then 'I' end,
                      case when has_table_privilege('anon', oid, 'update') then 'U' end,
                      case when has_table_privilege('anon', oid, 'delete') then 'D' end)
  from tbl where relkind in ('r','p')
   and (has_table_privilege('anon', oid, 'insert') or has_table_privilege('anon', oid, 'update') or has_table_privilege('anon', oid, 'delete'))
union all
-- ⑥ 쓰기 정책이 true로 열린 것 (anon/public 대상)
select '6_permissive_true_write', tablename || '.' || policyname, cmd || ' roles=' || array_to_string(roles, ',')
  from pg_policies
 where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
   and (coalesce(qual,'') in ('true','') and coalesce(with_check,'') in ('true',''))
   and (roles && array['anon','public']::name[])
union all
-- ⑦ anon이 읽을 수 있는 정의자(definer) 뷰 — RLS 우회 경로
select '7_anon_definer_view', relname, ''
  from tbl where relkind = 'v' and not ('security_invoker=true' = any(opts) or 'security_invoker=on' = any(opts))
   and has_table_privilege('anon', oid, 'select')
order by 1, 2;
