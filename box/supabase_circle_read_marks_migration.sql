-- ══════════════════════════════════════════
-- 도시공존 — Circle Read Marks (서클 채팅 읽음 처리)
-- 목적: 채팅방 진입 시 last_read_at 마킹, 진입 안 한 사이 새 메시지 카운트 표시.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_messages_migration.sql
-- ══════════════════════════════════════════

-- 1. 테이블 — 사용자×서클 1행 (마지막 읽은 시각)
create table if not exists public.circle_read_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  circle_id uuid not null references public.caretaker_circles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  unique(user_id, circle_id)
);

create index if not exists circle_read_marks_user_idx
  on public.circle_read_marks (user_id);

-- 2. RLS — 본인 row만 R/W
alter table public.circle_read_marks enable row level security;

drop policy if exists "circle_read_marks_own" on public.circle_read_marks;
create policy "circle_read_marks_own"
  on public.circle_read_marks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.circle_read_marks to authenticated;

-- 3. RPC — 내 모든 서클의 안 읽음 카운트 (sender 제외, owner/member 한정)
create or replace function public.my_unread_circle_messages()
returns table(circle_id uuid, unread_count bigint, last_message_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select
    cm.circle_id,
    count(*)::bigint as unread_count,
    max(cm.created_at) as last_message_at
  from public.circle_messages cm
  left join public.circle_read_marks rm
    on rm.user_id = auth.uid() and rm.circle_id = cm.circle_id
  where cm.sender_id <> auth.uid()
    and (rm.last_read_at is null or cm.created_at > rm.last_read_at)
    and (
      public.is_circle_owner_of(cm.circle_id)
      or public.is_member_of_circle(cm.circle_id)
    )
  group by cm.circle_id;
$$;

grant execute on function public.my_unread_circle_messages() to authenticated;

notify pgrst, 'reload schema';
