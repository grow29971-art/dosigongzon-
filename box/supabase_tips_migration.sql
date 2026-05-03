-- ══════════════════════════════════════════
-- 꿀팁게시판 (tips) 테이블 + RLS + 시드
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ⚠ 번역 기능이 켜져있으면 꺼주세요 (Chrome 자동번역이 SQL을 망가뜨림)
-- 선행조건: supabase_news_admin_migration.sql (admins 테이블)이 먼저 실행되어 있어야 함
-- ══════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. tips 테이블
-- ──────────────────────────────────────────
create table if not exists public.tips (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  description    text,                              -- SEO meta description
  body           text not null,                     -- 본문 (HTML 또는 일반 텍스트)
  thumbnail_url  text,
  tags           text[] default '{}'::text[] not null,
  source_url     text,                              -- 원문 출처 URL ("퍼온 글")
  source_label   text,                              -- 출처 표시 (예: "OO 블로그")
  featured       boolean default false not null,    -- 상단 큰 카드 노출
  pinned         boolean default false not null,
  view_count     int default 0 not null,
  published      boolean default true not null,
  published_at   timestamptz default now() not null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

-- 인덱스
create index if not exists tips_published_at_idx
  on public.tips (published_at desc) where published = true;

create index if not exists tips_featured_idx
  on public.tips (featured, published_at desc) where published = true and featured = true;

create index if not exists tips_pinned_idx
  on public.tips (pinned, published_at desc) where published = true and pinned = true;

create index if not exists tips_tags_idx
  on public.tips using gin (tags);

-- ──────────────────────────────────────────
-- 2. RLS 정책
-- ──────────────────────────────────────────
alter table public.tips enable row level security;

-- 발행된 글만 누구나 읽기 가능
drop policy if exists "tips_read_public" on public.tips;
create policy "tips_read_public"
  on public.tips
  for select
  using (published = true);

-- 관리자는 모든 글 읽기 (초안 포함)
drop policy if exists "tips_read_admin_all" on public.tips;
create policy "tips_read_admin_all"
  on public.tips
  for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "tips_insert_admin" on public.tips;
create policy "tips_insert_admin"
  on public.tips
  for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "tips_update_admin" on public.tips;
create policy "tips_update_admin"
  on public.tips
  for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

drop policy if exists "tips_delete_admin" on public.tips;
create policy "tips_delete_admin"
  on public.tips
  for delete
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- ──────────────────────────────────────────
-- 3. 조회수 증가 RPC (RLS 우회용 — 누구나 호출 가능, 1씩만 증가)
-- ──────────────────────────────────────────
create or replace function public.increment_tip_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tips
    set view_count = view_count + 1
    where slug = p_slug and published = true;
end;
$$;

revoke all on function public.increment_tip_view(text) from public;
grant execute on function public.increment_tip_view(text) to anon, authenticated;

-- ──────────────────────────────────────────
-- 4. updated_at 자동 갱신 트리거
-- ──────────────────────────────────────────
create or replace function public.tips_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tips_updated_at_trigger on public.tips;
create trigger tips_updated_at_trigger
  before update on public.tips
  for each row execute function public.tips_set_updated_at();

-- ──────────────────────────────────────────
-- 5. 시드 데이터 (첫 실행 시에만 insert)
-- ──────────────────────────────────────────
do $$
begin
  if (select count(*) from public.tips) = 0 then
    insert into public.tips
      (slug, title, description, body, thumbnail_url, tags, source_url, source_label, featured, published_at)
    values
      (
        'welcome-tips-board',
        '꿀팁게시판이 열렸어요',
        '길고양이 돌봄, TNR, 입양 관련 유용한 정보를 한곳에 모아둡니다.',
        E'<p>안녕하세요, 도시공존입니다.</p><p>꿀팁게시판은 길고양이 돌봄·TNR·입양과 관련된 <strong>유용한 정보글</strong>을 큐레이션해 모으는 공간이에요.</p><p>다른 곳의 좋은 글들을 출처와 함께 옮겨오기도 하고, 도시공존이 직접 쓴 가이드도 올라옵니다.</p><h2>이런 글들이 올라올 거예요</h2><ul><li>TNR 신청·진행 노하우</li><li>겨울철 길고양이 돌봄 팁</li><li>구조·임시보호 주의사항</li><li>아기 고양이 케어 방법</li><li>중성화 후 회복 관리</li></ul><p>유용한 글을 발견하셨다면 도시공존 인스타로 제보해주세요.</p>',
        'https://placehold.co/1200x630/F7F4EE/C47E5A?text=Tips',
        ARRAY['공지', '도시공존']::text[],
        null,
        null,
        true,
        now()
      );
  end if;
end $$;

-- ──────────────────────────────────────────
-- 6. 스키마 캐시 재로드
-- ──────────────────────────────────────────
notify pgrst, 'reload schema';

-- 끝.
