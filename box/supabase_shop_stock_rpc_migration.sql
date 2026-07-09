-- ══════════════════════════════════════════
-- 쇼핑몰 안전장치: 원자적 재고 차감/복구 RPC
-- 동시 주문 시 재고 음수 방지 — "조회 후 차감" 대신
-- 단일 UPDATE(stock >= 수량 조건)로 경합 안전 처리.
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ── 차감: 재고가 충분할 때만 차감하고 성공 여부 반환 ──
create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if p_qty is null or p_qty <= 0 then
    return false;
  end if;

  update public.products
     set stock = stock - p_qty
   where id = p_product_id
     and stock >= p_qty;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ── 복구: 결제 실패/취소 시 재고 원복 ──
create or replace function public.increment_product_stock(p_product_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_qty is null or p_qty <= 0 then
    return;
  end if;

  update public.products
     set stock = stock + p_qty
   where id = p_product_id;
end;
$$;

-- ── 권한: 서버(service_role) 전용 — 클라이언트에서 직접 호출 금지 ──
revoke execute on function public.decrement_product_stock(uuid, integer) from public;
revoke execute on function public.decrement_product_stock(uuid, integer) from anon;
revoke execute on function public.decrement_product_stock(uuid, integer) from authenticated;
grant execute on function public.decrement_product_stock(uuid, integer) to service_role;

revoke execute on function public.increment_product_stock(uuid, integer) from public;
revoke execute on function public.increment_product_stock(uuid, integer) from anon;
revoke execute on function public.increment_product_stock(uuid, integer) from authenticated;
grant execute on function public.increment_product_stock(uuid, integer) to service_role;

notify pgrst, 'reload schema';
-- 끝.
