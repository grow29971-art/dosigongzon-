-- ══════════════════════════════════════════
-- 키링 응모 ↔ 고양이 연결 (2026-04-28)
-- 응모 자격을 "고양이 등록한 유저 한정"으로 강화.
-- 응모 시 본인이 돌보는 고양이 1마리를 골라 그 모양으로 커스텀 키링 제작.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

-- 응모와 고양이 1:1 연결 (선택한 아이가 삭제되면 NULL — 응모 기록은 유지)
alter table public.event_keyring_entries
  add column if not exists cat_id uuid
    references public.cats(id) on delete set null;

create index if not exists event_keyring_entries_cat_idx
  on public.event_keyring_entries (cat_id);

comment on column public.event_keyring_entries.cat_id
  is '응모 시 선택한 고양이 — 이 아이 모양으로 키링 제작 (2026-04-28)';

-- 같은 고양이로 여러 명이 응모하는 건 막을 필요 없음 (각자 본인 응모니까).
-- 단 user_id는 unique 유지 — 한 사람이 여러 번 응모 불가.

notify pgrst, 'reload schema';
-- 끝.
