-- ══════════════════════════════════════════
-- 여정 발송 기록 (journey_sends) — 신규 7일 여정(A) + 10% 대조군
-- 목적: 단계별 발송 1회 보장(unique), 하루 1통 빈도 검사, 대조군 대비 활성화율 측정.
-- 쓰기는 크론(service_role)만. 유저는 자기 행 SELECT만.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

create table if not exists public.journey_sends (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  journey  text not null,
  step     text not null,
  channel  text not null check (channel in ('dm', 'push', 'none')),
  holdout  boolean not null default false,
  sent_at  timestamptz not null default now(),
  unique (user_id, journey, step)
);

create index if not exists journey_sends_sent_at_idx on public.journey_sends (sent_at desc);

alter table public.journey_sends enable row level security;

-- SELECT: 본인 행만
drop policy if exists "journey_sends_select_own" on public.journey_sends;
create policy "journey_sends_select_own"
  on public.journey_sends for select
  to authenticated
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: anon·authenticated 전면 거부 (service_role 은 RLS 우회)
drop policy if exists "journey_sends_insert_deny" on public.journey_sends;
create policy "journey_sends_insert_deny"
  on public.journey_sends for insert
  to anon, authenticated
  with check (false);

drop policy if exists "journey_sends_update_deny" on public.journey_sends;
create policy "journey_sends_update_deny"
  on public.journey_sends for update
  to anon, authenticated
  using (false) with check (false);

drop policy if exists "journey_sends_delete_deny" on public.journey_sends;
create policy "journey_sends_delete_deny"
  on public.journey_sends for delete
  to anon, authenticated
  using (false);

notify pgrst, 'reload schema';

-- ── 실행 후 검증 ──
-- select count(*) from public.journey_sends;                       -- 0
-- select policyname, cmd from pg_policies where tablename = 'journey_sends';  -- 4행
-- anon 키로 GET /rest/v1/journey_sends?select=id → 200 + [] (로그인 없으면 0행)

-- ── 롤백 ──
-- drop table if exists public.journey_sends;
