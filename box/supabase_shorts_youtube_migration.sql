-- ══════════════════════════════════════════
-- 도시공존 — shorts 테이블에 YouTube 임베드 지원 추가
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF (SQL을 망가뜨림)
-- 선행조건: supabase_shorts_migration.sql (shorts 테이블)
-- 목적: 직접 mp4 업로드 외에 YouTube Shorts URL을 붙여넣으면 iframe 임베드로 재생
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 컬럼 추가
-- ──────────────────────────────────────────
alter table public.shorts
  add column if not exists youtube_url      text,
  add column if not exists youtube_video_id text;

-- 인덱스 (중복 등록 방지·검색용)
create index if not exists shorts_youtube_video_id_idx
  on public.shorts (youtube_video_id)
  where youtube_video_id is not null;

-- ──────────────────────────────────────────
-- 2. video_url을 NULLABLE로 변경
--    (YouTube 임베드 사용 시 mp4가 없어도 됨)
-- ──────────────────────────────────────────
alter table public.shorts
  alter column video_url drop not null;

-- 둘 중 하나는 반드시 있어야 함 (DB 차원 보장)
alter table public.shorts
  drop constraint if exists shorts_source_present;
alter table public.shorts
  add constraint shorts_source_present
  check (
    (video_url is not null and length(trim(video_url)) > 0)
    or
    (youtube_video_id is not null and length(trim(youtube_video_id)) > 0)
  );

-- ──────────────────────────────────────────
-- 3. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
