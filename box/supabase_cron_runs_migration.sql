-- ══════════════════════════════════════════
-- 크론 하트비트 테이블 — Vercel Cron 실제 호출 여부 진단 (2026-07-13)
-- 배경: admin-daily-digest(23:00 UTC)가 코드·인증 정상인데 스케줄 호출이 안 옴.
--       rescue_hospitals는 4/16 이후 미갱신 (sync-pharmacies 18:00 UTC 의심).
--       proxy.ts가 /api/cron/* 호출을 전부 이 테이블에 기록 → 다음날 어떤
--       크론이 실제로 호출됐는지 확정 진단.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

create table if not exists public.cron_runs (
  id       bigint generated always as identity primary key,
  name     text not null,          -- 크론 이름 (예: admin-daily-digest)
  method   text,                   -- GET/POST
  has_auth boolean,                -- Authorization 헤더 존재 여부
  ran_at   timestamptz not null default now()
);

create index if not exists cron_runs_name_ran_idx
  on public.cron_runs (name, ran_at desc);

-- RLS: 정책 없이 활성화 = anon/authenticated 접근 전면 차단.
-- 기록·조회는 service_role(프록시/운영 스크립트)만.
alter table public.cron_runs enable row level security;

-- 진단 쿼리 (다음날 아침 실행):
-- select name, method, has_auth, ran_at at time zone 'Asia/Seoul' as kst
--   from cron_runs order by ran_at desc limit 50;

-- ── 롤백 ──
-- drop index if exists cron_runs_name_ran_idx;
-- drop table if exists public.cron_runs;
