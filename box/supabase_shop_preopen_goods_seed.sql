-- ══════════════════════════════════════════
-- 상점 선공개 시드 (2026-08-12) — 굿즈 3종만 활성화 + 키링 가격 인상
-- 목적: 오픈 티저 팝업이 가리키는 /shop이 빈 목록이면 역효과(빈 깡통 방문 = 불신 적립,
--       8/12 회의). 결제는 PAYMENT_ENABLED=false 하드락 그대로라 구경+찜만 가능 —
--       찜 게이트(유니크 15명·40찜) 수집이 이 시드로 비로소 시작된다.
-- 선정 근거: 쇼핑오픈 D-day 체크리스트(8/7)의 최소 구성 = POD 굿즈(재고·현금 리스크 0).
--       "번들 22,000"은 상품 미생성이라 D-day 때 별도 결정. 사료·츄르·쉼터 등 15종은
--       도매처 계약·문구 수정 선행이라 계속 비활성.
-- 키링 8,000→10,000: 체크리스트 5단계 결정. 공개 후 인상하면 신뢰 손실이라 선반영.
-- 실행: Supabase SQL Editor.
-- ══════════════════════════════════════════

update public.products set price = 10000
where id = '313e2e19-d08c-41c8-adc0-94380cca7055'; -- 길고양이 아크릴 키링

update public.products set is_active = true
where id in (
  'fdaf8099-b81f-4309-ad96-19cf32b9327e', -- 캣대디 에코백 15,000
  '313e2e19-d08c-41c8-adc0-94380cca7055', -- 길고양이 아크릴 키링 10,000
  'f2cdc746-1708-4975-89c1-95e6e5fbc81b'  -- 도시공존 로고 스티커팩(8종) 3,500
);

-- 검증: 아래가 정확히 3행이어야 한다
-- select name, price from public.products where is_active = true;

-- ── 롤백 ──
-- update public.products set is_active = false
-- where id in ('fdaf8099-b81f-4309-ad96-19cf32b9327e',
--              '313e2e19-d08c-41c8-adc0-94380cca7055',
--              'f2cdc746-1708-4975-89c1-95e6e5fbc81b');
-- update public.products set price = 8000
-- where id = '313e2e19-d08c-41c8-adc0-94380cca7055';
