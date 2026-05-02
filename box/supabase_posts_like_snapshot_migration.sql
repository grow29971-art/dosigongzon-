-- ══════════════════════════════════════════
-- posts에 좋아요 스냅샷 컬럼 추가 (매일 묶음 알림용)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS like_count_snapshot int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_snapshot_at    timestamptz NOT NULL DEFAULT now();

-- 첫 도입 시 현재 like_count로 초기화 → delta=0이라 첫 cron은 "받은 좋아요 없음"으로 무알림
UPDATE public.posts
   SET like_count_snapshot = like_count,
       like_snapshot_at    = now()
 WHERE like_count_snapshot < like_count;

NOTIFY pgrst, 'reload schema';
-- 끝.
