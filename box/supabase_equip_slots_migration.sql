-- 도시공존 — 디아블로식 부위별 장비창(머리/팔/몸통/다리/발) 컬럼 추가
-- 기존 equipped_item_key(단일 슬롯)는 더 이상 새 코드에서 안 쓰지만, 데이터
-- 손실 없이 남겨둠(컬럼 삭제 안 함). 앞으로는 이 jsonb 하나로 5부위 전부 관리.

alter table public.cats
  add column if not exists equipped_slots jsonb not null default '{}'::jsonb;

comment on column public.cats.equipped_slots is '부위별 장착 아이템 — {"head":"crit_charm","arm":"atk_charm",...} 형태. lib/shop-config.ts BODY_SLOTS 참고';
