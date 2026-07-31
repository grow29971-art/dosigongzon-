-- ══════════════════════════════════════════════════════════════
-- 🔴 작성자 스냅샷 위조 차단 — posts / post_comments / cat_comments
-- 2026-07-31 팬테스트 [HIGH] (독립 2개 에이전트가 프로덕션 201 write로 재현)
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ⚠ Chrome 번역 OFF
-- 선행: supabase_posts_migration.sql, supabase_post_comments_migration.sql,
--       supabase_cat_comments_schema.sql, supabase_auto_hide_reported_migration.sql
-- ══════════════════════════════════════════════════════════════
--
-- [문제]
--   INSERT 정책이 `auth.uid() = author_id`만 검사하고 스냅샷 컬럼엔 제약이 없다.
--   앱(posts-repo)은 서버가 author_name/title/level을 채우지만 이는 UI 경로일 뿐,
--   로그인 유저가 PostgREST를 직접 호출하면:
--     - author_title = 'official_volunteer' → 💛공식 봉사자 배지 위조(운영자 사칭)
--     - is_pinned = true                    → 자기 글 게시판 최상단 고정
--     - hidden = false (자기 auto-hidden 글) → 신고 자동숨김 무력화
--     - like_count/view_count/comment_count  → 인기글 순위 조작
--   posts_update_own(using auth.uid()=author_id)도 같은 컬럼을 사후 수정 가능.
--
-- [해결 — 관리자 인지 BEFORE INSERT/UPDATE 트리거]
--   ① 직접 클라이언트 쓰기(current_user='authenticated')일 때만 강제.
--      카운터 RPC(post_vote_update·post_view_inc·sync_post_comment_count 등)와
--      auto_hide_reported_target()은 전부 SECURITY DEFINER라 current_user가
--      소유자(postgres)로 바뀌므로 이 게이트를 통과 → 좋아요·조회수·자동숨김 정상 동작.
--      service_role(서버/cron)도 current_user='service_role'이라 통과.
--   ② admins에 속하면 전체 허용(운영자는 UI에서 client PATCH로 고정/숨김 처리함).
--   ③ 비-admin 직접 쓰기:
--      - INSERT: is_pinned/hidden/카운터를 안전 기본값으로 강제
--      - UPDATE: 신원·모더레이션·카운터 컬럼을 OLD값으로 보존(제목/본문/이미지만 편집 허용)
--      - author_title: 관리자 부여 배지(ADMIN_TITLES) 사칭 시 실제 admin_title로 강등
--        (획득형/코스메틱 타이틀은 통과 — 배지 사칭이 유일한 실질 피해)
--
-- ※ 전제: posts/comments의 카운터를 갱신하는 함수는 전부 SECURITY DEFINER여야 한다.
--   (실측 확인: post_vote_update·post_view_inc·sync_post_comment_count·comment vote 트리거
--    모두 definer.) 향후 비-definer 카운터를 추가하면 이 트리거가 막으므로 주의.
-- ══════════════════════════════════════════════════════════════

-- 관리자 부여 전용 타이틀 id (lib/titles.ts ADMIN_TITLES와 동기화 유지)
-- profiles.admin_title로만 부여되며 게임 컬럼 가드 트리거로 잠겨 있음.
create or replace function public.is_admin_only_title(p_title text)
returns boolean
language sql
immutable
as $$
  select p_title = any (array[
    'og_200','founding_member','official_volunteer','tnr_expert','rescue_hero',
    'community_leader','veterinary_partner','early_supporter','content_creator','donor'
  ]);
$$;

-- ── posts ──────────────────────────────────────────────────────
create or replace function public.guard_posts_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_real_title text;
begin
  -- definer RPC/트리거·service_role은 통과 (카운터·자동숨김·서버 작업)
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_is_admin := exists (select 1 from public.admins where user_id = auth.uid());

  if tg_op = 'INSERT' then
    if not v_is_admin then
      new.is_pinned          := false;
      new.hidden             := false;
      new.view_count         := 0;
      new.like_count         := 0;
      new.dislike_count      := 0;
      new.comment_count      := 0;
      new.like_count_snapshot := 0;
      new.like_snapshot_at   := null;
    end if;
    -- 배지 사칭 차단(관리자 포함 공통 불변식: 내 admin_title과 일치해야 함)
    if new.author_title is not null and public.is_admin_only_title(new.author_title) then
      select admin_title into v_real_title from public.profiles where id = new.author_id;
      if v_real_title is distinct from new.author_title then
        new.author_title := v_real_title;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    if not v_is_admin then
      -- 신원·모더레이션·카운터 보존 (제목/본문/이미지/지역/카드첨부만 편집 허용)
      new.author_id          := old.author_id;
      new.author_name        := old.author_name;
      new.author_title       := old.author_title;
      new.author_level       := old.author_level;
      new.author_avatar_url  := old.author_avatar_url;
      new.is_pinned          := old.is_pinned;
      new.hidden             := old.hidden;
      new.view_count         := old.view_count;
      new.like_count         := old.like_count;
      new.dislike_count      := old.dislike_count;
      new.comment_count      := old.comment_count;
      new.like_count_snapshot := old.like_count_snapshot;
      new.like_snapshot_at   := old.like_snapshot_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_posts_guard_snapshot on public.posts;
