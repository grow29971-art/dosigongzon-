-- ══════════════════════════════════════════
-- 인덱스 최적화 v3 (2026-04-26)
-- 새로 추가된 핫쿼리 패턴 + 누락 발견 인덱스 보강.
-- 안전: 모두 IF NOT EXISTS, 데이터 변경 없음.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

-- ── 1. cats(health_status) — health-alert-push cron 가속 ──
-- "WHERE health_status IN ('caution','danger')" 매일 실행. 부분 인덱스로 효율↑
create index if not exists cats_health_urgent_idx
  on public.cats (health_status, region)
  where health_status in ('caution', 'danger');

-- ── 2. user_activity_regions(name) — 캣맘 매칭 + health-alert 가속 ──
-- "WHERE name IN ('서울 강남구 역삼동', ...)" / "WHERE name = ?"
create index if not exists user_activity_regions_name_idx
  on public.user_activity_regions (name);

-- ── 3. direct_messages 읽지않은 카운트 — 종 배지에서 자주 호출 ──
-- "WHERE receiver_id = ? AND is_read = false" 부분 인덱스
create index if not exists dm_unread_idx
  on public.direct_messages (receiver_id)
  where is_read = false;

-- ── 4. inquiries 알림 카운트 — pending 아닌 것만 ──
-- "WHERE user_id = ? AND status != 'pending' AND updated_at >= ?"
create index if not exists inquiries_user_status_updated_idx
  on public.inquiries (user_id, updated_at desc)
  where status != 'pending';

-- ── 5. invite_events 알림 카운트 ──
create index if not exists invite_events_inviter_created_idx
  on public.invite_events (inviter_id, created_at desc);

-- ── 6. cat_location_history 좋아요 알림 ──
create index if not exists cat_location_history_cat_created_idx
  on public.cat_location_history (cat_id, created_at desc);

-- 통계 갱신 권고 (자동이지만 명시)
analyze public.cats;
analyze public.user_activity_regions;
analyze public.direct_messages;
analyze public.inquiries;
