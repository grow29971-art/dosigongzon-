-- ══════════════════════════════════════════════════════════════
-- 다마고치·코인 경제 DB 정리 (2026-08-29 사장님 지시 — 게임 요소 폐지)
-- 코드(다마고치 위젯·/api/care·/api/coins·/api/checkin·코인상점)는 이미 제거됨.
-- 이 SQL은 고아가 된 컬럼·테이블·RPC 청소. 앱은 이 SQL 전에도 정상 동작한다(순수 정리).
-- 실행: Supabase SQL Editor.
--
-- ⚠ 유지(절대 드롭 금지):
--   - cats.card_level, cats.card_exp  = 돌봄 레벨 (add_cat_card_exp가 계속 씀)
--   - user_points, point_ledger, grant_points = 쇼핑몰 할인 포인트 (주간 돌봄→적립)
--
-- ⚠ 뷰 의존성: cats_public_map은 cats 전 컬럼을 동적 복사하는 좌표 퍼징 뷰라
--   cats의 다마고치 컬럼(fed_at 등)을 물고 있다. 카드 제거(8/27) 때와 동일하게
--   CASCADE 금지 — drop→컬럼정리→동적 재생성→grant+쓰기 revoke 순서로 처리한다.
-- ══════════════════════════════════════════════════════════════

-- ── 0. cats_public_map 뷰 선(先) 드랍 (2BP01 예방) ──
-- 아래 cats 컬럼 정리 후 섹션 2에서 정리된 컬럼 목록으로 재생성한다.
drop view if exists public.cats_public_map;

-- ── 1. cats 다마고치 게이지 컬럼 드랍 (코드가 더 이상 읽지 않음) ──
alter table public.cats drop column if exists fed_at;
alter table public.cats drop column if exists mood_at;
alter table public.cats drop column if exists fed_day;
alter table public.cats drop column if exists fed_today;
alter table public.cats drop column if exists pet_day;
alter table public.cats drop column if exists cleaned_at;
-- card_level / card_exp 는 돌봄 레벨이라 유지 — 여기서 드롭하지 말 것.

-- ── 2. cats_public_map 재생성 — 정리된 컬럼 목록으로 (0에서 드랍한 뷰) ──
-- 카드 제거 SQL과 동일한 동적 생성 블록: lat/lng 좌표 퍼징, memorial_by 제외, 공개 조건 동일.
-- 재생성 후 grant·쓰기 revoke 반드시 재적용.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cats'
     and column_name not in ('lat', 'lng', 'memorial_by');

  execute format($f$
    create view public.cats_public_map as
    select
      %s,
      lat + (((hashtext(id::text || '_lat') & 1023) - 512) * 0.0000081) as lat,
      lng + (((hashtext(id::text || '_lng') & 1023) - 512) * 0.0000101) as lng
    from public.cats
    where hidden = false and visibility = 'public' and memorial_at is null
  $f$, cols);
end $$;

grant select on public.cats_public_map to anon, authenticated;
-- 공개 뷰 쓰기 차단 — drop 후 새로 만든 뷰라 기존 revoke가 날아감, 반드시 다시 건다
revoke insert, update, delete on public.cats_public_map from anon, authenticated;

-- ── 3. profiles 코인·출석 컬럼 드랍 ──
-- profiles_public 뷰는 explicit 컬럼 목록(닉네임·아바타·admin_title·suspended·
-- created_at·perfect_catch_count)이라 coins/last_checkin_date를 투영하지 않는다 → 직접 드롭 안전.
-- 만약 2BP01(다른 뷰가 물고 있음)이 나면: 그 뷰를 drop→컬럼정리→재정의 순서로 처리할 것.
alter table public.profiles drop column if exists coins;
alter table public.profiles drop column if exists last_checkin_date;

-- ── 4. 고아 테이블 드랍 ──
drop table if exists public.user_items;    -- 코인상점 아이템 보유 (buy/use-item/consume 모두 제거됨)
drop table if exists public.checkin_days;   -- 일일 출석 스탬프 (주간 포인트는 care_logs로 재배선됨)

-- ── 5. 고아 RPC 드랍 ──
drop function if exists public.increment_coins(uuid, int);
drop function if exists public.award_care_bonus_atomic(uuid, int, int);
drop function if exists public.consume_user_item(uuid, text);
drop function if exists public.buy_shop_item_atomic(uuid, text, int);

-- ══════════════════════════════════════════════════════════════
-- 검증 프로브 (실행 후 확인용)
--   select column_name from information_schema.columns
--    where table_name='cats' and column_name in ('fed_at','card_level');
--     → fed_at 없음, card_level 있음 이어야 정상
--   select to_regclass('public.user_items'), to_regclass('public.checkin_days');
--     → 둘 다 null 이어야 정상
--   select to_regclass('public.cats_public_map');  → not null (재생성됨)
--   select to_regclass('public.user_points');      → not null (유지)
--
-- ── 롤백 (구조만 — 데이터는 복원 불가) ──
-- 컬럼/테이블/RPC 재생성은 git 이력의 원본 마이그레이션 참고:
--   supabase_care_migration.sql (fed_at 등), supabase_shop_*.sql (user_items/RPC),
--   supabase_weekly_points_migration.sql (checkin_days). cats_public_map은 위 블록 재실행.
-- ══════════════════════════════════════════════════════════════
