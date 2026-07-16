-- ══════════════════════════════════════════
-- 도시공존 — 코어 퍼널·리텐션 진단 (2026-07-16, 12에이전트 브레인스토밍 후속)
-- 목적: 새 계측 없이 기존 타임스탬프만으로 "가입→첫등록→첫돌봄"과 리텐션을 소급 복원.
--   리서치·악마의변호인 공통 지적("성장을 측정 안 하고 기능만 쌓는 중")에 대한 답.
-- 실행: Supabase SQL Editor에서 파트별로 실행. 읽기 전용(SELECT만) — 데이터 변경 없음.
-- ⚠ 더미 구분: 더미 고양이는 caretaker_id IS NULL(실계정 없음). 실유저 퍼널은
--   profiles→cats→care_logs를 유저 id로 조인하므로 더미가 자동 배제됨.
-- ══════════════════════════════════════════

-- ── PART A. 더미 vs 실데이터 규모 (지표 오염도 파악) ──
select
  (select count(*) from public.cats where caretaker_id is not null) as 실고양이,
  (select count(*) from public.cats where caretaker_id is null)     as 더미고양이,
  (select count(*) from public.profiles)                            as 전체회원,
  (select count(distinct caretaker_id) from public.cats where caretaker_id is not null) as 고양이등록회원;

-- ── PART B. 활성화 퍼널: 가입 → 첫 고양이 등록 → 첫 돌봄 ──
-- 각 단계 전환율 + 첫 돌봄까지 걸린 시간(중앙값, 시간 단위).
with u as (
  select id, created_at from public.profiles
),
first_cat as (
  select caretaker_id as uid, min(created_at) as t
  from public.cats where caretaker_id is not null group by caretaker_id
),
first_care as (
  select author_id as uid, min(logged_at) as t
  from public.care_logs group by author_id
)
select
  count(*)                                                            as 가입,
  count(fc.uid)                                                       as 고양이등록,
  round(100.0 * count(fc.uid)  / nullif(count(*), 0), 1)              as 등록전환율_pct,
  count(fca.uid)                                                      as 첫돌봄,
  round(100.0 * count(fca.uid) / nullif(count(*), 0), 1)             as 돌봄전환율_pct,
  round(100.0 * count(fca.uid) / nullif(count(fc.uid), 0), 1)        as 등록후돌봄전환_pct,
  round(percentile_cont(0.5) within group (
    order by extract(epoch from (fca.t - u.created_at)) / 3600.0
  ) filter (where fca.uid is not null)::numeric, 1)                   as 첫돌봄까지_중앙시간h
from u
left join first_cat  fc  on fc.uid  = u.id
left join first_care fca on fca.uid = u.id;

-- ── PART C. 주간 리텐션: 첫 돌봄 후 재방문(재돌봄) ──
-- 첫 돌봄한 유저 중, 첫 돌봄일로부터 7일 이후에 또 돌봄한 비율 = 끈끈함의 최소 신호.
-- (허영지표 방문수 대신 '능동 행동' 기준 — 리서치 권고)
with first_care as (
  select author_id as uid, min(logged_at) as first_t
  from public.care_logs group by author_id
),
returned as (
  select fc.uid
  from first_care fc
  join public.care_logs cl
    on cl.author_id = fc.uid
   and cl.logged_at >= fc.first_t + interval '7 days'
  group by fc.uid
)
select
  (select count(*) from first_care)                                       as 첫돌봄유저,
  (select count(*) from returned)                                         as w1재돌봄유저,
  round(100.0 * (select count(*) from returned)
              / nullif((select count(*) from first_care), 0), 1)          as w1재돌봄률_pct;

-- ── PART D. 가입 주차별 코호트 (소표본이라 %보다 절대건수로 방향만) ──
-- 주의(리서치): n=300, 코호트당 수십 명이라 % 소수점 비교로 A/B 판정 금지.
select
  date_trunc('week', p.created_at at time zone 'Asia/Seoul')::date       as 가입주차,
  count(*)                                                               as 가입,
  count(distinct c.caretaker_id)                                        as 등록,
  count(distinct cl.author_id)                                          as 돌봄
from public.profiles p
left join public.cats c       on c.caretaker_id = p.id
left join public.care_logs cl on cl.author_id  = p.id
group by 1 order by 1 desc
limit 12;

-- 해석 가이드:
--  · PART B 돌봄전환율이 낮으면(현재 ~7% 추정) 게임·다마고치보다 "등록→첫돌봄" 마찰 제거가 우선.
--  · PART C w1재돌봄률이 코어 리텐션. 이게 안 오르면 신규 기능은 리텐션을 못 만든 것.
--  · 시드/더미(fund_vote_options.seed_votes 등)는 분석 대상 아님 — 위 쿼리는 실행동만 집계.
