-- ══════════════════════════════════════════
-- 청원 안내 공지 마이그레이션
-- 2026-07-22 8에이전트 회의 결정: 앱 내 청원 시스템 대신
-- "수집하지 말고, 안내하고, 세라" — 팝업 공지에 외부 링크 CTA + 조회/클릭 계측만.
-- 앱은 서명·동의를 일절 수집하지 않음 (개인정보 민감정보 리스크 차단).
-- 실행: Supabase SQL Editor에서 전체 실행
-- ══════════════════════════════════════════

-- 1) 팝업 공지에 외부 링크 CTA (선택 필드 — 없으면 기존과 동일하게 동작)
alter table public.app_announcements add column if not exists link_url text;
alter table public.app_announcements add column if not exists link_label text;

-- 2) funnel_events 스텝 확장: 청원 공지 조회/클릭
--    (기존 check 제약을 이름 무관하게 제거 후 재생성 — anon_id_len 제약은 건드리지 않음)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.funnel_events'::regclass
      and contype = 'c'
      and conname like '%step%'
  loop
    execute format('alter table public.funnel_events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.funnel_events add constraint funnel_events_step_check
  check (step in (
    'onboarding_intro', 'onboarding_pick', 'signup_home', 'first_feed',
    'petition_notice_view', 'petition_notice_click'
  ));

-- ══════════════════════════════════════════
-- 킬 조건 확인 쿼리 (8/5 점검: 클릭 20건 미만이면 공지 내리기)
-- select step, count(*) from public.funnel_events
--   where step in ('petition_notice_view','petition_notice_click')
--   group by step;
-- ══════════════════════════════════════════

-- ══════════════════════════════════════════
-- 롤백 (전체 되돌리기)
-- alter table public.app_announcements drop column if exists link_url;
-- alter table public.app_announcements drop column if exists link_label;
-- alter table public.funnel_events drop constraint if exists funnel_events_step_check;
-- delete from public.funnel_events where step in ('petition_notice_view','petition_notice_click');
-- alter table public.funnel_events add constraint funnel_events_step_check
--   check (step in ('onboarding_intro','onboarding_pick','signup_home','first_feed'));
-- ══════════════════════════════════════════
