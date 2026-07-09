-- ══════════════════════════════════════════
-- 쇼핑몰 v2: 카테고리 7종 개편 + 상품 컬럼 확장
-- (badge/후원/무게/도매처/가상상품 + updated_at 트리거)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- 참고: 관리자 판별은 기존 admins 테이블 정책 그대로 유지 (변경 없음)
-- ══════════════════════════════════════════

-- ── 1. 기존 카테고리 데이터 매핑 (heater→shelter, etc→goods) ──
update public.products set category = 'shelter' where category = 'heater';
update public.products set category = 'goods'   where category = 'etc';

-- ── 2. 카테고리 체크 제약 교체 (7종) ──
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('food', 'sand', 'health', 'toy', 'shelter', 'goods', 'support'));

-- ── 3. 새 컬럼 ──
alter table public.products add column if not exists badge text
  check (badge is null or badge in ('신상', '인기', '한정'));
alter table public.products add column if not exists is_donation boolean not null default true;
alter table public.products add column if not exists donation_percent integer not null default 20
  check (donation_percent >= 0 and donation_percent <= 100);
alter table public.products add column if not exists weight text;
alter table public.products add column if not exists supplier text; -- 도매처 메모 (프론트 미노출)
alter table public.products add column if not exists is_virtual boolean not null default false;

-- ── 4. 기본값 변경 ──
alter table public.products alter column stock set default 99;
alter table public.products alter column shipping_fee set default 3000;

-- ── 5. updated_at 자동 갱신 트리거 ──
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
-- 끝.
