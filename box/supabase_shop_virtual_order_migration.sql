-- ══════════════════════════════════════════
-- 가상(후원) 상품 전용 주문 — 배송지 생략 허용
-- 장바구니 전체가 is_virtual 상품이면 배송지가 필요 없으므로
-- orders의 수령인/주소 컬럼 NOT NULL 해제 (가상 주문은 null 저장).
-- 실물 상품 주문의 배송지 필수는 클라이언트 주문서 검증이 담당
-- (주소를 비워 넣어봤자 배송을 못 받아 손해는 본인 — 금전 이득 경로 없음).
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

alter table public.orders alter column recipient_name    drop not null;
alter table public.orders alter column recipient_phone   drop not null;
alter table public.orders alter column recipient_address drop not null;
alter table public.orders alter column postal_code       drop not null;

comment on column public.orders.recipient_address is '배송지 — 가상(후원) 상품 전용 주문은 null';

notify pgrst, 'reload schema';
-- 끝.
