-- ══════════════════════════════════════════
-- 주간 출석체크 + 쇼핑 포인트 시스템 (2026-07-13)
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 구조:
--   checkin_days  — 일일 출석체크 완료 이력 (주간 집계용)
--   user_points   — 포인트 잔액 (1P = 1원 할인)
--   point_ledger  — 적립/사용 이력 (reason 유니크로 중복 지급 차단)
--   orders.points_used — 주문에 사용한 포인트
--   grant_points / spend_points RPC — service_role 전용 (모든 지급·차감은 서버만)
-- ══════════════════════════════════════════

-- 1. 출석 이력
create table if not exists public.checkin_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.checkin_days enable row level security;
drop policy if exists "checkin_days_read_self" on public.checkin_days;
create policy "checkin_days_read_self" on public.checkin_days
  for select using (auth.uid() = user_id);
-- insert/update/delete 정책 없음 = service_role(출석 API)만 기록

-- 2. 포인트 잔액
create table if not exists public.user_points (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_points enable row level security;
drop policy if exists "user_points_read_self" on public.user_points;
create policy "user_points_read_self" on public.user_points
  for select using (auth.uid() = user_id);

-- 3. 포인트 이력
create table if not exists public.point_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,          -- 적립 +, 사용 -
  reason     text not null,             -- weekly:2026-W29:m3 / order:{id}:{ts} 등
  note       text,
  created_at timestamptz not null default now()
);
-- 같은 사유 중복 지급 차단 (주간 마일스톤 멱등성의 핵심)
create unique index if not exists point_ledger_user_reason_uidx
  on public.point_ledger (user_id, reason);
create index if not exists point_ledger_user_created_idx
  on public.point_ledger (user_id, created_at desc);
alter table public.point_ledger enable row level security;
drop policy if exists "point_ledger_read_self" on public.point_ledger;
create policy "point_ledger_read_self" on public.point_ledger
  for select using (auth.uid() = user_id);

-- 4. 주문에 사용 포인트 컬럼
alter table public.orders add column if not exists points_used integer not null default 0
  check (points_used >= 0);

-- 5. 지급 RPC — reason 중복이면 false (멱등), 성공 시 true
create or replace function public.grant_points(
  p_user_id uuid, p_amount integer, p_reason text, p_note text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return false; end if;
  begin
    insert into point_ledger (user_id, amount, reason, note)
      values (p_user_id, p_amount, p_reason, p_note);
  exception when unique_violation then
    return false;
  end;
  insert into user_points (user_id, balance, updated_at)
    values (p_user_id, p_amount, now())
    on conflict (user_id) do update
      set balance = user_points.balance + p_amount, updated_at = now();
  return true;
end $$;

-- 6. 차감 RPC — 잔액 부족이면 false (원자적 조건부 차감)
create or replace function public.spend_points(
  p_user_id uuid, p_amount integer, p_reason text, p_note text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_updated integer;
begin
  if p_amount <= 0 then return false; end if;
  update user_points
     set balance = balance - p_amount, updated_at = now()
   where user_id = p_user_id and balance >= p_amount;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;
  insert into point_ledger (user_id, amount, reason, note)
    values (p_user_id, -p_amount, p_reason, p_note);
  return true;
end $$;

-- RPC는 service_role 전용 — 클라이언트가 직접 지급/차감 못 하게
revoke execute on function public.grant_points(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.spend_points(uuid, integer, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ── 롤백 ──
-- drop function if exists public.spend_points(uuid, integer, text, text);
-- drop function if exists public.grant_points(uuid, integer, text, text);
-- alter table public.orders drop column if exists points_used;
-- drop table if exists public.point_ledger;
-- drop table if exists public.user_points;
-- drop table if exists public.checkin_days;
