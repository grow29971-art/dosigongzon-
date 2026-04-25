-- ══════════════════════════════════════════
-- 더미 고양이 전체 삭제 (유저 등록분만 남기기)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ 1단계 결과 확인 후 2단계 실행할 것
-- ══════════════════════════════════════════
-- 판별 기준: caretaker_id IS NULL = 더미 (시드 SQL은 caretaker_id 안 넣음)
-- 유저가 앱에서 등록한 고양이는 caretaker_id에 본인 UUID가 들어감.
-- cat_comments / care_logs / cat_likes / cat_location_history는 ON DELETE CASCADE로 자동 정리.
-- ══════════════════════════════════════════

-- ─────────────────────────────────
-- 1단계: 삭제 대상 미리 확인
-- ─────────────────────────────────
SELECT
  COUNT(*) AS 삭제될_더미_수
FROM public.cats
WHERE caretaker_id IS NULL;

SELECT
  COUNT(*) AS 남게될_유저등록_수
FROM public.cats
WHERE caretaker_id IS NOT NULL;

-- 샘플 미리보기 (상위 10건)
SELECT id, name, region, caretaker_name, created_at
FROM public.cats
WHERE caretaker_id IS NULL
ORDER BY created_at DESC
LIMIT 10;


-- ─────────────────────────────────
-- 2단계: 실제 삭제 (위 결과 확인 후 아래 줄 주석 풀고 실행)
-- ─────────────────────────────────
-- DELETE FROM public.cats WHERE caretaker_id IS NULL;
