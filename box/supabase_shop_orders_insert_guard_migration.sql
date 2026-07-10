-- ══════════════════════════════════════════
-- [심각] orders INSERT 정책 강화 — status 위조 차단
-- 기존 orders_insert_own은 status 컬럼을 제한하지 않아,
-- 사용자가 Supabase 클라이언트로 status='paid' 주문을 직접 삽입 →
-- 결제 없이 '결제완료' 주문 생성(상품 배송 편취 + 후원 집계 조작) 가능했음.
-- INSERT 시 status='pending' + payment_key/paid_at null 강제.
-- paid 전환은 오직 service_role(결제 승인 API)만 가능(UPDATE는 admin 정책뿐).
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (
    auth.uid() = user_id
    and public.is_user_not_suspended(auth.uid())
    and status = 'pending'
    and payment_key is null
    and paid_at is null
    and tracking_number is null
  );

notify pgrst, 'reload schema';
-- 끝.
