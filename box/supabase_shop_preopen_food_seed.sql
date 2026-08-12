-- ══════════════════════════════════════════
-- 상점 선공개 시드 v2 (2026-08-12) — 사료·간식 3종 (사장님 결정: "처음엔 사료랑 간식만")
-- ⚠ 이 파일이 box/supabase_shop_preopen_goods_seed.sql(굿즈 3종, 미실행)을 대체한다.
--    굿즈 시드는 실행하지 말 것.
--
-- 목적: 오픈 티저가 가리킬 /shop 채우기 + 찜 게이트(유니크 15명·40찜) 수집 개시.
--       결제는 PAYMENT_ENABLED=false 하드락 그대로 — 구경+찜만 가능, 재고 리스크 0.
--
-- 가격·문구를 함께 고치는 이유 (8/7 쇼핑 점검 실측):
--  · 츄르 18,900원 = 시장 소매(30,180~31,900)의 59% — 이 가격에 매입할 도매처가 없다.
--    찜은 가격을 보고 누르므로, 못 지킬 가격으로 모은 찜은 수요 데이터로 무효 + 오픈 때
--    인상하면 신뢰 손실. 시장 하단 29,900으로 현실화 후 수집.
--  · 오리젠 38,000원 = 시장 소매(39,900~42,000)보다 낮음(역마진) → 41,900으로 현실화.
--  · 캐츠랑 20kg 배송비 0원 = 중량 택배 실비(편도 ~5,500, 반품 왕복 11,000 실측) 전액
--    손실 + 배송비 Math.max 버그와 결합 시 D-day 출혈 1순위 → 5,500 부과로 현실화.
--  · 츄르 상세 "경계심 있는 아이들도 다가옵니다" = 손 급여 유도 → 학대 취약화(도메인
--    검토 지적) → 안전 문구로 교체.
--  · 캐츠랑 45,000원은 시장가 실측 자료가 없어 유지 — 도매 계약 시점에 재판정.
--
-- D-day(결제 오픈) 전 반드시 남는 게이트 — 이 시드로 해소되지 않음:
--  1. 도매처 계약서 1장 이상 (매입가 < 판매가 실증) — 없으면 사료·간식 판매 불가
--  2. 사료관리법 표시의무 + 공급업체 사료성분 등록 서면 — 미확보 시 사료 제외
--  3. 배송비 Math.max 합산 버그 수정 (코드, D-day 체크리스트 3단계)
--
-- 실행: Supabase SQL Editor.
-- ══════════════════════════════════════════

-- 츄르: 가격 현실화 + 안전 문구 교체
update public.products set
  price = 29900,
  description = '길고양이 급여 인기 1순위 간식. 바닥이나 그릇에 짜서 주시고, 손으로 직접 주지 마세요(사람 손을 타면 위험에 취약해져요). 급여 후 포장재는 꼭 회수해 주세요.'
where id = '2076925c-bdd9-4210-a1ab-da2baf0e1a3c'; -- 이나바 츄르 참치맛 60개입

-- 오리젠: 역마진 가격 현실화
update public.products set price = 41900
where id = '3d3bfd07-ced1-471b-b118-f4105d9d31c6'; -- 오리젠 캣&키튼 1.8kg

-- 캐츠랑 20kg: 중량 택배 실비 부과
update public.products set shipping_fee = 5500
where id = '536b6cc1-efe8-4211-8bed-7dd33bafca6e'; -- 캐츠랑 전연령 20kg

-- 사료·간식 3종 활성화 (나머지 15종은 계속 비활성)
update public.products set is_active = true
where id in (
  '536b6cc1-efe8-4211-8bed-7dd33bafca6e', -- 캐츠랑 전연령 20kg 45,000 / 배송 5,500
  '2076925c-bdd9-4210-a1ab-da2baf0e1a3c', -- 이나바 츄르 60개입 29,900 / 배송 3,000
  '3d3bfd07-ced1-471b-b118-f4105d9d31c6'  -- 오리젠 캣&키튼 1.8kg 41,900 / 배송 3,000
);

-- 검증: 정확히 3행, 가격·배송비 위와 일치해야 한다
-- select name, price, shipping_fee from public.products where is_active = true;

-- ── 롤백 ──
-- update public.products set is_active = false
-- where id in ('536b6cc1-efe8-4211-8bed-7dd33bafca6e',
--              '2076925c-bdd9-4210-a1ab-da2baf0e1a3c',
--              '3d3bfd07-ced1-471b-b118-f4105d9d31c6');
-- update public.products set price = 18900,
--   description = '길고양이 친화도 높이기에 최고. 경계심 있는 아이들도 다가옵니다.'
-- where id = '2076925c-bdd9-4210-a1ab-da2baf0e1a3c';
-- update public.products set price = 38000 where id = '3d3bfd07-ced1-471b-b118-f4105d9d31c6';
-- update public.products set shipping_fee = 0 where id = '536b6cc1-efe8-4211-8bed-7dd33bafca6e';
