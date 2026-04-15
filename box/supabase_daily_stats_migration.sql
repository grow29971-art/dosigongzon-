-- ══════════════════════════════════════════
-- 일일 방문자 통계 테이블 (순 방문자 기준)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 일별 총 방문자 수
CREATE TABLE IF NOT EXISTS public.daily_stats (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  visit_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_stats_read_all" ON public.daily_stats;
CREATE POLICY "daily_stats_read_all" ON public.daily_stats
  FOR SELECT USING (true);

-- 유저별 일일 방문 기록 (중복 방지용)
CREATE TABLE IF NOT EXISTS public.daily_visits (
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (date, user_id)
);

ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_visits_insert_own" ON public.daily_visits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 순 방문자 증가 함수 (같은 유저는 하루에 한 번만 카운트)
CREATE OR REPLACE FUNCTION increment_daily_visit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result INTEGER;
  already_visited BOOLEAN;
BEGIN
  -- 이미 오늘 방문했는지 확인
  SELECT EXISTS(
    SELECT 1 FROM public.daily_visits
    WHERE date = CURRENT_DATE AND user_id = p_user_id
  ) INTO already_visited;

  -- 처음 방문이면 기록 + 카운트 증가
  IF NOT already_visited THEN
    INSERT INTO public.daily_visits (date, user_id) VALUES (CURRENT_DATE, p_user_id);
    INSERT INTO public.daily_stats (date, visit_count)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date)
    DO UPDATE SET visit_count = daily_stats.visit_count + 1;
  END IF;

  SELECT visit_count INTO result FROM public.daily_stats WHERE date = CURRENT_DATE;
  RETURN COALESCE(result, 0);
END;
$$;
