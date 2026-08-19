-- ══════════════════════════════════════════
-- 도시공존 에코백 진열 (2026-08-19 사장님 지시)
-- 기존 "캣대디 에코백"(fdaf8099-b81f-4309-ad96-19cf32b9327e, 15,000원) 행을
-- 도시공존 로고 에코백으로 단장해 활성화. 이미지는 사장님 제공 목업.
-- ⚠ 이 UPDATE는 2026-08-19 서비스롤 REST로 실행 완료 — 재실행 불필요 (기록 보존용)
-- ⚠ 이미지는 AI 목업 — 실물 제작 전. 실판매 개시 전 제작처(POD) 확보 + 실물과
--   다르면 사진 교체 또는 "연출컷" 고지 필요 (대즐 콜라보 이미지와 동일 원칙).
-- ══════════════════════════════════════════

UPDATE public.products SET
  name = '도시공존 에코백',
  description = '도시공존 공식 굿즈 에코백이에요. ''사람과 고양이가 함께하는 도시'' 로고를 새겼어요. 사료 포대, 장바구니, 노트북까지 넉넉하게 들어가는 튼튼한 캔버스 소재예요.' || E'\n\n' ||
    '결제 금액의 10%가 우리 동네 길고양이 중성화(TNR)에 쓰여요. 이 가방을 들고 다니는 것만으로 길고양이 돌봄 문화를 알리는 한 걸음이 돼요 🐾',
  images = ARRAY['https://sozxbnvgsougkliibnxl.supabase.co/storage/v1/object/public/cat-photos/products/product_dosi_ecobag.jpg'],
  is_active = true,
  badge = '신상',
  stock = 30
WHERE id = 'fdaf8099-b81f-4309-ad96-19cf32b9327e';

-- 유지된 기존 값: shipping_fee 3000 · donation_percent 10 · is_donation true
-- ── 2026-08-19 후속: 가격 15,000 → 9,000원 (사장님 지시, 서비스롤 PATCH 실행 완료) ──
-- UPDATE public.products SET price = 9000 WHERE id = 'fdaf8099-b81f-4309-ad96-19cf32b9327e';
-- ⚠ 9,000원은 POD 제작 단가(통상 6,000~9,000원+인쇄·마진)에 따라 역마진 위험 —
--   실판매 전 제작처 견적으로 이익 > 0 검증 필수 (D-day 게이트 5 에코백 시뮬레이션)

-- ── 롤백 ──
-- UPDATE public.products SET name='캣대디 에코백', is_active=false, badge=NULL, stock=99,
--   images='{}', description='사료 담아가기 딱 좋은 튼튼한 에코백. 도시공존 로고 프린트.'
-- WHERE id = 'fdaf8099-b81f-4309-ad96-19cf32b9327e';
