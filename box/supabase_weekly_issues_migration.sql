-- ══════════════════════════════════════════
-- 이번 주 동네 이슈(weekly_issues) 테이블 + RLS + 시드
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_news_admin_migration.sql (admins 테이블 필요)
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.weekly_issues (
  id             uuid primary key default gen_random_uuid(),
  emoji          text,
  title          text not null,
  body           text,
  week_start     date not null,                    -- 월요일 기준 권장 (admin이 직접 입력)
  external_url   text,
  external_label text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS weekly_issues_week_start_idx
  ON public.weekly_issues (week_start DESC);

ALTER TABLE public.weekly_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_issues_read_public" ON public.weekly_issues;
CREATE POLICY "weekly_issues_read_public"
  ON public.weekly_issues FOR SELECT USING (true);

DROP POLICY IF EXISTS "weekly_issues_insert_admin" ON public.weekly_issues;
CREATE POLICY "weekly_issues_insert_admin"
  ON public.weekly_issues FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "weekly_issues_update_admin" ON public.weekly_issues;
CREATE POLICY "weekly_issues_update_admin"
  ON public.weekly_issues FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "weekly_issues_delete_admin" ON public.weekly_issues;
CREATE POLICY "weekly_issues_delete_admin"
  ON public.weekly_issues FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
-- 끝.
