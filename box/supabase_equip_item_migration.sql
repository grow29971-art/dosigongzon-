-- 도시공존 — 카드 장착 아이템(포켓몬 지닌 도구 스타일) 컬럼 추가
-- 카드 1장당 장착 아이템 1개. lib/shop-config.ts의 EQUIP_ITEM_KEYS 참고.

alter table public.cats
  add column if not exists equipped_item_key text null;

comment on column public.cats.equipped_item_key is '장착된 상점 아이템 키(atk_charm 등). null이면 미장착 — lib/shop-config.ts EQUIP_ITEM_KEYS 참고';
