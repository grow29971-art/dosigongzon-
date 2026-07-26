-- ══════════════════════════════════════════
-- 경제성 RPC 실행 권한 검증 (읽기 전용 — 2026-07-26)
-- 목적: 서버 전용(service_role)이어야 하는 원자적 경제 RPC들이
--       anon/authenticated에서 직접 실행 가능하면 코인 발행·재고 조작이 뚫린다.
--       (Postgres는 함수 생성 시 기본으로 PUBLIC에 EXECUTE를 부여하므로
--        revoke가 명시돼 있지 않으면 "뚫려 있는" 상태다.)
-- 실행 위치: Supabase Dashboard → SQL Editor (SELECT만 — 데이터 변경 없음)
-- ══════════════════════════════════════════

-- 1) 대상 함수별 역할 실행 권한 매트릭스
--    기대값: anon_exec = false, auth_exec = false (service_role만 true여도 무방 —
--    service_role은 BYPASSRLS라 grant와 무관하게 서버에서만 쓰인다)
select
  p.proname                                             as function_name,
  pg_get_function_identity_arguments(p.oid)             as args,
  has_function_privilege('anon',          p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
  has_function_privilege('service_role',  p.oid, 'execute') as service_exec,
  p.prosecdef                                           as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    -- 상점/장착/아이템
    'buy_shop_item_atomic',
    'equip_item_atomic',
    'consume_user_item',
    -- 코인/포인트
    'increment_coins',
    'award_care_bonus_atomic',
    'spend_points',
    'grant_points',
    -- 결제 재고
    'increment_product_stock',
    'decrement_product_stock'
  )
order by p.proname;

-- 2) (참고) anon/authen