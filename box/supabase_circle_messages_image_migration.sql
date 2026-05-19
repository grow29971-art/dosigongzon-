-- ══════════════════════════════════════════
-- 도시공존 — Circle Messages 이미지 첨부 지원
-- 목적: 서클 채팅에 사진 1장 첨부 가능하게.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_messages_migration.sql
-- ══════════════════════════════════════════

-- body는 이미지만 보낼 때 빈 문자열 허용 — 기존 check (1-1000) 완화
alter table public.circle_messages
  drop constraint if exists circle_messages_body_check;

-- body 또는 image_url 둘 중 하나는 있어야 함 — 별도 check
alter table public.circle_messages
  add column if not exists image_url text;

alter table public.circle_messages
  drop constraint if exists circle_messages_content_check;
alter table public.circle_messages
  add constraint circle_messages_content_check
  check (
    (char_length(body) between 0 and 1000)
    and (body <> '' or image_url is not null)
  );

notify pgrst, 'reload schema';
