-- ══════════════════════════════════════════
-- 쇼핑몰 환불 시스템 — 스키마 (2026-07-31)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 자동번역 OFF
-- 선행: supabase_shop_migration.sql (orders/order_items/products)
--       supabase_weekly_points_migration.sql (point_ledger/grant_points)
-- ══════════════════════════════════════════
--
-- 【설계 근거】
--
-- 1) 왜 orders.status에 환불 상태를 넣지 않는가
--    현재 status CHECK = (pending, paid, preparing, shipping, delivered, cancelled, refunded)
--    — 즉 **결제 단계와 배송 단계가 한 컬럼에 섞여 있다**(supabase_shop_migration.sql:72-73).
--    여기에 refund_requested를 넣으면 "배송완료 상태에서 환불요청" 같은 조합을 표현할 수 없고,
--    승인/거부 시 배송 단계로 되돌릴 근거가 사라진다.
--    → 환불 생애주기는 **별도 컬럼 refund_status**로 분리한다. 두 축이 독립적으로 움직인다.
--    (전액 환불이 완료될 때만 status도 'refunded'로 바꾼다. 이 값은 이미 CHECK에 있고
--     payment-reconcile의 CANCELLED_LIKE에도 포함돼 있어 대사 로직과 정합한다.)
--
-- 2) 왜 별도 원장 테이블(order_refunds)이 필요한가
--    부분환불은 한 주문에 **여러 번** 일어날 수 있다. orders에 컬럼 몇 개로는
--    "언제 누가 얼마를 무슨 사유로 환불했는지"를 잃는다. 전자상거래법상 환불 이력은
--    분쟁 대응 근거라 감사 추적이 필수다.
--
-- 3) 멱등성을 왜 DB에서 잡는가
--    토스 취소 API는 Idempotency-Key 헤더를 지원한다(최대 300자, 15일 유효, 같은 키
--    재요청 시 첫 응답을 그대로 반환). 그 키를 DB의 unique 제약과 **같은 값**으로 묶으면
--    "우리 DB에 행이 있다 = 토스에도 이미 갔다"가 보장돼 이중 환불이 원천 차단된다.
--
-- 3-b) 상태 가드 트리거와의 정합
--    supabase_orders_status_guard_migration.sql:32-45의 BEFORE UPDATE 트리거가
--    **service_role 포함 모든 경로**에 상태 전이를 강제한다. 이 설계는 그 표를 건드리지 않는다:
--      · refund_status만 바꾸는 UPDATE는 old.status = new.status라 트리거 28-30행에서 통과.
--      · 전액 환불 완료 시의 status 전이(paid/preparing/shipping/delivered → refunded)는
--        트리거 34-37행이 이미 허용하는 전이라 그대로 통과.
--    즉 트리거 수정이 전혀 필요 없다. (status에 refund_requested를 새로 넣었다면
--     CHECK·트리거·앱을 한꺼번에 고쳐야 했고, cancelled/refunded가 종착역이라
--     "요청 → 반려 → 원상복귀"가 아예 불가능했다.)
--
-- 3-c) 배송 시각 컬럼이 없어 청약철회 기한을 계산할 수 없다
--    전자상거래법상 단순변심 철회 기간은 "재화를 공급받은 날부터 7일"인데,
--    orders에는 tracking_number(text) 하나뿐이고 발송·수령 시각이 없다.
--    /shop/policy 페이지는 이미 "받은 날부터 7일"을 고지하고 있으므로(policy/page.tsx:83)
--    시스템이 그 기한을 판정하려면 시각 컬럼이 선행돼야 한다. 여기서 함께 추가한다.
--
-- 4) 후원 집계 무결성
--    후원 상품(is_donation)은 order_items.donation_amount가 공개 후원 집계의 원천이다.
--    환불하면 이 집계에서 반드시 빠져야 한다(투명 정산). 스냅샷을 덮어쓰면 "원래 얼마였는지"를
--    잃으므로, 차감분을 donation_refunded에 **따로 누적**하고 집계는 (donation_amount −
--    donation_refunded)로 읽는다. 원본 보존 + 차감 반영을 동시에 만족한다.
-- ══════════════════════════════════════════

