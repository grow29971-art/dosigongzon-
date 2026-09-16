-- ══════════════════════════════════════════════════════════════
-- 운영 배지('staff') 사칭 차단 — is_admin_only_title에 'staff' 추가
-- 2026-09-16 커뮤니티 운영 페르소나(글·댓글 자동 작성) 도입에 따른 가드 확장
-- 실행 위치: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: supabase_author_snapshot_guard_migration.sql (2026-07-31, 실행 완료)
-- ══════════════════════════════════════════════════════════════
--
-- [배경]
--   lib/community-personas.ts의 페르소나 글·댓글은 author_title='staff'로 저장되고
--   화면에는 "운영" 배지로 표시된다(lib/titles.ts ADMIN_TITLES). 이 id가 DB 가드 목록에
--   없으면 로그인 유저가 PostgREST로 author_title='staff'를 직접 넣어 운영 사칭이 가능하다.
--   가드 함수는 목록에 있는 id에 대해 profiles.admin_title과 대조해 다르면 강등한다.
--   service_role(크론)은 current_user 게이트로 통과하므로 페르소나 쓰기는 영향 없다.
--
-- [검증] 실행 후:
--   select public.is_admin_only_title('staff');  -- true
--   로그인 유저 토큰으로 posts insert author_title='staff' → 저장된 author_title이 null(또는 실제 admin_title)
-- ══════════════════════════════════════════════════════════════

create or replace function public.is_admin_only_title(p_title text)
returns boolean
language sql
immutable
as $$
  select p_title = any (array[
    'og_200','founding_member','official_volunteer','tnr_expert','rescue_hero',
    'community_leader','veterinary_partner','early_supporter','content_creator','donor',
    'staff'
  ]);
$$;

-- ── 롤백 ──────────────────────────────────────────────────────
-- create or replace function public.is_admin_only_title(p_title text)
-- returns boolean language sql immutable as $$
--   select p_title = any (array[
--     'og_200','founding_member','official_volunteer','tnr_expert','rescue_hero',
--     'community_leader','veterinary_partner','early_supporter','content_creator','donor'
--   ]);
-- $$;
