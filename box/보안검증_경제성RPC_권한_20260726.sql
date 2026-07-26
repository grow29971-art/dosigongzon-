-- ══════════════════════════════════════════
-- 경제성 RPC 실행 권한 검증 (읽기 전용) — 2026-07-26
-- 목적: 아래 RPC들이 anon/authenticated에서 직접 실행 불가한지 확인한다.
--   이 함수들은 p_user_id를 파라미터로 받는 security definer라, authenticated에
--   execute가 있으면 로그인 유저가 PostgREST로 "임의 user_id"를 넣어 타인 코인/
--   아이템을 조작할 수 있다(수평 권한 상승). 정상 호출은 서버 라우트의 service_role뿐.
--   기대 상태: anon=없음, authenticated=없음, service_role만 있음(또는 아무도 없음).
--
-- ⚠️ 전부 SELECT/조회만 — 데이터 변경 없음. 운영 DB에서 실행해도 안전.
--    (요청 지시대로 이 파일은 검증 전용. 실제 권한 회수는 아래 별도 하드닝 SQL에서.)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 대상 RPC 목록
--   buy_shop_item_atomic, equip_item_atomic, consume_user_item,
--   increment_coins, award_care_bonus_atomic
--   (+ 참고: pet_cat, post_vote_update 등은 파라미터에 user_id가 없어 대상 아님)

-- ── 1) 함수별 grantee 나열 — authenticated/anon이 보이면 취약 ──
select
  p.proname                       as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef                     as is_security_definer,
  coalesce(r.grantee, '(no explicit grants)') as grantee,
  r.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join information_schema.routine_privileges r
  on r.routine_schema = 'public'
 and r.routine_name = p.proname
where n.nspname = 'public'
  and p.proname in (
    'buy_shop_item_atomic', 'equip_item_atomic', 'consume_user_item',
    'increment_coins', 'award_care_bonus_atomic'
  )
order by p.proname, r.grantee;

-- ── 2) 취약 요약 — anon/authenticated에 execute가 남아 있는 함수만 출력 ──
--     결과가 0행이어야 안전. 행이 나오면 그 함수는 하드닝 대상.
select
  p.proname as vulnerable_function,
  r.grantee,
  r.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join information_schema.routine_privileges r
  on r.routine_schema = 'public' and r.routine_name = p.proname
where n.nspname = 'public'
  and p.proname in (
    'buy_shop_item_atomic', 'equip_item_atomic', 'consume_user_item',
    'increment_coins', 'award_care_bonus_atomic'
  )
  and r.grantee in ('anon', 'authenticated', 'public')
  and r.privilege_type = 'EXECUTE'
order by p.proname, r.grantee;

-- ── 3) PUBLIC 기본 execute 확인 (grant를 안 했어도 PUBLIC엔 기본 execute가 붙는다) ──
--     acl이 null이면 "소유자만" — 안전. {=X/...}(PUBLIC=X)가 보이면 취약.
select
  p.proname as function_name,
  p.proacl  as raw_acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'buy_shop_item_atomic', 'equip_item_atomic', 'consume_user_item',
    'increment_coins', 'award_care_bonus_atomic'
  )
order by p.proname;

-- ══════════════════════════════════════════
-- 안전한 JWT 실측 테스트 (선택 — 데이터 변경 없이 "권한 거부"만 확인)
-- ------------------------------------------------------------
-- 목적: 실제 authenticated 롤로 RPC 호출이 permission denied 되는지 본다.
-- 방법: SET ROLE로 롤만 바꿔 EXECUTE 권한을 확인 (실제 로그인/JWT 불필요, 트랜잭션 내).
--       존재하지 않는 랜덤 uuid를 넣고, 반드시 ROLLBACK 해 부작용 0.
--
-- BEGIN;
--   SET LOCAL role authenticated;
--   -- 기대: ERROR: permission denied for function buy_shop_item_atomic
--   SELECT public.buy_shop_item_atomic('00000000-0000-0000-0000-000000000000'::uuid, '__perm_probe__', 0);
-- ROLLBACK;
--
-- BEGIN;
--   SET LOCAL role authenticated;
--   -- 기대: permission denied (권한이 있으면 재고 0 반환 → 취약)
--   SELECT public.consume_user_item('00000000-0000-0000-0000-000000000000'::uuid, '__perm_probe__');
-- ROLLBACK;
--
-- ⚠️ 만약 permission denied가 아니라 정상 실행/결과가 나오면 그 함수는 즉시 하드닝 대상.
--    (위 probe는 존재하지 않는 유저/아이템이라 설령 실행돼도 데이터는 안 바뀌지만,
--     "실행이 된다"는 사실 자체가 취약 신호다.)
--
-- 실제 JWT로 PostgREST 경유까지 확인하려면(엔드투엔드):
--   curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/buy_shop_item_atomic" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $A_USER_JWT" \
--     -H "Content-Type: application/json" \
--     -d '{"p_user_id":"<피해자 uuid>","p_item_key":"__probe__","p_price":0}'
--   기대 HTTP 401/403 또는 {"code":"42501", ... "permission denied"}.
--   (실제 유효 item_key·양수 price로는 절대 시도하지 말 것 — 데이터 변경됨)
-- ══════════════════════════════════════════