begin;

-- ──────────────────────────────────────────
-- 1. orders — 환불 상태 축 (배송 상태와 독립)
-- ──────────────────────────────────────────
alter table public.orders
  add column if not exists refund_status text not null default 'none';

alter table public.orders
  add column if not exists refund_amount integer not null default 0;

alter table public.orders
  add column if not exists refund_requested_at timestamptz;

alter table public.orders
  add column if not exists refunded_at timestamptz;

alter table public.orders
  add column if not exists refund_reason text;

-- 청약철회 기한 기산점 — "공급받은 날부터 7일"을 판정하려면 필수.
-- 관리자가 status를 shipping/delivered로 바꿀 때 함께 기록한다.
alter table public.orders
  add column if not exists shipped_at timestamptz;

alter table public.orders
  add column if not exists delivered_at timestamptz;

-- CHECK는 재실행 안전하게 drop 후 재생성
alter table public.orders drop constraint if exists orders_refund_status_check;
alter table public.orders
  add constraint orders_refund_status_check
  check (refund_status in (
    'none',              -- 환불 요청 없음(기본)
    'requested',         -- 유저가 환불 요청, 관리자 판단 대기
    'rejected',          -- 관리자 거부(사유는 order_refunds에 기록)
    'partial_refunded',  -- 일부 품목/일부 금액만 환불됨
    'refunded'           -- 전액 환불 완료
  ));

-- 환불액은 음수일 수 없고 결제액을 넘을 수 없다 (과잉 환불 방어의 마지막 선)
alter table public.orders drop constraint if exists orders_refund_amount_check;
alter table public.orders
  add constraint orders_refund_amount_check
  check (refund_amount >= 0 and refund_amount <= payment_amount);

create index if not exists orders_refund_status_idx
  on public.orders (refund_status, refund_requested_at desc)
  where refund_status <> 'none';

-- ──────────────────────────────────────────
-- 2. order_items — 품목별 환불 수량·후원 차감
--    부분환불에서 "이 품목을 몇 개 환불했나"를 알아야 재고 복원과
--    후원 차감을 정확히 계산할 수 있다.
-- ──────────────────────────────────────────
alter table public.order_items
  add column if not exists refunded_quantity integer not null default 0;

alter table public.order_items
  add column if not exists donation_refunded integer not null default 0;

-- 환불 수량이 주문 수량을 넘을 수 없다 = 재고 이중 복원의 DB 레벨 차단
alter table public.order_items drop constraint if exists order_items_refunded_qty_check;
alter table public.order_items
  add constraint order_items_refunded_qty_check
  check (refunded_quantity >= 0 and refunded_quantity <= quantity);

-- 후원 차감이 원래 후원액을 넘을 수 없다 = 공개 집계 음수화 차단
alter table public.order_items drop constraint if exists order_items_donation_refunded_check;
alter table public.order_items
  add constraint order_items_donation_refunded_check
  check (donation_refunded >= 0 and donation_refunded <= coalesce(donation_amount, 0));

