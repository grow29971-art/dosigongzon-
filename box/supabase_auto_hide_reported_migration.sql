-- ══════════════════════════════════════════
-- 신고 누적 시 자동 숨김 (3건 이상)
-- 대상: cats, cat_comments, post_comments
-- 실행 위치: Supabase Dashboard → SQL Editor
-- 선행: supabase_support_migration.sql (reports 테이블 필요)
-- ⚠ Chrome 번역 OFF
-- ══════════════════════════════════════════
--
-- 정책:
--  - reports가 3건 이상(반려 제외) 쌓이면 대상 자동 hidden=true
--  - 일반 유저에게는 숨김 대상이 조회되지 않음 (*_read_public 정책)
--  - 관리자는 여전히 조회 가능 (*_read_admin 정책 추가)
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. hidden 컬럼 추가 (기존 행은 false)
-- ──────────────────────────────────────────
alter table public.cats
  add column if not exists hidden boolean not null default false;

alter table public.cat_comments
  add column if not exists hidden boolean not null default false;

alter table public.post_comments
  add column if not exists hidden boolean not null default false;

-- ──────────────────────────────────────────
-- 2. 트리거 함수: reports insert 시 대상 카운트 후 숨김 처리
-- ──────────────────────────────────────────
create or replace function public.auto_hide_reported_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  report_count int;
  hide_threshold constant int := 3;
begin
  select count(*) into report_count
  from public.reports
  where target_type = new.target_type
    and target_id = new.target_id
    and status <> 'dismissed';

  if report_count >= hide_threshold then
    begin
      if new.target_type = 'cat' then
        update public.cats
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'comment' then
        update public.cat_comments
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      elsif new.target_type = 'post_comment' then
        update public.post_comments
          set hidden = true
          where id = new.target_id::uuid and hidden = false;
      end if;
    exception when others then
      -- target_id가 uuid 형식이 아닌 등 예외는 조용히 무시 (신고 자체는 저장돼야 함)
      null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_hide_reported on public.reports;
create trigger trg_auto_hide_reported
  after insert on public.reports
  for each row
  execute function public.auto_hide_reported_target();

-- ──────────────────────────────────────────
-- 3. *_read_public 정책 갱신: 숨김 대상 제외
-- ──────────────────────────────────────────

-- cats
drop policy if exists "cats_read_public" on public.cats;
create policy "cats_read_public"
  on public.cats
  for select
  using (hidden = false);

drop policy if exists "cats_read_admin" on public.cats;
create policy "cats_read_admin"
  on public.cats
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- cat_comments
drop policy if exists "cat_comments_read_public" on public.cat_comments;
create policy "cat_comments_read_public"
  on public.cat_comments
  for select
  using (hidden = false);

drop policy if exists "cat_comments_read_admin" on public.cat_comments;
create policy "cat_comments_read_admin"
  on public.cat_comments
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- post_comments
drop policy if exists "post_comments_read_public" on public.post_comments;
create policy "post_comments_read_public"
  on public.post_comments
  for select
  using (hidden = false);

drop policy if exists "post_comments_read_admin" on public.post_comments;
create policy "post_comments_read_admin"
  on public.post_comments
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 4. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
