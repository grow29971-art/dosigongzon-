-- ══════════════════════════════════════════
-- 대즐 치킨&연어 15kg 사료 상품 등록 (2026-08-19 사장님 지시)
-- 8/12 확정 "대즐 단독 라인업"의 첫 상품 + 토스페이먼츠 심사 요건
-- ("결제 가능한 상품 1개 이상 게시") 충족용 진열.
-- 결제는 PAYMENT_ENABLED=false 하드락 그대로 — 구경+찜만 가능.
-- 이미지: cat-photos 버킷 products/product_dazzle_chicken_salmon_15kg.jpg (서비스롤로 업로드 완료)
-- ⚠ 이 INSERT는 2026-08-19 서비스롤 REST로 실행 완료 — 재실행 불필요 (기록 보존용)
-- ⚠ 실판매 개시(D-day) 전 확인: 사료관리법 표시의무 + 공급업체 사료성분 등록 서면
--    (box/쇼핑오픈_Dday_체크리스트_20260807.md 게이트 8)
-- ══════════════════════════════════════════

INSERT INTO public.products
  (name, description, price, sale_price, category, images, stock, is_active,
   shipping_fee, badge, is_donation, donation_percent, weight, is_virtual, supplier)
VALUES (
  '대즐 치킨&연어 전연령 사료 15kg',
  '홀리스틱 기능성 고양이 사료예요. 단백질 32% · 지방 12% · 포크프리(돼지고기 무첨가). 유산균(장 건강), 보스웰리아&MSM(관절), 고섬유질(헤어볼 배출), pH 균형(요로 건강) 도움 성분을 배합했어요. 전연령(All Life Stages) 급여 가능해요.',
  70000,
  NULL,
  'food',
  ARRAY['https://sozxbnvgsougkliibnxl.supabase.co/storage/v1/object/public/cat-photos/products/product_dazzle_chicken_salmon_15kg.jpg'],
  10,
  true,
  5000,
  '신상',
  false,
  10,
  '15kg',
  false,
  '대즐'
);

-- ── 롤백 ──
-- DELETE FROM public.products WHERE name = '대즐 치킨&연어 전연령 사료 15kg';
-- (이미지 롤백: storage cat-photos/products/product_dazzle_chicken_salmon_15kg.jpg 삭제)