-- ──────────────────────────────────────────
-- 3. order_refunds — 환불 원장 (감사 추적 + 멱등 키)
-- ──────────────────────────────────────────
create table if not exists public.order_refunds (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,

  -- 누가 요청했나 (유저 셀프 요청 또는 관리자 직권)
  requested_by        uuid references auth.users(id) on delete set null,
  requested_by_role   text not null default 'user'
                        check (requested_by_role in ('user', 'admin', 'system')),

  -- 생애주기
  status              text not null default 'requested'
                        check (status in (
                          'requested',  -- 접수, 심사 대기
                          'approved',   -- 승인됨(토스 호출 직전)
                          'completed',  -- 토스 취소 성공 + 후처리 완료
                          'rejected',   -- 관리자 거부
                          'failed'      -- 토스 호출 실패(재시도 대상)
                        )),

  kind                text not null default 'full'
                        check (kind in ('full', 'partial')),

  -- 금액 (요청 시점 계산액. 실제 토스 취소액은 toss_cancel_amount)
  amount              integer not null check (amount > 0),
  toss_cancel_amount  integer,
  points_restored     integer not null default 0 check (points_restored >= 0),

  -- 사유 — 코드로 정책 분기, 자유서술은 별도
  reason_code         text not null
                        check (reason_code in (
                          'change_of_mind',   -- 단순변심(청약철회)
                          'defect',           -- 상품 하자
                          'wrong_delivery',   -- 오배송
                          'delayed',          -- 배송 지연
                          'out_of_stock',     -- 품절(판매자 귀책)
                          'admin_discretion', -- 관리자 직권
                          'other'
                        )),
  reason_note         text,
  reject_reason       text,

  -- 배송비 부담 주체 (단순변심이면 구매자, 하자·오배송이면 판매자)
  shipping_fee_bearer text check (shipping_fee_bearer in ('buyer', 'seller', 'none')),
  return_shipping_fee integer not null default 0 check (return_shipping_fee >= 0),

  -- 멱등성 — 토스 Idempotency-Key와 동일 값을 쓴다.
  -- unique라 같은 환불 시도가 두 번 INSERT될 수 없고,
  -- 토스도 같은 키면 첫 응답을 돌려주므로 이중 청구가 불가능하다.
  idempotency_key     text not null unique,

  -- 토스 응답 흔적 (대사·분쟁 대응용)
  toss_transaction_key text,
  toss_balance_after   integer,

  processed_by        uuid references auth.users(id) on delete set null,
  admin_note          text,
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);

create index if not exists order_refunds_order_idx
  on public.order_refunds (order_id, created_at desc);
create index if not exists order_refunds_status_idx
  on public.order_refunds (status, created_at desc);
create index if not exists order_refunds_requester_idx
  on public.order_refunds (requested_by, created_at desc);

-- 한 주문에 "심사 대기 중인 요청"은 하나만 — 유저가 중복 요청 폭탄을 못 넣게.
create unique index if not exists order_refunds_one_open_per_order
  on public.order_refunds (order_id)
  where status in ('requested', 'approved');

-- ──────────────────────────────────────────
-- 4. order_refund_items — 부분환불 대상 품목
-- ──────────────────────────────────────────
create table if not exists public.order_refund_items (
  id             uuid primary key default gen_random_uuid(),
  refund_id      uuid not null references public.order_refunds(id) on delete cascade,
  order_item_id  uuid not null references public.order_items(id) on delete cascade,
  quantity       integer not null check (quantity > 0),
  amount         integer not null check (amount >= 0),
  donation_delta integer not null default 0 check (donation_delta >= 0),
  created_at     timestamptz not null default now(),
  unique (refund_id, order_item_id)
);

create index if not exists order_refund_items_refund_idx
  on public.order_refund_items (refund_id);

-- ──────────────────────────────────────────
-- 5. RLS — 읽기는 본인·admin, 쓰기는 서버(service_role) 전용
--    환불은 돈이 움직이므로 클라이언트 직접 쓰기를 일절 허용하지 않는다.
--    유저 요청도 서버 API(/api/payment/refund)를 반드시 경유한다.
-- ──────────────────────────────────────────
alter table public.order_refunds      enable row level security;
alter table public.order_refund_items enable row level security;

drop policy if exists "order_refunds_select_own_or_admin" on public.order_refunds;
create policy "order_refunds_select_own_or_admin"
  on public.order_refunds for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_refunds.order_id and o.user_id = auth.uid()
    )
    or exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE 정책 없음 = 클라이언트 쓰기 전면 거부.
-- service_role은 RLS를 우회하므로 서버 API는 정상 동작한다.

