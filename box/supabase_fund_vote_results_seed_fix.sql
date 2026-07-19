-- ══════════════════════════════════════════
-- fund_vote_results() 회귀 수정 — baseline seed_votes 복구 (2026-07-19)
-- 원인: 2026-07-18 비로그인 투표 마이그레이션(supabase_fund_vote_anon_migration.sql)이
--   fund_vote_results()를 새로 쓰면서 seed_votes 항목을 누락 → 표시 88→8로 급락.
--   (seed_votes 데이터 자체는 무손실, 읽는 함수만 잘못됨)
-- 수정: seed_votes + (로그인 실제표 + 비로그인 실제표)로 되돌림. 활성 항목 전체 반환.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

create or replace function public.fund_vote_results()
returns table(option_id uuid, votes bigint)
language sql security definer set search_path = public stable as $$
  select o.id as option_id,
         (o.seed_votes + coalesce(r.cnt, 0))::bigint as votes
  from public.fund_vote_options o
  left join (
    select option_id, count(*) as cnt
    from (
      select option_id from public.fund_votes
      union all
      select option_id from public.fund_votes_anon
    ) v
    group by option_id
  ) r on r.option_id = o.id
  where o.is_active;
$$;
revoke execute on function public.fund_vote_results() from public;
grant execute on function public.fund_vote_results() to anon, authenticated;

notify pgrst, 'reload schema';

-- 검증: select public.fund_vote_results();  → seed(80)+실제(8)=88 합계 나오면 복구 성공.

-- ── 롤백 (seed 다시 제외, 실제표만) ──
-- create or replace function public.fund_vote_results()
-- returns table(option_id uuid, votes bigint)
-- language sql security definer set search_path = public stable as $$
--   select option_id, count(*)::bigint as votes
--   from (select option_id from fund_votes union all select option_id from fund_votes_anon) v
--   group by option_id;
-- $$;
-- grant execute on function public.fund_vote_results() to anon, authenticated;
-- notify pgrst, 'reload schema';