create trigger tr_posts_guard_snapshot
  before insert or update on public.posts
  for each row execute function public.guard_posts_snapshot();

-- ── post_comments ──────────────────────────────────────────────
-- 컬럼: author_id/name/title/level/avatar_url, body, hidden, is_secret, parent_id, post_id
create or replace function public.guard_post_comments_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_real_title text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_is_admin := exists (select 1 from public.admins where user_id = auth.uid());

  if tg_op = 'INSERT' then
    if not v_is_admin then
      new.hidden := false;
    end if;
    if new.author_title is not null and public.is_admin_only_title(new.author_title) then
      select admin_title into v_real_title from public.profiles where id = new.author_id;
      if v_real_title is distinct from new.author_title then
        new.author_title := v_real_title;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    if not v_is_admin then
      new.author_id         := old.author_id;
      new.author_name       := old.author_name;
      new.author_title      := old.author_title;
      new.author_level      := old.author_level;
      new.author_avatar_url := old.author_avatar_url;
      new.hidden            := old.hidden;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_post_comments_guard_snapshot on public.post_comments;
create trigger tr_post_comments_guard_snapshot
  before insert or update on public.post_comments
  for each row execute function public.guard_post_comments_snapshot();

-- ── cat_comments ───────────────────────────────────────────────
-- 컬럼: author_id/name/title/level/avatar_url, body, kind, photo_url,
--       hidden, like_count, dislike_count
create or replace function public.guard_cat_comments_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_real_title text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_is_admin := exists (select 1 from public.admins where user_id = auth.uid());

  if tg_op = 'INSERT' then
    if not v_is_admin then
      new.hidden        := false;
      new.like_count    := 0;
      new.dislike_count := 0;
    end if;
    if new.author_title is not null and public.is_admin_only_title(new.author_title) then
      select admin_title into v_real_title from public.profiles where id = new.author_id;
      if v_real_title is distinct from new.author_title then
        new.author_title := v_real_title;
      end if;
    end if;

  elsif tg_op = 'UPDATE' then
    if not v_is_admin then
      new.author_id         := old.author_id;
      new.author_name       := old.author_name;
      new.author_title      := old.author_title;
      new.author_level      := old.author_level;
      new.author_avatar_url := old.author_avatar_url;
      new.hidden            := old.hidden;
      new.like_count        := old.like_count;
      new.dislike_count     := old.dislike_count;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_cat_comments_guard_snapshot on public.cat_comments;
create trigger tr_cat_comments_guard_snapshot
  before insert or update on public.cat_comments
  for each row execute function public.guard_cat_comments_snapshot();

-- ══════════════════════════════════════════════════════════════
-- 검증 (실행 후, 일반 유저 JWT로)
--   POST /rest/v1/posts {"category":"free","title":"x","content":"y",
--        "author_id":"<내uid>","author_title":"official_volunteer","is_pinned":true}
--     → 201 이지만 반환 row에 author_title=null(또는 내 실제 admin_title), is_pinned=false
--   PATCH /rest/v1/posts?id=eq.<내글> {"is_pinned":true,"author_title":"official_volunteer"}
--     → 200 이지만 값 변화 없음(OLD 보존)
--   좋아요 버튼(post_vote_update RPC) → like_count 정상 증가(트리거 통과 확인)
--   관리자 JWT로 PATCH {"is_pinned":true} → 정상 고정
-- ══════════════════════════════════════════════════════════════

-- ── ROLLBACK (되돌리기) ──
-- drop trigger if exists tr_posts_guard_snapshot on public.posts;
-- drop trigger if exists tr_post_comments_guard_snapshot on public.post_comments;
-- drop trigger if exists tr_cat_comments_guard_snapshot on public.cat_comments;
-- drop function if exists public.guard_posts_snapshot();
-- drop function if exists public.guard_post_comments_snapshot();
-- drop function if exists public.guard_cat_comments_snapshot();
-- drop function if exists public.is_admin_only_title(text);
