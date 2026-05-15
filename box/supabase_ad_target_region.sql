-- ════════════════════════════════════════════════════════════
-- 도시공존 — 광고 집중 지역 자동 결정 (결과 1행)
-- 실행: Supabase SQL Editor → Run → 결과 1행 텍스트만 복사
-- ════════════════════════════════════════════════════════════

with ranked as (
  select
    region,
    count(distinct caretaker_id) as caretakers,
    count(*) as cats,
    count(*) filter (where created_at > now() - interval '14 days') as cats_14d,
    row_number() over (
      order by count(distinct caretaker_id) desc,
               count(*) filter (where created_at > now() - interval '14 days') desc,
               count(*) desc
    ) as rn
  from public.cats
  where region is not null and region <> ''
  group by region
)
select
  '광고 집중 추천 TOP 3: ' || string_agg(
    region || ' (캣맘 ' || caretakers || '명 · 고양이 ' || cats || '마리)',
    ' | ' order by rn
  ) || ' / 최근 14일 신규 등록 ' || sum(cats_14d) || '건' as ad_target_recommendation
from ranked
where rn <= 3;
