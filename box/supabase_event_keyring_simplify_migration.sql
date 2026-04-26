-- ══════════════════════════════════════════
-- 키링 응모 폼 단순화 (2026-04-25)
-- 주소·전화 필수 제거. 이제 고양이 이름 + 사진만 받음.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

-- 응모 폼 완전 단순화 — 이제 버튼 한 번 = 응모 기록만.
-- 모든 부가 정보는 추첨 후 쪽지로 별도 수집.
alter table public.event_keyring_entries
  alter column name drop not null,
  alter column address drop not null,
  alter column phone drop not null,
  alter column cat_photo_url drop not null;

comment on column public.event_keyring_entries.name
  is '응모자 닉네임 스냅샷 (옵션) — 2026-04-26 단순화';
comment on column public.event_keyring_entries.cat_photo_url
  is '고양이 사진 (옵션) — 2026-04-26 단순화';