drop policy if exists "order_refund_items_select_own_or_admin" on public.order_refund_items;
create policy "order_refund_items_select_own_or_admin"
  on public.order_refund_items for select
  using (
    exists (
      select 1 from public.order_refunds r
      join public.orders o on o.id = r.order_id
      where r.id = order_refund_items.refund_id
        and (o.user_id = auth.uid()
             or exists (select 1 from public.admins a where a.user_id = auth.uid()))
    )
  );

-- 컬럼 권한: 클라이언트는 읽기만
revoke all on public.order_refunds      from anon, authenticated;
revoke all on public.order_refund_items from anon, authenticated;
grant select on public.order_refunds      to authenticated;
grant select on public.order_refund_items to authenticated;

-- ──────────────────────────────────────────
-- 6. 후원 집계 — 환불분을 뺀 순(net) 후원액
--    현재 집계는 뷰·RPC가 아니라 앱에서 매번 합산한다
--    (/api/shop/donation-progress:19-30, /api/shop/fund-settlement:16-21 —
--     order_items.donation_amount를 orders.status in (paid,preparing,shipping,delivered)로 조인).
--    그래서 **전액 환불은 status='refunded'가 되며 자동으로 빠지지만, 부분환불은 표현조차 안 된다.**
--    아래 뷰는 그 status 필터를 그대로 유지하면서 부분환불분(donation_refunded)만 추가로 뺀다.
--    → 두 라우트를 이 뷰로 갈아끼우면 전액·부분 환불이 모두 공개 집계에 정확히 반영된다.
--    security_invoker=off(definer) — 공개 통계라 익명도 읽어야 하고,
--    orders/order_items RLS와 무관하게 집계만 노출한다.
-- ──────────────────────────────────────────
drop view if exists public.donation_totals;
create view public.donation_totals
with (security_invoker = false) as
select
  coalesce(sum(oi.donation_amount), 0)::bigint      as donation_gross,
  coalesce(sum(oi.donation_refunded), 0)::bigint    as donation_refunded,
  coalesce(sum(oi.donation_amount - oi.donation_refunded), 0)::bigint as donation_net
from public.order_items oi
join public.orders o on o.id = oi.order_id
-- 기존 앱 집계와 동일한 status 필터 (refunded/cancelled는 통째로 제외 = 전액환불 자동 반영)
where o.status in ('paid', 'preparing', 'shipping', 'delivered')
  and coalesce(oi.donation_amount, 0) > 0;

grant select on public.donation_totals to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- 검증 (실행 후)
-- ══════════════════════════════════════════
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='orders'
--    and column_name like 'refund%';
--
-- select * from public.donation_totals;
--
-- anon 키로 GET /rest/v1/order_refunds → 200 + 0행 (RLS로 남의 환불 안 보임)
-- anon 키로 POST /rest/v1/order_refunds → 42501 (쓰기 정책 없음 = 거부)

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기)
-- ══════════════════════════════════════════
-- begin;
-- drop view if exists public.donation_totals;
-- drop table if exists public.order_refund_items;
-- drop table if exists public.order_refunds;
-- alter table public.order_items drop constraint if exists order_items_donation_refunded_check;
-- alter table public.order_items drop constraint if exists order_items_refunded_qty_check;
-- alter table public.order_items drop column if exists donation_refunded;
-- alter table public.order_items drop column if exists refunded_quantity;
-- drop index if exists public.orders_refund_status_idx;
-- alter table public.orders drop constraint if exists orders_refund_amount_check;
-- alter table public.orders drop constraint if exists orders_refund_status_check;
-- alter table public.orders drop column if exists delivered_at;
-- alter table public.orders drop column if exists shipped_at;
-- alter table public.orders drop column if exists refund_reason;
-- alter table public.orders drop column if exists refunded_at;
-- alter table public.orders drop column if exists refund_requested_at;
-- alter table public.orders drop column if exists refund_amount;
-- alter table public.orders drop column if exists refund_status;
-- commit;
-- notify pgrst, 'reload schema';
