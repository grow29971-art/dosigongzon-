-- ══════════════════════════════════════════
-- 약국 중복 제거 (같은 이름+주소 중 1건만 유지)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

DELETE FROM public.rescue_hospitals a
USING public.rescue_hospitals b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.address = b.address
  AND a.source = 'manual';
