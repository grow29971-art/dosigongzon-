-- ══════════════════════════════════════════
-- SECURITY DEFINER 뷰 → security_invoker 전환
-- Supabase 보안 어드바이저 경고 처리
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════
--
-- 배경: PostgreSQL 뷰는 기본적으로 작성자(postgres) 권한으로 실행돼
-- 하부 테이블의 RLS를 우회함. `security_invoker = true` 옵션을 켜면
-- 호출 유저의 권한·RLS가 정상 적용됨.

-- ════════════════════════════════════════
-- 1. v_recent_cat_location_changes
--    (admin 페이지: /admin/location-logs)
--    하부 cat_location_history 의 RLS = admin/changed_by/caretaker
--    security_invoker 적용 시 자동으로 그 권한대로 필터됨.
-- ════════════════════════════════════════

drop view if exists public.v_recent_cat_location_changes;

create view public.v_recent_cat_location_changes
with (security_invoker = true) as
select
  h.id,
  h.cat_id,
  c.name as cat_name,
  h.changed_by,
  h.changed_by_name,
  h.old_region,
  h.new_region,
  h.distance_m,
  h.created_at
from public.cat_location_history h
left join public.cats c on c.id = h.cat_id
order by h.created_at desc;

grant select on public.v_recent_cat_location_changes to authenticated;

-- ════════════════════════════════════════
-- 2. my_invite_stats
--    호출 유저 본인의 초대 코드와 초대 인원 수
--    뷰 안에서 auth.uid() 필터 — 다른 유저 행 노출 자체가 불가
-- ════════════════════════════════════════

drop view if exists public.my_invite_stats;

create view public.my_invite_stats
with (security_invoker = true) as
select
  p.id as user_id,
  p.invite_code,
  coalesce(cnt.n, 0) as invited_count
from public.profiles p
left join (
  select inviter_id, count(*) as n
  from public.invite_events
  group by inviter_id
) cnt on cnt.inviter_id = p.id
where p.id = auth.uid();

grant select on public.my_invite_stats to authenticated;

-- PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
