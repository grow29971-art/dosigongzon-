-- ══════════════════════════════════════════
-- 고양이별 지정 기금(cat_designated_fund)에서 환불분 제외 (2026-10-02 환불 감사)
-- 기존: status <> 'cancelled'만 걸러 전액환불(refunded) 주문과 부분환불 차감(donation_refunded)이
--       그대로 공개 수치에 남았다 → 결제·지정·환불만으로 남의 고양이 기금을 부풀릴 수 있었다.
-- 변경: donation_totals 뷰와 같은 기준(paid·preparing·shipping·delivered) + 순액(donation_amount − donation_refunded).
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create or replace function public.cat_designated_fund(p_cat_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(
    floor(
      (select coalesce(sum(oi.donation_amount - oi.donation_refunded), 0) from public.order_items oi where oi.order_id = o.id)
      * o.donation_self_ratio / 100.0
    )
  ), 0)::bigint
  from public.orders o
  where o.designated_cat_id = p_cat_id
    and o.donation_self_ratio > 0
    and o.status in ('paid', 'preparing', 'shipping', 'delivered');
$$;

grant execute on function public.cat_designated_fund(uuid) to anon, authenticated;

-- 검증: select public.cat_designated_fund('00000000-0000-0000-0000-000000000000'); → 0
--       select prosrc from pg_proc where proname = 'cat_designated_fund'; → status in (...) 보이면 성공
-- 롤백: box/supabase_order_donation_designation_20260830.sql의 cat_designated_fund 블록 재실행
