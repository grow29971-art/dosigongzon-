-- 도시공존 — 아이템 소모 원자화 (2026-07-16 감사 H4)
-- 문제: /api/care(use_item)·/api/shop/use-item 이 "qty 읽고 → quantity = qty-1 절대값
--   저장" 방식이라, 수량 1개에 동시 2요청이 오면 둘 다 quantity=0을 쓰고 효과를 2번
--   적용 → 아이템 1개로 프리미엄 캔 2회 사용. .gt("quantity",0) 가드도 절대값 저장이라
--   레이스를 못 막음.
-- 해결: DB에서 조건부 증분(quantity = quantity - 1 where quantity > 0) 후 남은 수량 반환.
--   0행이면(이미 소진) 코드가 효과를 적용하지 않는다.
-- 코드는 RPC 미존재(42883) 시 기존 방식 폴백하므로 실행 전에도 안전.

create or replace function public.consume_user_item(p_user_id uuid, p_item_key text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining int;
begin
  update public.user_items
     set quantity = quantity - 1, updated_at = now()
   where user_id = p_user_id and item_key = p_item_key and quantity > 0
  returning quantity into v_remaining;

  if not found then
    return -1; -- 소모할 재고 없음 (동시 요청이 이미 가져감)
  end if;
  return v_remaining;
end;
$$;

revoke execute on function public.consume_user_item(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_user_item(uuid, text) to service_role;

-- ─────────────────────────────────────────────
-- 롤백: drop function if exists public.consume_user_item(uuid, text);
-- ─────────────────────────────────────────────
