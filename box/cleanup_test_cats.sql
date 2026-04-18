-- ══════════════════════════════════════════
-- 테스트 고양이 삭제 (1회성 스크립트)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ 필수 절차: 1 → 2 순서로, 1단계 결과 확인 후 2단계 실행
-- ══════════════════════════════════════════

-- ─────────────────────────────────
-- 1단계: 삭제 대상 미리 확인 (이거 먼저 실행)
-- ─────────────────────────────────
SELECT
  c.id,
  c.name,
  c.region,
  c.caretaker_name,
  c.created_at
FROM public.cats c
JOIN auth.users u ON u.id = c.caretaker_id
WHERE u.email = 'grow29971@gmail.com'
ORDER BY c.created_at DESC;

-- 개수 확인
SELECT COUNT(*) AS 삭제될_고양이_수
FROM public.cats c
JOIN auth.users u ON u.id = c.caretaker_id
WHERE u.email = 'grow29971@gmail.com';


-- ─────────────────────────────────
-- 2단계: 실제 삭제 (1단계 결과가 맞으면 아래 블록 주석 풀고 실행)
-- ─────────────────────────────────
-- DELETE FROM public.cats
-- WHERE caretaker_id = (SELECT id FROM auth.users WHERE email = 'grow29971@gmail.com');

-- 연관 테이블(cat_comments, care_logs)은 ON DELETE CASCADE 로 자동 삭제됨.


-- ─────────────────────────────────
-- (선택) 특정 개수만 지우고 싶을 때: 가장 오래된 60개만 남기고 최근 것 삭제 등
-- ─────────────────────────────────
-- DELETE FROM public.cats
-- WHERE id IN (
--   SELECT c.id FROM public.cats c
--   JOIN auth.users u ON u.id = c.caretaker_id
--   WHERE u.email = 'grow29971@gmail.com'
--   ORDER BY c.created_at DESC
--   LIMIT 60
-- );
