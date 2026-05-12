-- ══════════════════════════════════════════════════════════════
-- 동물숏츠 영상 데이터만 비우기 (기능·UI는 유지)
-- 작성: 2026-05-11
-- 실행 위치: Supabase Dashboard
-- ⚠ Chrome 번역 OFF
-- ⚠ 데이터 손실 — 한 번 실행하면 영상 복구 불가
--   (테이블·버킷·코드는 유지 → 나중에 다시 영상 업로드 가능)
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1단계: 현재 상황 확인 (READ ONLY)
-- ─────────────────────────────────────────────
select 'shorts_table_rows' as 항목, count(*)::text as 값 from public.shorts
union all
select 'shorts_bucket_files',
       count(*)::text || ' (' ||
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) || ')'
from storage.objects where bucket_id = 'shorts';


-- ─────────────────────────────────────────────
-- 2단계: Storage 파일 삭제 — 대시보드 UI 사용
-- ─────────────────────────────────────────────
-- Supabase가 storage.objects 직접 DELETE를 막아둠 (protect_delete 트리거).
-- 아래 절차로 진행:
--
-- (a) Dashboard → Storage → "shorts" 버킷 클릭
-- (b) 우측 상단 체크박스로 전체 선택
-- (c) "Delete" 클릭
--
-- ⚠ 버킷 자체는 지우지 마세요 (다시 영상 올릴 자리 필요).


-- ─────────────────────────────────────────────
-- 3단계: shorts 테이블 행만 비우기 (테이블·스키마 유지)
-- ─────────────────────────────────────────────
delete from public.shorts;


-- ─────────────────────────────────────────────
-- 4단계: 확인 (모두 0이어야 정상)
-- ─────────────────────────────────────────────
select count(*) as remaining_rows from public.shorts;       -- 0
select count(*) as remaining_files
from storage.objects where bucket_id = 'shorts';            -- 0
select count(*) as bucket_still_exists
from storage.buckets where id = 'shorts';                   -- 1 (유지)

-- 끝.
-- 코드/라우트/하단 네비/관리자 메뉴 모두 그대로 살아있음.
-- 어드민 → 숏폼 영상 관리에서 새 영상 업로드하면 다시 시작 가능.
