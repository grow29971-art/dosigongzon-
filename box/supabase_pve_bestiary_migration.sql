-- 도시공존 — PVE 도감(컬렉션 진행률) 컬럼 추가
-- profiles에 "지금까지 마주친 야생동물"과 "이겨본 야생동물" 키 목록을 배열로 저장.
-- 카드창고 페이지에 도감 그리드로 표시(만난 애는 컬러, 안 만난 애는 실루엣).

alter table public.profiles
  add column if not exists pve_seen_keys text[] not null default '{}',
  add column if not exists pve_defeated_keys text[] not null default '{}';

comment on column public.profiles.pve_seen_keys is 'PVE 배틀에서 마주친 야생동물 종 키 목록 (예: roach, wasp, boar) — 도감 진행률용';
comment on column public.profiles.pve_defeated_keys is 'PVE 배틀에서 이겨본 야생동물 종 키 목록 — 도감 진행률용';
