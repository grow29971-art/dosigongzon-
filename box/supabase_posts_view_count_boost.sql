-- ══════════════════════════════════════════
-- 모든 게시글 조회수 baseline 50~100 부여 (일회성 패치)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 정책: 이미 그 이상인 글은 유지(GREATEST), 그 미만은 50~100 사이 랜덤으로 끌어올림
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

UPDATE public.posts
   SET view_count = GREATEST(
     view_count,
     50 + floor(random() * 51)::int   -- 50 ~ 100 (양 끝 포함)
   );

-- 변경 결과 확인
SELECT
  count(*)                          AS total,
  min(view_count)                   AS min_views,
  max(view_count)                   AS max_views,
  round(avg(view_count)::numeric,1) AS avg_views
FROM public.posts;

-- 끝.
