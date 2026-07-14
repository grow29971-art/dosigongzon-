-- ══════════════════════════════════════════
-- 후원금 투명 정산 — 지출 내역 (2026-07-15)
-- 모인 금액(order_items.donation_amount 합계)은 기존 집계 재사용.
-- 쓰인 금액은 관리자가 이 테이블에 기록. 잔액 = 모인 − 쓰인.
-- 읽기는 누구나(투명성), 쓰기는 관리자만.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

create table if not exists public.fund_disbursements (
  id         uuid primary key default gen_random_uuid(),
  amount     integer not null check (amount > 0),   -- 지출액(원)
  memo       text not null,                          -- 사용처 설명
  spent_at   date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now()
);

create index if not exists fund_disbursements_spent_idx
  on public.fund_disbursements (spent_at desc);

alter table public.fund_disbursements enable row level security;

-- 읽기: 누구나 (투명 공개)
drop policy if exists "fund_disbursements_read" on public.fund_disbursements;
create policy "fund_disbursements_read" on public.fund_disbursements
  for select using (true);

-- 쓰기: 관리자만
drop policy if exists "fund_disbursements_write_admin" on public.fund_disbursements;
create policy "fund_disbursements_write_admin" on public.fund_disbursements
  for all
  using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

notify pgrst, 'reload schema';

-- ── 롤백 ──
-- drop table if exists public.fund_disbursements;
