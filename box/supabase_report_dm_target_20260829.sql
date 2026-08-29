-- ══════════════════════════════════════════════════════════════
-- reports.target_type에 'dm'(쪽지) 추가 (2026-08-29 법률감사 H2)
-- DM에 신고·차단 진입점이 없어 협박·스토킹 쪽지 대응 불가였음.
-- 기존 CHECK 제약이 dm을 막으므로 값 추가. hospital_closed도 함께 포함(TS 타입에 존재).
-- 실행: Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('comment', 'cat', 'post', 'post_comment', 'hospital_closed', 'dm'));

-- 검증:
--   select pg_get_constraintdef(oid) from pg_constraint where conname='reports_target_type_check';

-- 롤백:
-- alter table public.reports drop constraint if exists reports_target_type_check;
-- alter table public.reports add constraint reports_target_type_check
--   check (target_type in ('comment', 'cat', 'post', 'post_comment'));
