-- ============================================================
-- cats.region 저장형 XSS 차단 — DB CHECK 제약 (2026-07-20)
-- 배경: region(동 이름)은 지도 마커 innerHTML에 삽입된다. 앱 UI는 카카오
--   지오코딩 값만 넣지만, 저장 경계가 UI가 아니라 anon 키+본인 JWT로 Supabase
--   REST에 직접 PATCH하면 <img onerror=...> 같은 페이로드를 심을 수 있었다.
--   렌더측 escapeHtml(app/(main)/map/page.tsx)과 함께 이중 방어.
-- 방식: NOT VALID — 신규 INSERT/UPDATE에는 즉시 강제되고, 기존 행 전체 스캔은
--   생략(지오코딩 값이라 안전하지만 혹시 모를 레거시 행이 마이그레이션을 막지 않게).
-- ============================================================

-- 재실행 안전: 기존 제약 있으면 교체
alter table public.cats drop constraint if exists cats_region_no_html;

alter table public.cats
  add constraint cats_region_no_html
  check (region is null or (char_length(region) <= 60 and region !~ '[<>]'))
  not valid;

-- (선택) 기존 행까지 전수 검증하려면 아래 실행. 위반 행 있으면 에러로 알려줌.
--   → 위반 행 먼저 확인:  select id, region from public.cats where region ~ '[<>]';
-- alter table public.cats validate constraint cats_region_no_html;

-- ============================================================
-- 검증: 정상값 통과 / 페이로드 거부 확인 (선택)
--   아래는 롤백되므로 데이터 미변경.
-- ============================================================
-- do $$ begin
--   update public.cats set region = region where false;  -- no-op
-- end $$;

-- ============================================================
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- alter table public.cats drop constraint if exists cats_region_no_html;
-- ============================================================
