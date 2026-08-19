-- ══════════════════════════════════════════
-- 고양이 피규어 키링 진열 (2026-08-19 사장님 지시, 5,000원)
-- 기존 "길고양이 아크릴 키링"(313e2e19-d08c-41c8-adc0-94380cca7055, 8,000원) 행 재활용.
-- 이미지: 사장님 제공 실사(6종 디자인) — cat-photos/products/product_cat_keyring.jpg
-- ⚠ 이 UPDATE는 2026-08-19 서비스롤 REST로 실행 완료 — 재실행 불필요 (기록 보존용)
-- ⚠ 실판매 전 확정 필요: ①매입처·매입가(5,000원 판매 - 후원 500 - 우편·포장비면 마진 박함)
--   ②6종 디자인 발송 방식(랜덤/선택) 상세 표기 ③배송비 0(우편) 유지 여부
-- ══════════════════════════════════════════

UPDATE public.products SET
  name = '고양이 피규어 키링',
  description = '동그란 눈의 고양이 피규어 키링이에요. 흰냥이, 치즈, 삼색이, 태비까지 — 우리 동네에서 만나는 아이들 모습 그대로예요. 가방, 열쇠, 에어팟 케이스에 딱이에요.' || E'\n\n' ||
    '결제 금액의 10%가 우리 동네 길고양이 중성화(TNR)에 쓰여요 🐾',
  price = 5000,
  images = ARRAY['https://sozxbnvgsougkliibnxl.supabase.co/storage/v1/object/public/cat-photos/products/product_cat_keyring.jpg'],
  is_active = true,
  badge = '신상',
  stock = 30
WHERE id = '313e2e19-d08c-41c8-adc0-94380cca7055';

-- 유지된 기존 값: shipping_fee 0(우편) · donation_percent 10 · is_donation true

-- ── 롤백 ──
-- UPDATE public.products SET name='길고양이 아크릴 키링', price=8000, is_active=false,
--   badge=NULL, stock=99, images='{}',
--   description='도시공존 캐릭터 아크릴 키링. 가방이나 열쇠에. 우편 발송.'
-- WHERE id = '313e2e19-d08c-41c8-adc0-94380cca7055';
