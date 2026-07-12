-- ══════════════════════════════════════════
-- [보안] 주문 상태 전이 가드 — DB 레벨 상태 머신 (2026-07-12)
-- 서버 버그·관리자 실수·키 유출 상황에서도 말이 안 되는 상태 전환을
-- DB가 물리적으로 거부. (예: cancelled→paid, pending→delivered)
-- service_role 포함 모든 경로에 적용됨 (트리거는 RLS와 무관하게 실행).
--
-- 허용 전이:
--   pending   → paid, cancelled
--   paid      → preparing, shipping, delivered, cancelled, refunded
--   preparing → shipping, delivered, cancelled, refunded
--   shipping  → delivered, refunded
--   delivered → refunded
--   (cancelled/refunded는 종착역 — 되돌릴 수 없음)
-- 추가 규칙: paid 전이는 payment_key 필수 (결제키 없는 결제완료 차단)
--
-- ⚠ 트레이드오프: 관리자가 실수로 취소한 주문을 다시 paid로 못 돌림.
--   그런 예외 상황은 SQL Editor에서 트리거 disable 후 수동 처리.
-- 실행: Supabase SQL Editor / ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create or replace function public.guard_order_status_transition()
returns trigger
language plpgsql
security definer
as $$
begin
  -- 상태가 안 바뀌면 통과 (운송장 입력 등)
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending'   and new.status in ('paid', 'cancelled')) or
    (old.status = 'paid'      and new.status in ('preparing', 'shipping', 'delivered', 'cancelled', 'refunded')) or
    (old.status = 'preparing' and new.status in ('shipping', 'delivered', 'cancelled', 'refunded')) or
    (old.status = 'shipping'  and new.status in ('delivered', 'refunded')) or
    (old.status = 'delivered' and new.status in ('refunded'))
  ) then
    raise exception '허용되지 않는 주문 상태 전이: % → %', old.status, new.status;
  end if;

  -- 결제키 없는 결제완료 차단
  if new.status = 'paid' and new.payment_key is null then
    raise exception 'payment_key 없이 paid 전이는 불가합니다';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_status_guard on public.orders;
create trigger orders_status_guard
  before update on public.orders
  for each row
  execute function public.guard_order_status_transition();

-- ── 되돌리기 (rollback) ──
-- drop trigger if exists orders_status_guard on public.orders;
-- drop function if exists public.guard_order_status_transition();
-- 끝.
