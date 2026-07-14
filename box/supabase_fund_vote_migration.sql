-- ══════════════════════════════════════════
-- 쇼핑 수익 사용처 투표 (2026-07-14)
-- 로그인 유저 1인 1표(변경 가능). 결과 집계는 누구나 열람.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1. 투표 항목
create table if not exists public.fund_vote_options (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  emoji      text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.fund_vote_options enable row level security;
drop policy if exists "fund_vote_options_read" on public.fund_vote_options;
create policy "fund_vote_options_read" on public.fund_vote_options
  for select using (is_active = true);
-- 쓰기는 정책 없음 = service_role(운영)만

-- 2. 투표 (1인 1표 — user_id PK)
create table if not exists public.fund_votes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  option_id  uuid not null references public.fund_vote_options(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.fund_votes enable row level security;
drop policy if exists "fund_votes_read_self" on public.fund_votes;
create policy "fund_votes_read_self" on public.fund_votes
  for select using (auth.uid() = user_id);
-- insert/update는 cast_fund_vote RPC로만 (개별 정책 없음)

-- 3. 결과 집계 RPC (누구나 — 개별 표는 안 보이고 합계만)
create or replace function public.fund_vote_results()
returns table(option_id uuid, votes bigint)
language sql security definer set search_path = public stable as $$
  select option_id, count(*)::bigint from fund_votes group by option_id;
$$;
revoke execute on function public.fund_vote_results() from public;
grant execute on function public.fund_vote_results() to anon, authenticated;

-- 4. 투표 RPC (로그인 유저, upsert로 변경 가능)
create or replace function public.cast_fund_vote(p_option_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if not exists (select 1 from fund_vote_options where id = p_option_id and is_active) then
    raise exception '유효하지 않은 항목이에요';
  end if;
  insert into fund_votes(user_id, option_id, updated_at)
    values (auth.uid(), p_option_id, now())
    on conflict (user_id) do update
      set option_id = excluded.option_id, updated_at = now();
end $$;
revoke execute on function public.cast_fund_vote(uuid) from public, anon;
grant execute on function public.cast_fund_vote(uuid) to authenticated;

-- 5. 초기 투표 항목 (첫 실행 시에만)
insert into public.fund_vote_options (label, emoji, sort_order)
  select * from (values
    ('길고양이 쉼터 설치', '🏠', 1),
    ('사료·급식 지원', '🍚', 2),
    ('구조·치료 의료비', '🏥', 3),
    ('TNR(중성화) 지원', '✂️', 4),
    ('겨울나기 방한 물품', '🧣', 5)
  ) as v(label, emoji, sort_order)
  where not exists (select 1 from public.fund_vote_options);

notify pgrst, 'reload schema';

-- ── 롤백 ──
-- drop function if exists public.cast_fund_vote(uuid);
-- drop function if exists public.fund_vote_results();
-- drop table if exists public.fund_votes;
-- drop table if exists public.fund_vote_options;
