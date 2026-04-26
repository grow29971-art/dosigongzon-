-- ══════════════════════════════════════════
-- 푸시 알림 발송 로그 (2026-04-26)
-- 목적: 같은 (user, cat) 페어로 24시간 내 중복 푸시 방지.
-- health-alert-push cron이 매일 돌면서 같은 위급 고양이 알림을
-- 매일 같은 유저에게 보내던 문제를 해결.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

create table if not exists public.push_alert_log (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  cat_id uuid not null references public.cats(id) on delete cascade,
  alert_type text not null default 'urgent_in_area',
  sent_at timestamptz not null default now()
);

-- 핫쿼리: "이 user-cat 페어가 최근 24h 내 푸시 받았나?"
create index if not exists push_alert_log_user_cat_sent_idx
  on public.push_alert_log (user_id, cat_id, sent_at desc);

-- 30일 이상된 로그는 자동 정리 가능하게 별도 인덱스
create index if not exists push_alert_log_sent_at_idx
  on public.push_alert_log (sent_at);

-- RLS — 사용자는 본인 로그만 읽기, 쓰기는 service_role만
alter table public.push_alert_log enable row level security;

drop policy if exists push_alert_log_select_own on public.push_alert_log;
create policy push_alert_log_select_own
  on public.push_alert_log
  for select
  using (user_id = auth.uid());

-- INSERT는 service_role 전용 (cron이 RLS 우회로 직접 INSERT)
-- 별도 정책 없음 → service_role만 가능

comment on table public.push_alert_log is
  '푸시 발송 dedup용 — health-alert-push cron이 같은 알림 중복 발송 방지';
