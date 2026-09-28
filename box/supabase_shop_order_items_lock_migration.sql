-- ══════════════════════════════════════════
-- 결제 끝난 주문에 상품 끼워넣기 차단 (2026-09-28 쇼핑 감사 치명 1건)
--
-- 증상: order_items_insert_own 정책(supabase_shop_migration.sql:147)이 "본인 주문인지"만 보고
--       주문 상태를 안 봤다. 결제 완료(paid) 주문에 브라우저 클라이언트로 order_items를 직접 넣으면
--       발주 크론(order-dispatch)이 그대로 발송 목록에 올리고, 후원 집계·환불 재고 원복도 부풀었다.
-- 수정: ① 회원 order_items INSERT는 부모 주문이 결제 전(pending + payment_key 없음)일 때만.
--       ② 게스트 취소 RPC도 결제 승인 진행 중(payment_key 선점) 주문은 못 취소하게
--          (회원 취소 API와 같은 조건 — 청구됐는데 주문 취소 방지).
-- 앱 코드 변경 없음 — 회원 주문 생성은 결제 전에 items를 넣으므로 정상 흐름엔 영향 없다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF 상태에서 복사·실행
-- ══════════════════════════════════════════

-- ① order_items INSERT: 결제 전 본인 주문에만
drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
        and o.status = 'pending'
        and o.payment_key is null
    )
  );

-- ② 게스트 취소: 결제 승인 진행 중(payment_key 있음)이면 취소 불가
create or replace function public.cancel_guest_order(p_order_number text, p_guest_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_updated int;
begin
  update orders set status = 'cancelled', updated_at = now()
   where order_number = p_order_number and guest_token = p_guest_token
     and status = 'pending' and payment_key is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end $$;
revoke execute on function public.cancel_guest_order(text, uuid) from public;
grant execute on function public.cancel_guest_order(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 검증 ──
-- select policyname, with_check from pg_policies
--  where tablename = 'order_items' and policyname = 'order_items_insert_own';
--   → with_check에 status = 'pending' 과 payment_key IS NULL 이 보이면 성공.
-- select pg_get_functiondef('public.cancel_guest_order(text, uuid)'::regprocedure);
--   → where 절에 payment_key is null 이 보이면 성공.

-- ── 롤백 ──
-- drop policy if exists "order_items_insert_own" on public.order_items;
-- create policy "order_items_insert_own" on public.order_items for insert
--   with check (exists (select 1 from public.orders o
--                       where o.id = order_items.order_id and o.user_id = auth.uid()));
-- cancel_guest_order는 box/supabase_shop_guest_order_migration.sql 132~143행 블록 재실행.
-- notify pgrst, 'reload schema';
