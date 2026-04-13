-- ══════════════════════════════════════════
-- 1:1 쪽지 (Direct Messages)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  sender_name  text,
  receiver_id  uuid not null references auth.users(id) on delete cascade,
  receiver_name text,
  body         text not null,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists dm_receiver_idx
  on public.direct_messages (receiver_id, is_read, created_at desc);
create index if not exists dm_sender_idx
  on public.direct_messages (sender_id, created_at desc);
create index if not exists dm_conversation_idx
  on public.direct_messages (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id),
    created_at desc
  );

alter table public.direct_messages enable row level security;

-- 읽기: 보낸 사람 또는 받는 사람만
drop policy if exists "dm_read_own" on public.direct_messages;
create policy "dm_read_own"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- 쓰기: 로그인 + 정지 아님 + 본인 명의
drop policy if exists "dm_insert_auth" on public.direct_messages;
create policy "dm_insert_auth"
  on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_user_not_suspended(auth.uid())
  );

-- 수정: 받는 사람만 읽음 표시 가능
drop policy if exists "dm_update_read" on public.direct_messages;
create policy "dm_update_read"
  on public.direct_messages for update
  using (auth.uid() = receiver_id);

notify pgrst, 'reload schema';
-- 끝.
