-- ══════════════════════════════════════════
-- 회원 탈퇴 시 주문·결제·환불 기록 보존 (2026-08-04 보안감사)
--
-- 문제: orders.user_id 가 auth.users 를 ON DELETE CASCADE 로 참조한다.
--       /api/account/delete 의 auth.admin.deleteUser() 한 번이 해당 회원의
--       orders → order_items → order_refunds 를 통째로 영구 삭제한다.
--       전자상거래법상 보존의무(계약·청약철회 5년, 대금결제 5년, 소비자불만 3년)와
--       정면 충돌하고, 환불 분쟁 시 사업자 측 증빙이 사라진다.
--       (탈퇴 버튼 한 번으로 결제 증빙을 지울 수 있는 상태)
--
-- 조치: FK 를 ON DELETE SET NULL 로 바꿔 "계정만 끊고 거래기록은 남긴다".
--       user_deleted_at 으로 탈퇴 시점을 기록해 보존기간 만료 파기의 기준으로 쓴다.
--
-- 실행 시점: 결제 오픈(PAYMENT_ENABLED=true) 전에 실행할 것.
--            지금은 실주문이 사실상 없어 무손실이지만, 결제를 켠 뒤에는
--            이미 파괴된 기록을 되살릴 수 없다.
--
-- 선행: supabase_shop_migration.sql, supabase_shop_guest_order_migration.sql
--       (orders_owner_check 제약과 guest_token 컬럼이 이미 있어야 함)
-- 코드: app/api/account/delete/route.ts 가 탈퇴 시 user_deleted_at 을 기록한다.
--       (컬럼이 없으면 조용히 건너뛰므로 이 SQL 실행 전에도 탈퇴는 동작한다)
-- ══════════════════════════════════════════

begin;

-- 1) 탈퇴 표식 컬럼 — 보존기간 계산·파기 대상 식별용
alter table public.orders
  add column if not exists user_deleted_at timestamptz;

comment on column public.orders.user_deleted_at is
  '회원 탈퇴로 user_id 연결이 끊긴 시점. 법정 보존기간 만료 파기의 기준.';

-- 2) 소유자 체크 제약 완화
--    기존 의도(주인 없는 주문 생성 금지)는 유지하되, 탈퇴로 user_id 가 비는 경우를
--    예외로 인정한다. 이 완화 없이 FK 만 바꾸면 탈퇴 시 제약 위반으로 삭제가 실패한다.
alter table public.orders drop constraint if exists orders_owner_check;
alter table public.orders add constraint orders_owner_check
  check (user_id is not null or guest_token is not null or user_deleted_at is not null);

-- 3) FK: ON DELETE CASCADE → ON DELETE SET NULL
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

commit;

-- ── 검증 (실행 후 확인) ──
-- 1. FK 규칙이 SET NULL 인지
-- select conname, confdeltype  -- 'n' = SET NULL, 'c' = CASCADE
--   from pg_constraint
--  where conrelid = 'public.orders'::regclass and contype = 'f'
--    and conname = 'orders_user_id_fkey';
--
-- 2. 제약이 3항 형태로 바뀌었는지
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.orders'::regclass and conname = 'orders_owner_check';

-- ══════════════════════════════════════════
-- 롤백 SQL (되돌리려면 아래를 실행)
-- ⚠ 되돌리면 탈퇴 시 주문·결제·환불 기록이 다시 통째로 삭제된다.
-- ══════════════════════════════════════════
-- begin;
-- alter table public.orders drop constraint if exists orders_user_id_fkey;
-- alter table public.orders
--   add constraint orders_user_id_fkey
--   foreign key (user_id) references auth.users(id) on delete cascade;
--
-- alter table public.orders drop constraint if exists orders_owner_check;
-- alter table public.orders add constraint orders_owner_check
--   check (user_id is not null or guest_token is not null);
-- -- (user_deleted_at 이 채워진 행이 있으면 위 제약 복원이 실패한다.
-- --  그 경우 해당 행을 먼저 처리하거나 컬럼 삭제까지 함께 진행할 것)
--
-- alter table public.orders drop column if exists user_deleted_at;
-- commit;
