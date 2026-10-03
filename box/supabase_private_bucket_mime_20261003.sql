-- ══════════════════════════════════════════
-- 비공개 버킷 형식·용량 제한 (10/3 보안 감사 낮음 항목)
-- 증상: report-evidence·circle-photos는 MIME 제한이 없어 본인 폴더에 text/html·svg를 올릴 수 있었다
--       (관리자·서클원이 서명 URL을 열면 *.supabase.co 출처에서 렌더). cat-photos는 10/2에 제한함.
-- 앱 업로드는 전부 image/webp(lib/evidence-repo.ts:61, lib/circle-chat-repo.ts:52) — 기존 파일엔 영향 없음.
-- 실행: Supabase SQL Editor  ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'],
       file_size_limit = 10485760
 where id in ('report-evidence', 'circle-photos');

-- ── 검증 ──
-- select id, public, allowed_mime_types, file_size_limit from storage.buckets where id in ('cat-photos','report-evidence','circle-photos');
--   → 세 버킷 모두 {image/webp,image/jpeg,image/png} · 10485760, report-evidence·circle-photos는 public=false
-- ── 롤백 ──
-- update storage.buckets set allowed_mime_types = null, file_size_limit = null where id in ('report-evidence', 'circle-photos');
