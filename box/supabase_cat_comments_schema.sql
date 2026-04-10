-- ══════════════════════════════════════════
-- 도시공존 — cat_comments 테이블 + RLS + 더미
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행 조건: supabase_cats_schema.sql이 이미 실행되어 있어야 함
-- ══════════════════════════════════════════

-- 1. 테이블
create table if not exists public.cat_comments (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  body text not null,
  kind text not null default 'note' check (kind in ('note', 'alert')),
  created_at timestamptz default now() not null
);

-- 2. 인덱스 (고양이별 시간순 조회)
create index if not exists cat_comments_cat_id_created_idx
  on public.cat_comments (cat_id, created_at desc);

-- 3. RLS
alter table public.cat_comments enable row level security;

-- 읽기: 누구나 가능 (공개 피드)
drop policy if exists "cat_comments_read_public" on public.cat_comments;
create policy "cat_comments_read_public"
  on public.cat_comments
  for select
  using (true);

-- 쓰기: 로그인 유저만
drop policy if exists "cat_comments_insert_authenticated" on public.cat_comments;
create policy "cat_comments_insert_authenticated"
  on public.cat_comments
  for insert
  with check (auth.uid() = author_id);

-- 본인 댓글만 삭제
drop policy if exists "cat_comments_delete_own" on public.cat_comments;
create policy "cat_comments_delete_own"
  on public.cat_comments
  for delete
  using (auth.uid() = author_id);

-- 4. 더미 댓글 (각 샘플 고양이별 3~4건)
-- cat_id를 이름으로 조회해서 넣음 → 샘플 데이터가 있어야 채워짐
insert into public.cat_comments (cat_id, author_name, body, kind, created_at)
select id, '캣맘 박씨', '오후 3시에 츄르 하나 줬어요. 잘 먹네요 🐟', 'note', now() - interval '2 hours'
from public.cats where name = '까망이'
union all
select id, '동네주민', '오전 10시에 밥 200g 급여했어요. 깨끗하게 다 먹음.', 'note', now() - interval '6 hours'
from public.cats where name = '까망이'
union all
select id, '골목 단골', '까망이 오늘 컨디션 좋아 보여요. 골골송까지 들려줬어요.', 'note', now() - interval '1 day'
from public.cats where name = '까망이'

union all
select id, '편의점 사장님', '오후 1시쯤 사료 200g 챙겨놨어요.', 'note', now() - interval '3 hours'
from public.cats where name = '치즈'
union all
select id, '츄르요정', '치즈 좋아하는 츄르 2개 놓고 감요 💛', 'note', now() - interval '5 hours'
from public.cats where name = '치즈'
union all
select id, '익명', '어제 누가 치즈한테 돌 던지는 거 봤어요. 학대 같아요. 주의 바람.', 'alert', now() - interval '1 day'
from public.cats where name = '치즈'

union all
select id, '놀이터 할머니', '새끼들이랑 같이 있어요. 오늘 사료 300g 급여.', 'note', now() - interval '4 hours'
from public.cats where name = '삼색이'
union all
select id, '주민', '어제 밤에 어떤 사람이 삼색이 새끼들 잡으려 하는 거 봤어요. 신고했어요.', 'alert', now() - interval '12 hours'
from public.cats where name = '삼색이'

union all
select id, '경비 아저씨', '고등어 밤 순찰 잘 돌고 있음. 새벽 2시 사료 보충.', 'note', now() - interval '8 hours'
from public.cats where name = '고등어'
union all
select id, '동네 캣대디', '오후 6시에 물 갈아주고 사료 150g 줬음요', 'note', now() - interval '10 hours'
from public.cats where name = '고등어'

union all
select id, '꽃집 사장님', '노랑이 화단에 물 마시러 옴. 사료 100g 놓아둠.', 'note', now() - interval '3 hours'
from public.cats where name = '노랑이'
union all
select id, '산책러', '노랑이 최근에 다리를 저는 것 같아요. 병원 한 번 봐야 할 듯.', 'alert', now() - interval '2 days'
from public.cats where name = '노랑이'

union all
select id, '빌라 주민', '흰둥이 아침 8시에 밥 200g 줬어요. 온순해서 손 탐 🤍', 'note', now() - interval '5 hours'
from public.cats where name = '흰둥이'
union all
select id, '동네 학생', '흰둥이 오늘도 골목에서 잘 놀고 있어요. 물그릇 채워놨어요.', 'note', now() - interval '1 day'
from public.cats where name = '흰둥이';

-- 끝.
