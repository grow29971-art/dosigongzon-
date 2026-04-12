-- ══════════════════════════════════════════
-- 약품 가이드 테이블 (관리자 CRUD)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.pharmacy_guide_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  brand       text,
  category    text not null,
  color       text not null default '#C47E5A',
  image_url   text,
  description text not null,
  usage_info  text,
  tip         text,
  price       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists pharmacy_guide_sort_idx
  on public.pharmacy_guide_items (sort_order asc, created_at desc);

alter table public.pharmacy_guide_items enable row level security;

-- 읽기: 누구나
drop policy if exists "pharmacy_guide_read_public" on public.pharmacy_guide_items;
create policy "pharmacy_guide_read_public"
  on public.pharmacy_guide_items
  for select using (true);

-- 쓰기: admin만
drop policy if exists "pharmacy_guide_insert_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_insert_admin"
  on public.pharmacy_guide_items
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "pharmacy_guide_update_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_update_admin"
  on public.pharmacy_guide_items
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "pharmacy_guide_delete_admin" on public.pharmacy_guide_items;
create policy "pharmacy_guide_delete_admin"
  on public.pharmacy_guide_items
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';
-- 끝.
