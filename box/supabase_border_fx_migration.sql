-- 도시공존 — 카드 테두리 코스메틱(상점 구매) 컬럼 추가
-- 스탯 장착 아이템(equipped_item_key)과는 별개 슬롯 — 동시에 둘 다 낄 수 있음.

alter table public.cats
  add column if not exists equipped_border_key text null;

comment on column public.cats.equipped_border_key is '장착된 테두리 코스메틱 아이템 키(border_rainbow 등). null이면 미장착 — lib/shop-config.ts BORDER_FX_ITEM_KEYS 참고';
