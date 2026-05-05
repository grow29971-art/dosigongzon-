-- ══════════════════════════════════════════
-- 도시공존 — shorts 테이블에 원본 채널 정보 컬럼 추가
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
-- 선행조건: supabase_shorts_youtube_migration.sql
-- 목적: YouTube 임베드 영상의 원작자 채널 표시 → 저작권 안전장치 + 윤리적 출처 표기
-- ══════════════════════════════════════════

alter table public.shorts
  add column if not exists youtube_channel_name text,
  add column if not exists youtube_channel_url  text;

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';

-- 끝.
