-- AI집사 사용 계측 테이블 (2026-07-21)
-- 목적: 쇼핑 동선 회의 조건 — "AI집사 탭 제거/이동은 사용 로그 확인 후" 판단 근거 수집.
-- 기존엔 console.log뿐이라 사용량 데이터가 전무했음. 결제 오픈 D-day 전까지 쌓아서 판단.
-- 실행: Supabase SQL Editor. 실행 전에도 앱은 정상(코드가 에러를 조용히 무시).

create table if not exists ai_chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table ai_chat_logs enable row level security;

-- 본인 인증 유저가 본인 행만 insert (서버 라우트가 유저 세션으로 기록)
drop policy if exists "ai_chat_logs_insert_own" on ai_chat_logs;
create policy "ai_chat_logs_insert_own" on ai_chat_logs
  for insert with check (auth.uid() = user_id);

-- 조회는 아무도 못 함 (집계는 service_role로만) — select 정책 없음이 의도

-- 집계 예시 (판단 시 service_role로):
--   select date_trunc('week', created_at) w, count(*) uses, count(distinct user_id) users
--   from ai_chat_logs group by 1 order by 1 desc;

-- ── 롤백 ──
-- drop table if exists ai_chat_logs;
