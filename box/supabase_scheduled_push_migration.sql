-- ══════════════════════════════════════════
-- 푸시 예약 발송 (2026-08-06)
--
-- 목적: 관리자가 미리 문구를 써두고 지정 시각에 자동 발송.
--       (기존 /admin/push는 버튼을 누르는 즉시 나가는 구조라 "그 시각에 사람이
--        직접 눌러야" 했다)
--
-- 동작: /api/cron/scheduled-push 가 매일 13:00 KST에 돌면서
--       scheduled_at <= now() 이고 status='pending' 인 예약을 발송한다.
--       Vercel Hobby 플랜은 크론이 하루 1회라 체크포인트가 하루 한 번이다.
--       → 예약 시각은 "그 시각 이후 첫 체크포인트에 나간다"는 뜻.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: admins 테이블
--
-- ⚠ Supabase SQL Editor는 실행을 자체 트랜잭션으로 감싼다. 한 문장을 여러 줄로
--   나누면 파서가 끊어 읽어 42601이 날 수 있어, 문장당 한 줄로 작성했다.
--   아래 블록을 통째로 복사해 붙여넣고 Run 하면 된다.
-- ══════════════════════════════════════════


-- 1) 테이블
create table if not exists public.scheduled_pushes (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default '도시공존',
  body          text not null check (char_length(body) between 1 and 200),
  url           text not null default '/',
  scheduled_at  timestamptz not null,
  -- sending: 크론이 선점한 상태(중복 발송 방어용). 정상 흐름에서는 곧 sent로 바뀌고,
  --          sending으로 남아 있으면 발송 후 기록에 실패한 건이라 수동 확인 대상이다.
  status        text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  sent_count    integer,
  total_count   integer,
  sent_at       timestamptz,
  error_note    text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- 2) 크론이 매번 훑는 조건 (대기 중 + 시각 도래)
create index if not exists scheduled_pushes_due_idx on public.scheduled_pushes (scheduled_at) where status = 'pending';

-- 3) RLS
alter table public.scheduled_pushes enable row level security;

-- 조회: 관리자만 (발송 이력 확인)
drop policy if exists "scheduled_push_select_admin" on public.scheduled_pushes;
create policy "scheduled_push_select_admin" on public.scheduled_pushes for select to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 생성: 관리자만 + 본인 명의로만
drop policy if exists "scheduled_push_insert_admin" on public.scheduled_pushes;
create policy "scheduled_push_insert_admin" on public.scheduled_pushes for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 수정: 관리자만 (취소 용도). 이미 발송된 건은 못 건드리게 pending일 때만 허용.
drop policy if exists "scheduled_push_update_admin" on public.scheduled_pushes;
create policy "scheduled_push_update_admin" on public.scheduled_pushes for update to authenticated using (status = 'pending' and exists (select 1 from public.admins a where a.user_id = auth.uid())) with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- DELETE 정책 없음 = 삭제 불가. 취소는 status='cancelled'로 남긴다(발송 이력 보존).
-- 실제 발송은 service_role(크론)이 RLS를 우회해 수행한다.


-- ── 확인 (실행 후) ──
-- ⓐ 테이블이 생겼는지 — 한 줄 나오면 성공
select tablename from pg_tables where schemaname = 'public' and tablename = 'scheduled_pushes';

-- ⓑ 정책 3개가 붙었는지 — 3줄 나오면 성공
select polname from pg_policy where polrelid = 'public.scheduled_pushes'::regclass;


-- ══════════════════════════════════════════
-- 롤백 (되돌리려면)
-- ══════════════════════════════════════════
-- drop table if exists public.scheduled_pushes;
