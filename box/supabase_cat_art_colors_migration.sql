-- ══════════════════════════════════════════════════════════════
-- 고양이 마커 캐릭터 실측 색 (art_colors) — 2026-08-04
-- Gemini가 사진에서 뽑은 털 대표색/무늬색 hex를 저장해
-- 지도 캐릭터를 "그 고양이 색"으로 입힌다.
--   { "fur": "#RRGGBB", "pattern": "#RRGGBB" | null }
--   { "none": true }  → 판독 불가/사진 없음 마킹 (백필 재처리 제외용)
-- 신규 등록: app/api/cats/generate-card가 저장.
-- 기존 고양이: POST /api/cron/backfill-cat-art (CRON_SECRET) 반복 호출로 백필.
-- ══════════════════════════════════════════════════════════════

alter table public.cats add column if not exists art_colors jsonb;

-- 검증 (백필 후 확인용):
-- select count(*) filter (where art_colors ? 'fur')  as colored,
--        count(*) filter (where art_colors ? 'none') as skipped,
--        count(*) filter (where art_colors is null and photo_url is not null) as remaining
-- from public.cats;

-- ── 롤백 ──
-- alter table public.cats drop column if exists art_colors;
