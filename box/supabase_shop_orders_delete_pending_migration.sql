-- ══════════════════════════════════════════
-- 쇼핑몰 보완: 본인 pending 주문 삭제 허용
-- (주문 생성 중 order_items 저장 실패 시 클라이언트 롤백용)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

drop policy if exists "orders_delete_own_pending" on public.orders;
create policy "orders_delete_own_pending"
  on public.orders for delete
  using (auth.uid() = user_id and status = 'pending');

notify pgrst, 'reload schema';
-- 끝.
