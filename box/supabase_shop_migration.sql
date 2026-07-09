-- ══════════════════════════════════════════
-- 쇼핑몰 (products / cart_items / orders / order_items)
-- 실행: Supabase SQL Editor
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════

-- ──────────────
-- 1. products
-- ──────────────
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  price          integer not null check (price >= 0),
  sale_price     integer check (sale_price is null or sale_price >= 0),
  category       text not null default 'etc'
                   check (category in ('shelter', 'heater', 'goods', 'etc')),
  images         text[] not null default '{}',
  stock          integer not null default 0 check (stock >= 0),
  is_active      boolean not null default true,
  shipping_fee   integer not null default 0 check (shipping_fee >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_active_category_idx
  on public.products (is_active, category, created_at desc);

alter table public.products enable row level security;

drop policy if exists "products_read_all" on public.products;
create policy "products_read_all"
  on public.products for select
  using (true);

drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for all
  using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────
-- 2. cart_items
-- ──────────────
create table if not exists public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    integer not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists cart_items_user_idx
  on public.cart_items (user_id, created_at desc);

alter table public.cart_items enable row level security;

drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own"
  on public.cart_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_user_not_suspended(auth.uid()));

-- ──────────────
-- 3. orders
-- ──────────────
create table if not exists public.orders (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  order_number           text not null unique,
  status                 text not null default 'pending'
                           check (status in ('pending', 'paid', 'preparing', 'shipping', 'delivered', 'cancelled', 'refunded')),
  total_amount           integer not null check (total_amount >= 0),
  shipping_fee           integer not null default 0 check (shipping_fee >= 0),
  payment_amount         integer not null check (payment_amount >= 0),
  recipient_name         text not null,
  recipient_phone        text not null,
  recipient_address      text not null,
  recipient_address_detail text,
  postal_code            text not null,
  payment_key            text,
  payment_method         text,
  paid_at                timestamptz,
  tracking_number        text,
  memo                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists orders_user_idx
  on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx
  on public.orders (status, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "orders_read_own_or_admin" on public.orders;
create policy "orders_read_own_or_admin"
  on public.orders for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.admins where user_id = auth.uid())
  );

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id and public.is_user_not_suspended(auth.uid()));

drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  using (exists (select 1 from public.admins where user_id = auth.uid()))
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────
-- 4. order_items
-- ──────────────
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  product_name   text not null,
  product_price  integer not null check (product_price >= 0),
  quantity       integer not null check (quantity > 0),
  subtotal       integer not null check (subtotal >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists "order_items_read_own_or_admin" on public.order_items;
create policy "order_items_read_own_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or exists (select 1 from public.admins a where a.user_id = auth.uid()))
    )
  );

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
-- 끝.
