-- ══════════════════════════════════════════
-- 쪽지 읽은 시각 + 7일 후 자동 삭제 (2026-04-24)
-- direct_messages 테이블에 read_at 컬럼 추가.
-- 정리는 Vercel Cron(/api/cron/cleanup-read-dms)이 매일 실행.
-- 실행: Supabase SQL Editor
-- ══════════════════════════════════════════

alter table public.direct_messages
  add column if not exists read_at timestamptz;

-- 기존 is_read=true 행은 created_at으로 backfill (근사값)
-- 실제 읽은 시점은 모르지만 created_at 기준으로 7일 보관 룰을 일관 적용
update public.direct_messages
  set read_at = created_at
  where is_read = true and read_at is null;

-- 정리 쿼리 인덱스 — read_at IS NOT NULL인 오래된 행을 빠르게 찾기
create index if not exists dm_read_at_cleanup_idx
  on public.direct_messages (read_at)
  where read_at is not null;

comment on column public.direct_messages.read_at is
  '수신자가 메시지를 읽은 시각. 이 시점부터 7일 후 cron으로 자동 삭제.';

notify pgrst, 'reload schema';
-- 끝.
