-- 채팅/쪽지에 아바타 URL 컬럼 추가
-- 실행: Supabase SQL Editor

alter table public.direct_messages
  add column if not exists sender_avatar_url text;

alter table public.area_chats
  add column if not exists author_avatar_url text;

alter table public.area_chats
  add column if not exists author_level int;

notify pgrst, 'reload schema';
