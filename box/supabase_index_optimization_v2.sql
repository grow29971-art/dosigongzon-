-- ══════════════════════════════════════════
-- DB 인덱스 최적화 v2 (2026-04-23)
-- 1차 인덱스 추가 후 실제 쿼리 패턴 재분석으로 누락된 것 보강.
-- 실행: Supabase SQL Editor
-- 모두 `if not exists`라 여러 번 실행해도 안전.
-- ══════════════════════════════════════════

-- ── cat_comments ──
-- 고양이 상세 페이지 댓글 목록 — cats/[id]에서 매번 호출 (가장 조회 많은 패턴)
-- .eq("cat_id", xxx).order("created_at desc")
create index if not exists cat_comments_cat_created_idx
  on public.cat_comments (cat_id, created_at desc);

-- ── care_logs ──
-- 고양이 돌봄 일지 목록 — cats/[id] + mypage
-- .eq("cat_id", xxx).order("logged_at desc")
create index if not exists care_logs_cat_logged_idx
  on public.care_logs (cat_id, logged_at desc);

-- 작성자별 돌봄 일지 (마이페이지 내 기록 + 리더보드)
-- .eq("author_id", xxx).order("logged_at desc")
create index if not exists care_logs_author_logged_idx
  on public.care_logs (author_id, logged_at desc);

-- ── user_follows ──
-- 내가 팔로우한 유저 목록 — notifications·home 피드에서 조회
-- .eq("follower_id", user.id)
create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id);

-- 나를 팔로우한 유저 목록 — 공개 프로필 페이지
-- .eq("following_id", user.id)
create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

-- ── cat_likes ──
-- 고양이별 좋아요 카운트 (비정규화된 like_count 외 실시간 검증용)
-- .eq("cat_id", xxx)
create index if not exists cat_likes_cat_idx
  on public.cat_likes (cat_id);

-- 유저가 좋아요한 고양이 목록 — mypage
-- .eq("user_id", xxx)
create index if not exists cat_likes_user_idx
  on public.cat_likes (user_id);

-- ── user_activity_regions ──
-- 유저별 활동 지역 조회 — 공개 프로필 + 홈 필터
-- .eq("user_id", xxx)
create index if not exists user_activity_regions_user_idx
  on public.user_activity_regions (user_id);

-- ── auth_error_logs ──
-- admin 페이지에서 최근 에러 조회 (30개 제한 내림차순)
-- .order("created_at desc")
create index if not exists auth_error_logs_created_idx
  on public.auth_error_logs (created_at desc);

-- ── user_suspensions ──
-- is_user_not_suspended() 함수에서 활성 정지 조회
-- where user_id = xxx and (suspended_until is null or suspended_until > now())
create index if not exists user_suspensions_user_active_idx
  on public.user_suspensions (user_id, suspended_until);

-- 주: profiles.level / profiles.suspended 컬럼은 존재하지 않음
-- (레벨은 care_logs 등으로 런타임 계산, 정지는 user_suspensions 뷰로 판별)

-- ══════════════════════════════════════════
-- 실행 후 확인:
--   select schemaname, tablename, indexname from pg_indexes
--   where schemaname = 'public' order by tablename, indexname;
-- ══════════════════════════════════════════

notify pgrst, 'reload schema';
-- 끝.
