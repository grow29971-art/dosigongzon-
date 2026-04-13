-- ══════════════════════════════════════════
-- 지역 채팅 (구 단위 실시간 대화)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.area_chats (
  id          uuid primary key default gen_random_uuid(),
  area        text not null,  -- 구 이름 (예: 남동구, 강남구)
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists area_chats_area_created_idx
  on public.area_chats (area, created_at desc);

alter table public.area_chats enable row level security;

-- 읽기: 누구나
drop policy if exists "area_chats_read_public" on public.area_chats;
create policy "area_chats_read_public"
  on public.area_chats for select using (true);

-- 쓰기: 로그인 + 정지 아님
drop policy if exists "area_chats_insert_auth" on public.area_chats;
create policy "area_chats_insert_auth"
  on public.area_chats for insert
  with check (
    auth.uid() = author_id
    and public.is_user_not_suspended(auth.uid())
  );

-- 삭제: 본인
drop policy if exists "area_chats_delete_own" on public.area_chats;
create policy "area_chats_delete_own"
  on public.area_chats for delete
  using (auth.uid() = author_id);

-- Realtime 활성화
alter publication supabase_realtime add table public.area_chats;

notify pgrst, 'reload schema';
-- 끝.
