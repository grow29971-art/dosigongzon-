-- ══════════════════════════════════════════
-- 경보(alert) 기록 레벨 제한 (레벨 1 이상)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_comment_level_migration.sql (author_level 컬럼 필요)
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
--
-- 정책:
--  - cat_comments.kind = 'alert' 인 행은 author_level >= 1 이어야 함
--  - 일반 댓글(note)에는 제약 없음
--  - 클라이언트가 레벨을 위조할 가능성은 있지만, 최소한 "선언된 레벨 ≥ 1"은 강제됨
-- ══════════════════════════════════════════

alter table public.cat_comments
  drop constraint if exists cat_comments_alert_requires_level;

alter table public.cat_comments
  add constraint cat_comments_alert_requires_level
  check (
    kind <> 'alert'
    or (author_level is not null and author_level >= 1)
  );

-- 스키마 캐시 재로드
notify pgrst, 'reload schema';

-- 끝.
