-- ══════════════════════════════════════════
-- 도시공존 — 고양이 사진 스타일 변환 사용 기록
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ Chrome 자동번역 OFF
-- 목적: Replicate API 호출 quota 검사 + 비용 추적
-- ══════════════════════════════════════════

create table if not exists public.cat_style_transforms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  style       text not null check (style in ('anime','watercolor','embroidery','sticker')),
  source_url  text not null,
  output_url  text,
  prediction_id text,
  created_at  timestamptz not null default now()
);

create index if not exists cat_style_transforms_user_day_idx
  on public.cat_style_transforms (user_id, created_at desc);

-- RLS: 본인 기록만 조회. service_role(API)이 insert.
alter table public.cat_style_transforms enable row level security;

drop policy if exists "cat_style_transforms_read_own" on public.cat_style_transforms;
create policy "cat_style_transforms_read_own"
  on public.cat_style_transforms
  for select
  using (auth.uid() = user_id);

-- INSERT는 service_role만 (API 경로). authenticated 직접 insert 차단.
drop policy if exists "cat_style_transforms_insert_deny" on public.cat_style_transforms;
create policy "cat_style_transforms_insert_deny"
  on public.cat_style_transforms
  for insert
  to anon, authenticated
  with check (false);

revoke insert on public.cat_style_transforms from anon, authenticated;

notify pgrst, 'reload schema';

-- 끝.
-- 검증:
--   select count(*) from public.cat_style_transforms;
--   select style, count(*) from public.cat_style_transforms group by style;
