-- ══════════════════════════════════════════
-- 고양이별(추모 공간) 마이그레이션 — 2026-08-08
--
-- 배경:
--   지금은 아이가 무지개다리를 건너면 남는 선택지가 `deleteCat` = hard DELETE 뿐이다.
--   care_logs / cat_cards / comments 가 전부 ON DELETE CASCADE 라서
--   삭제하는 순간 그 아이를 돌본 기록이 통째로 사라진다 — 돌보던 사람 입장에선 두 번 잃는 일.
--   또 health_status='danger' 로 남은 개체는 health-alert-push 크론이 계속 집어가서
--   이미 떠난 아이 앞으로 "N일째 안부가 없어요" 푸시가 무기한 반복된다.
--
-- 설계:
--   cats 에 memorial_at(널이면 생존) 을 두고, 지도/경보/검색은 이 값으로 제외한다.
--   행 자체는 남으므로 돌봄 기록·카드·댓글이 전부 보존되고 /memorial 에서 다시 볼 수 있다.
--   삭제 버튼은 그대로 둔다(오등록 정정용) — 고양이별은 삭제의 대체가 아니라 별도 동선.
--
-- ⚠ Supabase SQL Editor 는 자체 트랜잭션으로 감싸므로 begin/commit 을 쓰지 않는다.
--    alter 문은 반드시 한 줄에 하나씩(과거 42601 재발 방지).
-- ══════════════════════════════════════════

-- ────────────────────────────────
-- 1. cats 추모 컬럼
-- ────────────────────────────────
alter table public.cats add column if not exists memorial_at timestamptz;
alter table public.cats add column if not exists memorial_note text;
alter table public.cats add column if not exists memorial_by uuid references auth.users(id) on delete set null;

comment on column public.cats.memorial_at is '고양이별로 보낸 시각. null 이면 생존 — 지도·건강경보·검색은 이 값이 null 인 행만 다룬다.';
comment on column public.cats.memorial_note is '마지막 인사(추모글). 보낸 사람이 남긴 한 마디.';

create index if not exists cats_memorial_at_idx on public.cats(memorial_at desc) where memorial_at is not null;

-- ────────────────────────────────
-- 2. 공개 지도 뷰 재생성 — 떠난 아이 제외
--    (컬럼 목록을 information_schema 에서 다시 뽑으므로 1번에서 추가한 컬럼이 자동 반영된다.
--     원본: box/supabase_cats_anon_coord_lockdown_migration.sql STEP A — 지터 로직 동일)
-- ────────────────────────────────
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cats'
     and column_name not in ('lat', 'lng');

  execute format($f$
    create or replace view public.cats_public_map as
    select
      %s,
      lat + (((hashtext(id::text || '_lat') & 1023) - 512) * 0.0000081) as lat,
      lng + (((hashtext(id::text || '_lng') & 1023) - 512) * 0.0000101) as lng
    from public.cats
    where hidden = false and visibility = 'public' and memorial_at is null
  $f$, cols);
end $$;

grant select on public.cats_public_map to anon, authenticated;

-- 공개 뷰 쓰기 차단 유지 (box/supabase_public_view_write_revoke_migration.sql 와 동일 취지 —
-- create or replace 로 뷰를 다시 만들면 기본 권한이 되살아날 수 있어 재확인한다)
revoke insert, update, delete on public.cats_public_map from anon, authenticated;

-- ────────────────────────────────
-- 3. 헌화 (추모 공간의 유일한 상호작용)
-- ────────────────────────────────
create table if not exists public.memorial_flowers (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cat_id, user_id)
);

create index if not exists memorial_flowers_cat_idx on public.memorial_flowers(cat_id);

alter table public.memorial_flowers enable row level security;

drop policy if exists "헌화 조회는 누구나" on public.memorial_flowers;
create policy "헌화 조회는 누구나" on public.memorial_flowers for select using (true);

drop policy if exists "헌화는 본인만 추가" on public.memorial_flowers;
create policy "헌화는 본인만 추가" on public.memorial_flowers for insert to authenticated with check (auth.uid() = user_id and public.is_user_not_suspended());

drop policy if exists "헌화는 본인만 취소" on public.memorial_flowers;
create policy "헌화는 본인만 취소" on public.memorial_flowers for delete to authenticated using (auth.uid() = user_id);

-- ────────────────────────────────
-- 검증
-- ────────────────────────────────
-- select count(*) from public.cats where memorial_at is not null;          -- 0 기대(최초)
-- select count(*) from public.cats_public_map;                             -- 생존 개체 수와 일치해야 함
-- select column_name from information_schema.columns
--   where table_name='cats_public_map' and column_name='memorial_at';      -- 1행 기대

-- ══════════════════════════════════════════
-- 롤백
-- ══════════════════════════════════════════
-- drop table if exists public.memorial_flowers;
-- do $$
-- declare cols text;
-- begin
--   select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
--     from information_schema.columns
--    where table_schema='public' and table_name='cats' and column_name not in ('lat','lng','memorial_at','memorial_note','memorial_by');
--   execute format($f$
--     create or replace view public.cats_public_map as
--     select %s,
--       lat + (((hashtext(id::text || '_lat') & 1023) - 512) * 0.0000081) as lat,
--       lng + (((hashtext(id::text || '_lng') & 1023) - 512) * 0.0000101) as lng
--     from public.cats where hidden = false and visibility = 'public'
--   $f$, cols);
-- end $$;
-- alter table public.cats drop column if exists memorial_by;
-- alter table public.cats drop column if exists memorial_note;
-- alter table public.cats drop column if exists memorial_at;
