-- ══════════════════════════════════════════
-- 추모일기 (memorial_diaries) — 2026-08-09
--
-- 배경:
--   고양이별은 지금 "보관"만 한다. 떠나보낸 사람이 그 뒤에 할 수 있는 게 헌화 한 번뿐이다.
--   반려동물 상실 슬픔은 주변에서 충분히 인정받지 못해(disenfranchised grief) 말할 곳이
--   없는 채로 길어지는 종류다. 매일 한 줄씩 쓸 자리를 만든다.
--
-- 설계 원칙:
--   · 기본 비공개. 슬픔은 사적인 것이고, 공개는 쓴 사람이 고를 일이다(is_shared).
--   · 하루 1편 제약을 두지 않는다. 힘든 날엔 여러 번 쓰게 된다.
--   · 연속 일수·배지 없음. 며칠 못 쓴 게 실패로 보이면 안 된다.
--     "N일 연속"이 아니라 "N번째 편지"로 센다.
--   · mood(1~5)는 선택. 글이 안 나오는 날 이것만 찍고 나가도 되게.
--
-- ⚠ Supabase SQL Editor 는 자체 트랜잭션으로 감싸므로 begin/commit 을 쓰지 않는다.
--    alter/create 는 한 줄에 하나씩(42601 재발 방지).
--    is_user_not_suspended 는 (uid uuid) 를 받는다 — 무인자 호출 금지(42883).
-- ══════════════════════════════════════════

create table if not exists public.memorial_diaries (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references public.cats(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null,
  mood smallint check (mood between 1 and 5),
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.memorial_diaries is '추모일기 — 떠나보낸 뒤 쓰는 글. 기본 비공개(is_shared=false).';
comment on column public.memorial_diaries.mood is '그날의 마음 1(많이 힘듦)~5(괜찮음). 선택 입력.';

create index if not exists memorial_diaries_cat_idx on public.memorial_diaries(cat_id, created_at desc);
create index if not exists memorial_diaries_author_idx on public.memorial_diaries(author_id, created_at desc);

alter table public.memorial_diaries enable row level security;

-- 조회: 내 글이거나, 쓴 사람이 공개로 둔 글
drop policy if exists "추모일기 조회" on public.memorial_diaries;
create policy "추모일기 조회" on public.memorial_diaries for select using (is_shared = true or auth.uid() = author_id);

-- 작성: 본인 명의로만, 정지 유저 제외
drop policy if exists "추모일기 작성" on public.memorial_diaries;
create policy "추모일기 작성" on public.memorial_diaries for insert to authenticated with check (auth.uid() = author_id and public.is_user_not_suspended(auth.uid()));

-- 수정: 본인만 (공개 여부 전환 포함)
drop policy if exists "추모일기 수정" on public.memorial_diaries;
create policy "추모일기 수정" on public.memorial_diaries for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- 삭제: 본인만
drop policy if exists "추모일기 삭제" on public.memorial_diaries;
create policy "추모일기 삭제" on public.memorial_diaries for delete to authenticated using (auth.uid() = author_id);

-- ────────────────────────────────
-- 검증
-- ────────────────────────────────
-- select count(*) from public.memorial_diaries;                              -- 0 기대(최초)
-- anon 키로: GET /rest/v1/memorial_diaries → 200 이되 공개글만
-- anon 키로: POST /rest/v1/memorial_diaries → 401 기대(쓰기 차단)

-- ══════════════════════════════════════════
-- 롤백
-- ══════════════════════════════════════════
-- drop table if exists public.memorial_diaries;
