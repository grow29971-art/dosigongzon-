-- ══════════════════════════════════════════
-- 키링 응모 폼 단순화 (2026-04-25)
-- 주소·전화 필수 제거. 이제 고양이 이름 + 사진만 받음.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

-- name 컬럼을 "고양이 이름"으로 의미 재사용. address/phone 옵션화.
alter table public.event_keyring_entries
  alter column address drop not null,
  alter column phone drop not null;

-- 기존 코멘트 갱신 (선택)
comment on column public.event_keyring_entries.name
  is '고양이 이름 (이전엔 수령자 이름이었음 — 2026-04-25 단순화)';
comment on column public.event_keyring_entries.address
  is '배송 주소 (옵션 — 추첨 후 별도 안내)';
comment on column public.event_keyring_entries.phone
  is '전화번호 (옵션 — 추첨 후 별도 안내)';
