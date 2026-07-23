-- ══════════════════════════════════════════
-- 🟡 products.supplier(도매처 메모) 유출 차단 (2026-07-24)
-- 문제(7/23 팬테스트 MEDIUM): products SELECT 정책이 USING(true)이고
--   supplier 컬럼이 anon/authenticated에 grant돼 있어
--   GET /rest/v1/products?select=supplier 로 전 상품 도매처 메모(영업기밀) 덤프 가능.
-- 해결: email 핫픽스와 동일한 컬럼 권한 방식.
--   테이블 SELECT 회수 → supplier 제외 전 컬럼만 재부여.
--   service_role(서버)은 권한 무관하게 계속 전체 읽음.
--
-- ⚠ 선행 조건: 관리자 상품목록(lib/shop-admin-repo.ts listAllProducts)이 supplier를
--   authenticated 클라이언트로 읽고 있었으므로, admin 조회를 service_role 서버 라우트로
--   이관한 코드 배포 '이후'에 실행해야 관리자 화면이 안 깨진다.
--   (supabase_security_20260724_RUN_ORDER.md 참고)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1) 테이블 전체 SELECT 회수 (컬럼 권한을 켜기 위한 전제)
revoke select on public.products from anon, authenticated;

-- 2) supplier 제외한 모든 컬럼만 재부여
--    (lib/shop-repo.ts PRODUCT_PUBLIC_COLUMNS와 동일 목록 유지)
grant select (
  id, name, description, price, sale_price, category, images, stock,
  is_active, shipping_fee, badge, is_donation, donation_percent, weight,
  is_virtual, created_at, updated_at
) on public.products to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   anon 키로 GET /rest/v1/products?select=supplier          → 400 (권한 없음)
--   anon 키로 GET /rest/v1/products?select=name,price,images  → 200 (정상)

-- ── ROLLBACK (다시 전체 공개로 — 권장 안 함) ──
-- grant select on public.products to anon, authenticated;
