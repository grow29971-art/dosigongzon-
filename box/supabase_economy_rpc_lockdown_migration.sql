-- ══════════════════════════════════════════
-- 경제성 RPC 실행 권한 회수 (하드닝) — 2026-07-26 보안 패치 (운영 적용 대기)
-- 배경: buy_shop_item_atomic 등은 p_user_id를 인자로 받는 security definer라,
--   authenticated에 execute가 있으면 로그인 유저가 PostgREST로 임의 user_id를
--   넣어 타인 코인/아이템을 조작할 수 있다(수평 권한 상승).
--   이 함수들의 유일한 정상 호출자는 서버 라우트의 service_role이다.
--   → anon/authenticated/PUBLIC의 execute를 회수한다. service_role은 RLS·grant를
--     우회하므로 별도 grant 불필요(서버 라우트는 계속 정상 동작).
--
-- ⚠️ 선행: box/보안검증_경제성RPC_권한_20260726.sql로 현재 grantee를 먼저 확인.
-- ⚠️ 경제성 API가 fail-closed(503)로 바뀐 코드가 배포된 뒤 실행 권장 —
--    이 함수들은 어차피 service_role로만 불리므로 순서 민감도는 낮지만,
--    혹시 남아 있는 클라이언트 직접 호출 경로가 있으면 이 회수로 즉시 403이 된다.
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent — 재실행 안전)
-- ══════════════════════════════════════════

do $$
declare
  fn record;
begin
  for fn in
    select p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'buy_shop_item_atomic', 'equip_item_atomic', 'consume_user_item',
        'increment_coins', 'award_care_bonus_atomic'
      )
  loop
    execute format('revoke all on function public.%I(%s) from public',        fn.proname, fn.args);
    execute format('revoke all on function public.%I(%s) from anon',          fn.proname, fn.args);
    execute format('revoke all on function public.%I(%s) from authenticated', fn.proname, fn.args);
    raise notice 'locked down: %(%)', fn.proname, fn.args;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ── 검증 (실행 후): 아래가 0행이어야 안전 ──
-- select p.proname, r.grantee
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- join information_schema.routine_privileges r
--   on r.routine_schema='public' and r.routine_name=p.proname
-- where n.nspname='public'
--   and p.proname in ('buy_shop_item_atomic','equip_item_atomic','consume_user_item','increment_coins','award_care_bonus_atomic')
--   and r.grantee in ('anon','authenticated','public') and r.privilege_type='EXECUTE';

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기 — 예전처럼 authenticated에 execute 재부여)
-- ⚠️ 되돌리면 수평 권한 상승 취약점이 복구되므로 권장하지 않음.
-- ------------------------------------------------------------
-- grant execute on function public.buy_shop_item_atomic(uuid, text, int) to authenticated;
-- grant execute on function public.equip_item_atomic(uuid, uuid, text, text) to authenticated;
-- -- consume_user_item / increment_coins / award_care_bonus_atomic 는 원본 시그니처 확인 후 재부여
-- ══════════════════════════════════════════
