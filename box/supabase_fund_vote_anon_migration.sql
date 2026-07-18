-- ══════════════════════════════════════════
-- 펀드 사용처 투표 — 비로그인(anon) 참여 허용 (2026-07-18)
-- 기존 로그인 투표(fund_votes)는 그대로 두고, 비로그인용 별도 테이블 추가.
-- 식별: 클라이언트가 localStorage에 보관하는 anon_id(UUID) 기준 1기기 1표.
-- ⚠ 한계(의도적): 로그인 없는 투표는 "1인 1표" 보장 불가. anon_id는 브라우저/기기 단위라
--    캐주얼 중복만 막고, 시크릿창·기기 교체·localStorage 삭제 시 재투표 가능.
--    결과는 "정확한 표수"가 아니라 "방향성 신호"로 해석할 것.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1. 비로그인 투표 (anon_id PK = 1기기 1표, 변경 가능)
create table if not exists public.fund_votes_anon (
  anon_id    uuid primary key,
  option_id  uuid not null references public.fund_vote_options(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.fund_votes_anon enable row level security;
-- 직접 접근 정책 없음 = service_role / SECURITY DEFINER RPC(cast_fund_vote_anon)로만 쓰기.
-- 결과 열람은 fund_vote_results() RPC로만(개별 표는 비공개).

-- 2. 비로그인 투표 RPC (anon_id upsert로 변경 가능)
create or replace function public.cast_fund_vote_anon(p_option_id uuid, p_anon_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_anon_id is null then raise exception '식별자가 필요해요'; end if;
  if not exists (select 1 from fund_vote_options where id = p_option_id and is_active) then
    raise exception '유효하지 않은 항목이에요';
  end if;
  insert into fund_votes_anon(anon_id, option_id, updated_at)
    values (p_anon_id, p_option_id, now())
    on conflict (anon_id) do update
      set option_id = excluded.option_id, updated_at = now();
end $$;
revoke execute on function public.cast_fund_vote_anon(uuid, uuid) from public;
grant execute on function public.cast_fund_vote_anon(uuid, uuid) to anon, authenticated;

-- 3. 결과 집계 = 로그인 표 + 비로그인 표 합산 (기존 함수 교체)
create or replace function public.fund_vote_results()
returns table(option_id uuid, votes bigint)
language sql security definer set search_path = public stable as $$
  select option_id, count(*)::bigint as votes
  from (
    select option_id from fund_votes
    union all
    select option_id from fund_votes_anon
  ) v
  group by option_id;
$$;
revoke execute on function public.fund_vote_results() from public;
grant execute on function public.fund_vote_results() to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증: select public.fund_vote_results();  → 에러 없이 집계 반환하면 성공.

-- ── 롤백 ──
-- 1) 결과 함수를 로그인 표만 세도록 되돌리기:
-- create or replace function public.fund_vote_results()
-- returns table(option_id uuid, votes bigint)
-- language sql security definer set search_path = public stable as $$
--   select option_id, count(*)::bigint from fund_votes group by option_id;
-- $$;
-- grant execute on function public.fund_vote_results() to anon, authenticated;
-- 2) drop function if exists public.cast_fund_vote_anon(uuid, uuid);
-- 3) drop table if exists public.fund_votes_anon;
-- notify pgrst, 'reload schema';
