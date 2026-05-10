-- ─────────────────────────────────────────────────────────────
-- user_blocks: 사용자 → 사용자 차단 기능
-- 작성: 2026-05-10 (도시공존 v1)
-- 사유: Play Store 정책 — UGC 앱 차단 기능 필수.
-- ─────────────────────────────────────────────────────────────

-- 차단 관계 테이블 (blocker가 blocked를 차단)
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)  -- 자기 자신 차단 금지
);

-- 인덱스: "내가 차단한 목록" 조회
create index if not exists idx_user_blocks_blocker on public.user_blocks(blocker_id);
-- 인덱스: "이 사람이 누구한테 차단당했는지" — 댓글/DM 필터링 시 사용
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);

-- RLS 활성화
alter table public.user_blocks enable row level security;

-- 정책: 본인이 만든 차단 관계만 조회 가능
drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select using (auth.uid() = blocker_id);

-- 정책: 본인 명의로만 차단 등록 가능
drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert with check (auth.uid() = blocker_id);

-- 정책: 본인이 만든 차단만 해제 가능
drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete using (auth.uid() = blocker_id);

-- ─────────────────────────────────────────────────────────────
-- 헬퍼 함수: A가 B를 차단했는지 (양방향 모두)
-- DM INSERT 트리거 등에서 사용. security invoker라 RLS 적용됨.
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_blocked_pair(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- DM 차단 트리거: 차단 관계인 두 사람 사이 메시지 전송 차단
-- direct_messages INSERT 시 sender↔receiver 차단 여부 확인.
-- ─────────────────────────────────────────────────────────────
create or replace function public.dm_check_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = new.sender_id   and blocked_id = new.receiver_id)
       or (blocker_id = new.receiver_id and blocked_id = new.sender_id)
  ) then
    raise exception '차단된 사용자에게는 메시지를 보낼 수 없어요'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dm_check_block on public.direct_messages;
create trigger trg_dm_check_block
  before insert on public.direct_messages
  for each row execute function public.dm_check_block();

-- ─────────────────────────────────────────────────────────────
-- 적용 후 Supabase SQL Editor에서 검증:
--   select * from public.user_blocks limit 1;
--   select public.is_blocked_pair('uuid-a', 'uuid-b');
-- ─────────────────────────────────────────────────────────────
