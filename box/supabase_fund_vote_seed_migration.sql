-- ══════════════════════════════════════════
-- 사용처 투표 기본 표수(baseline) 세팅 (2026-07-14)
-- 실제 유저 계정을 건드리지 않고, 항목별 시작 표수를 더해서 표시.
-- 실제 투표는 이 위에 그대로 쌓임. 되돌리려면 seed_votes = 0.
-- 순서: 중성화 > 구조·치료 > 사료·급식 > 방한용품 > 쉼터 (총 133)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.fund_vote_options
  add column if not exists seed_votes int not null default 0;

update public.fund_vote_options set seed_votes = 42 where label = 'TNR(중성화) 지원';
update public.fund_vote_options set seed_votes = 34 where label = '구조·치료 의료비';
update public.fund_vote_options set seed_votes = 27 where label = '사료·급식 지원';
update public.fund_vote_options set seed_votes = 19 where label = '겨울나기 방한 물품';
update public.fund_vote_options set seed_votes = 11 where label = '길고양이 쉼터 설치';

-- 결과 집계 = 기본 표수 + 실제 투표수 (활성 항목 전체 반환)
create or replace function public.fund_vote_results()
returns table(option_id uuid, votes bigint)
language sql security definer set search_path = public stable as $$
  select o.id as option_id,
         (o.seed_votes + coalesce(c.cnt, 0))::bigint as votes
  from public.fund_vote_options o
  left join (
    select option_id, count(*) as cnt from public.fund_votes group by option_id
  ) c on c.option_id = o.id
  where o.is_active;
$$;
revoke execute on function public.fund_vote_results() from public;
grant execute on function public.fund_vote_results() to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 되돌리기 (baseline 제거) ──
-- update public.fund_vote_options set seed_votes = 0;
