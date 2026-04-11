-- ══════════════════════════════════════════
-- 구조동물 치료 도움병원(rescue_hospitals) 테이블
-- 선행: supabase_news_admin_migration.sql (admins 테이블 필요)
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.rescue_hospitals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text not null,    -- 시/도 (예: 인천광역시, 서울특별시)
  district   text not null,    -- 시/군/구 (예: 남동구, 강남구)
  address    text,
  phone      text,
  hours      text,
  note       text,             -- 특이사항 (길고양이 할인, 24시 응급 등)
  tags       text[] default '{}',
  pinned     boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists rescue_hospitals_city_district_idx
  on public.rescue_hospitals (city, district);

create index if not exists rescue_hospitals_pinned_idx
  on public.rescue_hospitals (pinned desc, created_at desc);

alter table public.rescue_hospitals enable row level security;

-- 읽기: 누구나
drop policy if exists "rescue_hospitals_read_public" on public.rescue_hospitals;
create policy "rescue_hospitals_read_public"
  on public.rescue_hospitals
  for select
  using (true);

-- 쓰기: admin만
drop policy if exists "rescue_hospitals_insert_admin" on public.rescue_hospitals;
create policy "rescue_hospitals_insert_admin"
  on public.rescue_hospitals
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "rescue_hospitals_update_admin" on public.rescue_hospitals;
create policy "rescue_hospitals_update_admin"
  on public.rescue_hospitals
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "rescue_hospitals_delete_admin" on public.rescue_hospitals;
create policy "rescue_hospitals_delete_admin"
  on public.rescue_hospitals
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';
