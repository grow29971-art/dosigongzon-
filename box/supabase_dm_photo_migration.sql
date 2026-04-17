-- 쪽지에 사진 첨부 기능 추가
-- 실행: Supabase SQL Editor
-- Chrome 번역 OFF

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

NOTIFY pgrst, 'reload schema';
