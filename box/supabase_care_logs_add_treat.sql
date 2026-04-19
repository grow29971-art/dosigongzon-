-- ══════════════════════════════════════════
-- 돌봄 일지 care_type에 'treat' (간식 줌) 추가
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- 기존 CHECK 제약 교체
alter table public.care_logs
  drop constraint if exists care_logs_care_type_check;

alter table public.care_logs
  add constraint care_logs_care_type_check
  check (care_type in (
    'feed', 'water', 'treat', 'health', 'tnr', 'hospital', 'shelter', 'other'
  ));

NOTIFY pgrst, 'reload schema';
-- 끝.
