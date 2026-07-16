-- ══════════════════════════════════════════
-- 진짜 지표 진단 (시드·운영자 제외) — 2026-07-17
-- 목적: 가입 317·활성화 72% 같은 "부풀린 숫자"를 걷어내고 실제를 본다.
--   - 시드/데모 고양이: caretaker_id IS NULL (136마리) → 제외
--   - 운영자 계정: 대량 DM(209/213)·글 작성자 = 아래 FOUNDER uid → 제외
-- 실행 위치: Supabase Dashboard → SQL Editor (읽기 전용, 새 객체 생성 없음)
-- ⚠ FOUNDER uid가 본인(운영자) 맞는지 먼저 확인하고 필요시 교체.
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- [D] 실지표 — 시드·운영자 제외한 진짜 숫자
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
act as (
  select caretaker_id as user_id, created_at as at from public.cats where caretaker_id is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select sender_id, created_at from public.direct_messages where sender_id is not null
  union all select author_id, logged_at from public.care_logs where author_id is not null
)
select '가입자(전체)'                    as 지표, (select count(*) from public.profiles)::text as 값
union all select '실제 고양이 주인 수',    (select count(distinct caretaker_id) from public.cats where caretaker_id is not null)::text
union all select '주인 없는 고양이(시드)', (select count(*) from public.cats where caretaker_id is null)::text
union all select '실제 활성화율(주인/가입)',
  (select round(100.0*count(distinct caretaker_id)/nullif((select count(*) from public.profiles),0),1) from public.cats where caretaker_id is not null)::text || '%'
union all select '최근7일 활성유저(운영자 제외)',
  (select count(distinct user_id) from act where user_id <> (select uid from founder) and at >= now() - interval '7 days')::text
union all select '최근30일 활성유저(운영자 제외)',
  (select count(distinct user_id) from act where user_id <> (select uid from founder) and at >= now() - interval '30 days')::text
union all select '쪽지 총건 / 고유발신자',
  (select count(*)::text || ' / ' || count(distinct sender_id)::text from public.direct_messages);

-- ──────────────────────────────────────────
-- [A] 인터뷰 대상 목록 — 실제 유저(주인) 닉네임·가입일·마지막활동·고양이수
--     마지막활동 최신순. 상단(최근 활동) = "왜 계속 오나", 하단(오래 잠수) = "왜 안 오나".
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
act as (
  select caretaker_id as user_id, created_at as at from public.cats where caretaker_id is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select sender_id, created_at from public.direct_messages where sender_id is not null
  union all select author_id, logged_at from public.care_logs where author_id is not null
),
last_act as (select user_id, max(at) as last_at from act group by user_id),
owners as (select distinct caretaker_id as uid from public.cats where caretaker_id is not null)
select p.nickname                                   as 닉네임,
       p.created_at::date                           as 가입일,
       la.last_at::date                             as 마지막활동,
       (now()::date - la.last_at::date)             as 잠수일수,
       (select count(*) from public.cats c where c.caretaker_id = p.id) as 고양이수
from public.profiles p
join owners o on o.uid = p.id
left join last_act la on la.user_id = p.id
where p.id <> (select uid from founder)
order by la.last_at desc nulls last;

-- ──────────────────────────────────────────
-- [B] 주간 리텐션 코호트 — 가입 주차별 W0/W1/W2/W4 재방문(활동) 인원
--     활동 = 고양이등록/글/쪽지/케어로그 중 하나라도. 운영자 제외.
--     W1 이후가 코호트인원 대비 몇 %인지가 리텐션. (지금은 대부분 0에 가까울 것)
-- ──────────────────────────────────────────
with founder as (select '3d1fd566-6686-4b46-a0af-63170033600c'::uuid as uid),
act as (
  select user_id, date_trunc('week', at) as wk from (
    select caretaker_id as user_id, created_at as at from public.cats where caretaker_id is not null
    union all select author_id, created_at from public.posts where author_id is not null
    union all select sender_id, created_at from public.direct_messages where sender_id is not null
    union all select author_id, logged_at from public.care_logs where author_id is not null
  ) e
  where user_id <> (select uid from founder)
),
cohort as (
  select id as user_id, date_trunc('week', created_at) as signup_wk
  from public.profiles where id <> (select uid from founder)
)
select c.signup_wk::date as 가입주,
       count(distinct c.user_id) as 코호트인원,
       count(distinct case when a.wk = c.signup_wk                          then a.user_id end) as w0,
       count(distinct case when a.wk = c.signup_wk + interval '1 week'      then a.user_id end) as w1,
       count(distinct case when a.wk = c.signup_wk + interval '2 week'      then a.user_id end) as w2,
       count(distinct case when a.wk = c.signup_wk + interval '4 week'      then a.user_id end) as w4
from cohort c
left join act a on a.user_id = c.user_id
group by c.signup_wk
order by c.signup_wk;
