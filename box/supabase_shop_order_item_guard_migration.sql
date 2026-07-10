-- ══════════════════════════════════════════
-- 보안: order_items 스냅샷을 서버(트리거)가 계산
-- order_items는 클라이언트 RLS로 insert되므로 product_price/subtotal/
-- donation_amount/product_name을 클라이언트가 조작할 수 있었음.
-- INSERT 시 트리거가 실제 products 값으로 덮어써 조작을 원천 차단.
-- (결제 금액은 API에서 별도 재검증하지만, 후원 집계·주문내역 무결성을 위해 DB에서도 봉인)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create or replace function public.enforce_order_item_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  unit integer;
begin
  select name, price, sale_price, is_donation, donation_percent, is_active
    into p
  from public.products
  where id = new.product_id;

  if not found then
    raise exception '존재하지 않는 상품입니다';
  end if;

  -- 수량만 클라이언트 신뢰(결제 시 금액 재검증). 나머지는 서버 권위값으로 강제.
  if new.quantity is null or new.quantity <= 0 then
    raise exception '수량이 올바르지 않습니다';
  end if;

  unit := coalesce(p.sale_price, p.price);
  new.product_name  := p.name;
  new.product_price := unit;
  new.subtotal      := unit * new.quantity;
  new.donation_amount := case
    when p.is_donation then floor((unit * new.quantity) * p.donation_percent / 100.0)
    else 0
  end;

  return new;
end;
$$;

drop trigger if exists order_items_enforce_snapshot on public.order_items;
create trigger order_items_enforce_snapshot
  before insert on public.order_items
  for each row execute function public.enforce_order_item_snapshot();

notify pgrst, 'reload schema';
-- 끝.
