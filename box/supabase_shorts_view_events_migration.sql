s-- ══════════════════════════════════════════
-- 도시공존 — 숏츠 시청자(고유 디바이스) 추적
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
-- 선행조건: supabase_shorts_migration.sql
-- 목적: 어드민 통계 — 총 몇 명이 / 총 몇 편 시청했는지
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. 시청 이벤트 테이블 (디바이스별 한 영상당 1행)
--    PRIMARY KEY (short_id, viewer_id) → 자동 dedup
-- ──────────────────────────────────────────
create table if not exists public.shorts_view_events (
  short_id  uuid not null references public.shorts(id) on delete cascade,
  viewer_id text not null,
  viewed_at timestamptz default now() not null,
  primary key (short_id, viewer_id)
);

create index if not exists shorts_view_events_viewer_id_idx
  on public.shorts_view_events (viewer_id);

create index if not exists shorts_view_events_viewed_at_idx
  on public.shorts_view_events (viewed_at desc);

-- ──────────────────────────────────────────
-- 2. RLS — anon insert만 허용, admin이 select
-- ──────────────────────────────────────────
alter table public.shorts_view_events enable row level security;

drop policy if exists "shorts_view_events_insert_any" on public.shorts_view_events;
create policy "shorts_view_events_insert_any"
  on public.shorts_view_events
  for insert
  with check (true);

drop policy if exists "shorts_view_events_read_admin" on public.shorts_view_events;
create policy "shorts_view_events_read_admin"
  on public.shorts_view_events
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. 통합 RPC — view_count 증가 + viewer_id 기록 (한 호출로 둘 다)
-- ──────────────────────────────────────────
create or replace function public.increment_short_view_v2(p_id uuid, p_viewer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) 기존 view_count 증가 (발행된 영상만)
  update public.shorts
    set view_count = view_count + 1
    where id = p_id and published = true;

  -- 2) 시청자 ID가 있으면 events 테이블에도 기록 (중복 무시)
  if p_viewer_id is not null and length(p_viewer_id) > 0 then
    insert into public.shorts_view_events (short_id, viewer_id)
      values (p_id, p_viewer_id)
      on conflict (short_id, viewer_id) do nothing;
  end if;
end;
$$;

revoke all on function public.increment_short_view_v2(uuid, text) from public;
grant execute on function public.increment_short_view_v2(uuid, text) to anon, authenticated;

-- ──────────────────────────────────────────
-- 4. 통계 RPC — 어드민 페이지에서 한 번에 모든 지표 조회
-- ──────────────────────────────────────────
create or replace function public.shorts_admin_stats()
returns table (
  total_viewers     bigint,    -- 고유 시청자 수
  total_view_pairs  bigint,    -- (시청자, 영상) 쌍 = 누적 시청 편수
  total_view_count  bigint     -- view_count 합계 (회원·디바이스별 24h dedup된 누적)
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(distinct viewer_id) from public.shorts_view_events)::bigint,
    (select count(*) from public.shorts_view_events)::bigint,
    (select coalesce(sum(view_count), 0) from public.shorts)::bigint;
$$;

revoke all on function public.shorts_admin_stats() from public;
grant execute on function public.shorts_admin_stats() to authenticated;

-- ──────────────────────────────────────────
-- 5. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
