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

-- ── 2026-08-19 후속: 공급사 서면 수령 → 설명 보강 (서비스롤 PATCH 실행 완료, 기록용) ──
-- UPDATE public.products SET description =
--   '홀리스틱 기능성 고양이 사료예요. 단백질 32% · 지방 12% · 포크프리(돼지고기 무첨가). 유산균(장 건강), 보스웰리아&MSM(관절), 고섬유질(헤어볼 배출), pH 균형(요로 건강) 도움 성분을 배합했어요. 전연령(All Life Stages) 급여 가능해요.' || E'\n\n' ||
--   '국내 제조 — 사조동아원(주) 당진 HACCP 인증 공장에서 생산하고, 중금속·곰팡이독소·살모넬라 불검출 검정을 받았어요. AAFCO 영양기준 충족 설계예요.'
-- WHERE id = '495e4774-68e1-4700-af69-df598e819244';
-- 상세이미지 3장: storage cat-photos/products/product_dazzle_detail_{1,2,3}.jpg (서비스롤 업로드)
-- 고시 실값 출처: 사조동아원 검정증명서·KFIA(등 2-174)·HACCP(2008-72)·공급사 상세페이지
-- → lib/product-disclosure.ts 에 반영. 유통기한 표기 기준만 공급사 확인 대기.

-- ── 2026-08-19 후속 2: 도시공존 콜라보 전환 (서비스롤 PATCH 실행 완료, 기록용) ──
-- name = '대즐 × 도시공존 콜라보 치킨&연어 전연령 사료 15kg'
-- images[0] = products/product_dazzle_collab_15kg.jpg (콜라보 뱃지 목업, 사장님 제공)
-- images[1] = products/product_dazzle_chicken_salmon_15kg.jpg (기존 팩샷 유지)
-- description 첫 문단에 콜라보 에디션 + TNR 10% 명시
-- ⚠ 콜라보 이미지는 AI 목업 — 실제 출고 포장이 다르면 실판매 전 실물 사진 교체
--   또는 "이미지는 연출컷" 고지 필요 (표시광고 정합)

-- ── 2026-08-19 후속 3: 공급 조건 확정 (supplier 메모 PATCH 실행 완료, 기록용) ──
-- supplier = '대즐(사조동아원) — 드롭쉬핑, 매입가 50,000원/15kg (2026-08-19 구두합의, 배송비 부담주체 확인 필요)'
-- 유닛 이코노믹스(판매가 70,000 기준): 매입 50,000 + TNR 기부 7,000(10%) + PG 약 2,300(3%)
-- → 마진 약 10,700원 (배송비 부담주체에 따라 ±5,000). D-day 게이트 1(매입<판매) 실증.

-- ── 2026-08-19 후속 4: is_donation=true 전환 (서비스롤 PATCH 실행 완료, 기록용) ──
-- 후원 적립 계산(confirm·webhook)은 is_donation=true 상품만 donation_percent를 적용한다.
-- false 상태면 "일반 상품 10%" 고지와 달리 후원금 0원 적립 — 표기·실계산 불일치라 교정.
-- 효과: 상세 후원 배너 노출 + 결제 시 10% 적립 + 포인트 사용 불가(체크아웃 정책) + 환불 후원특례 적용.

-- ── 롤백 ──
-- DELETE FROM public.products WHERE name = '대즐 치킨&연어 전연령 사료 15kg';
-- (이미지 롤백: storage cat-photos/products/product_dazzle_chicken_salmon_15kg.jpg 삭제)
