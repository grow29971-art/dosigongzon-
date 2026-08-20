-- ══════════════════════════════════════════
-- 쇼핑몰 구매후기 (product_reviews) — 2026-08-20
-- 목적: 상품별 구매후기(별점+내용+사진). "구매자만 작성"을 RLS가 DB 레벨에서 강제.
-- 구매 판정: 내 주문(orders.status가 paid 이후 단계) 중 해당 상품이 포함된 order_items 존재.
--   pending(미결제)·cancelled·refunded 주문으로는 작성 불가. 게스트 주문은 계정이 없어 후기 불가(표준).
-- 사진: 기존 cat-photos 버킷 재사용(클라이언트 webp 변환 → EXIF 제거됨). 별도 스토리지 정책 불필요.
-- 비정규화(author_name/avatar 스냅샷)는 posts 패턴과 동일 — 의도적.
-- 실행: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_shop_migration.sql (orders/order_items), is_user_not_suspended 함수
-- ══════════════════════════════════════════

-- ── 1. 테이블 ──
create table if not exists public.product_reviews (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  rating             integer not null check (rating between 1 and 5),
  content            text not null check (char_length(content) between 1 and 2000),
  images             text[] not null default '{}' check (array_length(images, 1) is null or array_length(images, 1) <= 3),
  author_name        text,
  author_avatar_url  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (product_id, user_id)  -- 상품당 1인 1후기
);

create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);

-- updated_at 자동 갱신 (touch_updated_at은 shop_v2 마이그레이션에서 생성됨)
drop trigger if exists product_reviews_touch_updated_at on public.product_reviews;
create trigger product_reviews_touch_updated_at
  before update on public.product_reviews
  for each row execute function public.touch_updated_at();

-- ── 2. RLS ──
alter table public.product_reviews enable row level security;

-- 읽기: 전체 공개 (비로그인 포함 — 후기는 구매 판단 자료)
drop policy if exists "product_reviews_read_all" on public.product_reviews;
create policy "product_reviews_read_all"
  on public.product_reviews for select
  using (true);

-- 작성: 본인 + 정지 아님 + 실구매(결제 완료 이후 상태) 이력 필수
drop policy if exists "product_reviews_insert_purchaser" on public.product_reviews;
create policy "product_reviews_insert_purchaser"
  on public.product_reviews for insert
  with check (
    auth.uid() = user_id
    and public.is_user_not_suspended(auth.uid())
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.user_id = auth.uid()
        and oi.product_id = product_reviews.product_id
        and o.status in ('paid', 'preparing', 'shipping', 'delivered')
    )
  );

-- 수정: 본인만. with check에도 구매 조건 유지 — product_id 바꿔치기로 게이트 우회 차단
drop policy if exists "product_reviews_update_own" on public.product_reviews;
create policy "product_reviews_update_own"
  on public.product_reviews for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.user_id = auth.uid()
        and oi.product_id = product_reviews.product_id
        and o.status in ('paid', 'preparing', 'shipping', 'delivered')
    )
  );

-- 삭제: 본인 또는 관리자
drop policy if exists "product_reviews_delete_own_or_admin" on public.product_reviews;
create policy "product_reviews_delete_own_or_admin"
  on public.product_reviews for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 롤백 (되돌릴 때만 실행)
-- drop table if exists public.product_reviews cascade;
-- ══════════════════════════════════════════
-- 끝.
