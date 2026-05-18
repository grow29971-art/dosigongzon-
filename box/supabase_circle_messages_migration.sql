-- ══════════════════════════════════════════
-- 도시공존 — Circle Messages (서클 단체 채팅)
-- 목적: Private Circle 멤버끼리 대화할 수 있는 그룹 채팅.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_migration.sql, supabase_circle_recursion_fix.sql
-- ══════════════════════════════════════════

-- 1. circle_messages 테이블
create table if not exists public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.caretaker_circles(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text,
  sender_avatar_url text,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz default now() not null
);

create index if not exists circle_messages_circle_created_idx
  on public.circle_messages (circle_id, created_at desc);
create index if not exists circle_messages_sender_idx
  on public.circle_messages (sender_id, created_at desc);

-- 2. security definer helper — 본인이 accepted 멤버인지 (circle_id 기준)
create or replace function public.is_member_of_circle(p_circle_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id
      and member_id = auth.uid()
      and status = 'accepted'
  );
$$;

grant execute on function public.is_member_of_circle(uuid) to authenticated;

-- 3. RLS
alter table public.circle_messages enable row level security;

drop policy if exists "circle_messages_read" on public.circle_messages;
create policy "circle_messages_read"
  on public.circle_messages
  for select
  using (
    public.is_circle_owner_of(circle_id)
    or public.is_member_of_circle(circle_id)
  );

drop policy if exists "circle_messages_insert" on public.circle_messages;
create policy "circle_messages_insert"
  on public.circle_messages
  for insert
  with check (
    sender_id = auth.uid()
    and (
      public.is_circle_owner_of(circle_id)
      or public.is_member_of_circle(circle_id)
    )
  );

-- 본인 메시지 삭제
drop policy if exists "circle_messages_delete_own" on public.circle_messages;
create policy "circle_messages_delete_own"
  on public.circle_messages
  for delete
  using (sender_id = auth.uid() or public.is_circle_owner_of(circle_id));

-- 4. Realtime publication 활성화 (Supabase Realtime)
alter publication supabase_realtime add table public.circle_messages;

-- 5. GRANT
grant select, insert, delete on public.circle_messages to authenticated;

notify pgrst, 'reload schema';
