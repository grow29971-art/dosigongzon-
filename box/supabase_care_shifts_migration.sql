-- P3 care shift MVP: idempotent schema and RLS.
-- CITY project ref: sozxbnvgsougkliibnxl
-- Do not run against another Supabase project.

create table if not exists public.care_shifts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.caretaker_circles(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  assignee_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  note text,
  status text not null default 'requested',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_shifts_distinct_participants check (requester_id <> assignee_id),
  constraint care_shifts_future_start check (starts_at > created_at),
  constraint care_shifts_note_length check (char_length(coalesce(note, '')) <= 500),
  constraint care_shifts_status check (status in ('requested', 'accepted', 'completed')),
  constraint care_shifts_status_timestamps check (
    (status = 'requested' and accepted_at is null and completed_at is null)
    or (status = 'accepted' and accepted_at is not null and completed_at is null)
    or (status = 'completed' and accepted_at is not null and completed_at is not null)
  )
);

create index if not exists care_shifts_circle_start_idx
  on public.care_shifts (circle_id, starts_at desc);
create index if not exists care_shifts_requester_status_idx
  on public.care_shifts (requester_id, status, starts_at);
create index if not exists care_shifts_assignee_status_idx
  on public.care_shifts (assignee_id, status, starts_at);

alter table public.care_shifts enable row level security;

create or replace function public.is_accepted_circle_member(
  p_circle_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.member_id = p_user_id
      and cm.status = 'accepted'
  );
$$;

revoke all on function public.is_accepted_circle_member(uuid, uuid) from public;
grant execute on function public.is_accepted_circle_member(uuid, uuid) to authenticated;

create or replace function public.guard_care_shift_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.accepted_at := null;
    new.completed_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.id <> old.id
    or new.circle_id <> old.circle_id
    or new.requester_id <> old.requester_id
    or new.assignee_id <> old.assignee_id
    or new.starts_at <> old.starts_at
    or new.note is distinct from old.note
    or new.created_at <> old.created_at then
    raise exception 'care shift request fields are immutable';
  end if;

  if auth.uid() is distinct from old.assignee_id then
    raise exception 'only the assignee can change care shift status';
  end if;

  if old.status = 'requested' and new.status = 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.completed_at := null;
  elsif old.status = 'accepted' and new.status = 'completed' then
    new.accepted_at := old.accepted_at;
    new.completed_at := coalesce(new.completed_at, now());
  else
    raise exception 'invalid care shift status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists care_shifts_guard_write on public.care_shifts;
create trigger care_shifts_guard_write
  before insert or update on public.care_shifts
  for each row execute function public.guard_care_shift_write();

drop policy if exists "care_shifts_read_participants" on public.care_shifts;
create policy "care_shifts_read_participants"
  on public.care_shifts
  for select
  to authenticated
  using (auth.uid() in (requester_id, assignee_id));

drop policy if exists "care_shifts_request" on public.care_shifts;
create policy "care_shifts_request"
  on public.care_shifts
  for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and requester_id <> assignee_id
    and starts_at > now()
    and (
      public.is_circle_owner_of(circle_id)
      or public.is_member_of_circle(circle_id)
    )
    and public.is_accepted_circle_member(circle_id, assignee_id)
  );

drop policy if exists "care_shifts_assignee_transition" on public.care_shifts;
create policy "care_shifts_assignee_transition"
  on public.care_shifts
  for update
  to authenticated
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

revoke all on public.care_shifts from anon;
grant select, insert, update on public.care_shifts to authenticated;

comment on table public.care_shifts is
  'P3 circle care shift requests with requested -> accepted -> completed lifecycle';
