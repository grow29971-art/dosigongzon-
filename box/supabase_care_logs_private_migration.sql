-- ══════════════════════════════════════════
-- 돌봄 다이어리 비밀글 (2026-07-13)
-- is_private=true인 기록은 작성자 본인(+관리자)에게만 보임.
-- ⚠ 핵심: RLS SELECT 정책으로 강제 (UI만 숨기면 REST 직접 호출로 노출됨).
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

alter table public.care_logs
  add column if not exists is_private boolean not null default false;

-- 읽기 정책 교체: 공개글은 모두, 비밀글은 작성자 또는 관리자만
drop policy if exists "care_logs_read" on public.care_logs;
create policy "care_logs_read" on public.care_logs
  for select using (
    is_private = false
    or auth.uid() = author_id
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

-- ── 롤백 ──
-- drop policy if exists "care_logs_read" on public.care_logs;
-- create policy "care_logs_read" on public.care_logs for select using (true);
-- alter table public.care_logs drop column if exists is_private;
