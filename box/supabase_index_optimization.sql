-- ══════════════════════════════════════════
-- DB 인덱스 최적화
-- 자주 쓰이는 쿼리 패턴에 맞춰 누락된 인덱스 추가
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

-- ── 1. cats ──
-- 동 단위 그룹핑 (region별 클러스터)
create index if not exists cats_region_idx
  on public.cats (region);

-- 내 고양이 목록 (마이페이지)
create index if not exists cats_caretaker_idx
  on public.cats (caretaker_id, created_at desc);

-- 숨김 필터 + 생성일 (RLS + 목록)
create index if not exists cats_hidden_created_idx
  on public.cats (hidden, created_at desc);

-- ── 2. cat_comments ──
-- 경보 필터 (학대 경보 카운트)
create index if not exists cat_comments_kind_idx
  on public.cat_comments (kind, created_at desc)
  where kind = 'alert';

-- 작성자별 (마이페이지 내 기록)
create index if not exists cat_comments_author_idx
  on public.cat_comments (author_id, created_at desc);

-- ── 3. posts ──
-- 숨김 + 카테고리 (목록 조회)
create index if not exists posts_hidden_category_idx
  on public.posts (hidden, category, created_at desc);

-- 작성자별 (내 글)
create index if not exists posts_author_idx
  on public.posts (author_id, created_at desc);

-- ── 4. post_comments ──
-- 작성자별
create index if not exists post_comments_author_idx
  on public.post_comments (author_id, created_at desc);

-- ── 5. reports ──
-- 자동 숨김 트리거에서 사용 (target_type + target_id)
create index if not exists reports_target_idx
  on public.reports (target_type, target_id, status);

-- ── 6. rescue_hospitals ──
-- 태그 검색 (동물약국 필터)
create index if not exists rescue_hospitals_tags_idx
  on public.rescue_hospitals using gin (tags);

-- 좌표 있는 병원만 빠르게 (지도 마커용)
create index if not exists rescue_hospitals_latlng_idx
  on public.rescue_hospitals (lat, lng)
  where lat is not null and lng is not null;

-- ── 7. direct_messages ──
-- 대화 상대별 정렬 (이미 있지만 복합 조건 최적화)
create index if not exists dm_conversation_idx
  on public.direct_messages (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id),
    created_at desc
  );

-- ── 8. area_chats ──
-- 이미 (area, created_at desc) 인덱스 있음 → OK

-- ══════════════════════════════════════════
-- 불필요한 인덱스 정리 (현재 없음 — 향후 참고)
-- 인덱스가 너무 많으면:
-- - INSERT/UPDATE 성능 저하
-- - 스토리지 낭비
-- 현재 테이블당 2~3개라 적정 수준
-- ══════════════════════════════════════════

notify pgrst, 'reload schema';
-- 끝.
