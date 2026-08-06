-- ══════════════════════════════════════════
-- 도시공존 쇼핑몰 — 가짜(시드) 상품 전부 숨기기
-- 실행: Supabase SQL Editor  (⚠ Chrome 번역 OFF)
-- 성격: is_active=false 로만 바꿈 → 되돌리기 가능(비파괴)
-- ══════════════════════════════════════════

-- 0) 실행 전 현황 확인 (몇 개인지, 뭐가 있는지)
select id, name, category, is_active
from public.products
order by created_at;

-- 1) ★ 전부 숨기기 (쇼핑몰에서 즉시 사라짐 — listProducts는 is_active=true만 가져옴)
update public.products
set is_active = false, updated_at = now();

-- 2) 확인 (판매중=0 이면 성공)
select count(*) filter (where is_active) as 판매중,
       count(*) filter (where not is_active) as 숨김,
       count(*) as 전체
from public.products;

-- 스키마 캐시 새로고침
notify pgrst, 'reload schema';

-- ──────────────────────────────────────────
-- 되돌리기(다시 보이게):  update public.products set is_active = true;
--
-- 완전 삭제를 원하면(되돌리기 불가, 시드 참고용도 사라짐):
--   delete from public.products;
--   → 과거 주문은 안전(order_items가 product_name 보관 + product_id는 set null),
--     장바구니는 cascade로 자동 정리.
-- ──────────────────────────────────────────
