-- ══════════════════════════════════════════
-- 찜 서버 계측 (2026-08-12) — 화이트리스트 ① 커밋의 DB 부분
-- 목적: 결제 오픈 게이트(유니크 15명 · 찜 40개) 측정. 지금까지 찜은 localStorage뿐이라
--       서버에서 0건이었다(8/10 최종판정 실측). 이 테이블이 없으면 게이트 판정 자체가 불가.
-- 실행: Supabase SQL Editor에서 수동 실행.
-- ⚠ 코드(/api/shop/wishlist)는 이 테이블 없이 배포되면 조용히 500을 반환한다 —
--    배포 직후 반드시 실행할 것 (8/7·8/9 퍼널 스텝 SQL 지연으로 0건 된 전례 2회).
-- ══════════════════════════════════════════

create table if not exists public.shop_wishlist_events (
  id uuid primary key default gen_random_uuid(),
  anon_id text not null check (char_length(anon_id) between 8 and 64),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  action text not null check (action in ('add', 'remove')),
  source text check (source is null or char_length(source) <= 32),
  created_at timestamptz not null default now()
);

-- 현재 찜 상태 계산(anon_id·product_id별 마지막 이벤트)과 일별 집계가 주 쿼리
create index if not exists shop_wishlist_events_anon_product_idx
  on public.shop_wishlist_events (anon_id, product_id, created_at desc);
create index if not exists shop_wishlist_events_created_idx
  on public.shop_wishlist_events (created_at);

-- RLS: 켜고 정책 0개 = anon/authenticated 전면 차단.
-- 쓰기는 /api/shop/wishlist (service role + 검증 + IP 레이트리밋) 단일 경로,
-- 읽기는 service 프로브만. 클라이언트 직접 접근 경로 없음.
alter table public.shop_wishlist_events enable row level security;

-- ── 게이트 프로브 쿼리 (판정 시 사용) ──
-- select
--   count(*) filter (where action = 'add')                as active_wishes,
--   count(distinct anon_id) filter (where action = 'add') as unique_wishers
-- from (
--   select distinct on (anon_id, product_id) anon_id, product_id, action
--   from public.shop_wishlist_events
--   order by anon_id, product_id, created_at desc
-- ) latest;
-- 게이트: unique_wishers >= 15 and active_wishes >= 40 (+ 통판신고 수리)

-- ── 롤백 ──
-- drop table if exists public.shop_wishlist_events;
