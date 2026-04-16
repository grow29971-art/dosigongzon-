-- 전화번호 없는 병원 일괄 삭제
-- 실행 위치: Supabase Dashboard → SQL Editor

DELETE FROM public.rescue_hospitals
WHERE phone IS NULL OR TRIM(phone) = '';
