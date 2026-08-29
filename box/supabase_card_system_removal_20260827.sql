-- ══════════════════════════════════════════════════════════════
-- 카드·배틀 시스템 전면 폐지 — DB 정리 (2026-08-27 사장님 지시)
-- 코드 제거 커밋과 세트. 미실행이던 7/20 배틀 정리 SQL(supabase_card_battle_removal_20260720.sql)
-- 내용을 포함·확장한 통합판 — 이 파일 하나만 실행하면 된다.
--
-- ⚠️ DROP은 데이터가 사라진다. 롤백 SQL은 "구조"만 복원하고 데이터는 복원 불가.
--
-- 남기는 것 (삭제 금지 — 케어 기능이 사용):
--   cats.card_level / card_exp        → 다마고치 "돌봄 레벨" (홈 히어로·출석 보상·/api/care)
--   cats.art_key / art_colors         → 지도 마커 AI 아트 (backfill-cat-art 크론)
--   profiles.rep_card_cat_id          → 다마고치 대표묘
--   profiles.coins / user_items 케어 간식(premium_can·churu·growth_can) → 코인 상점
-- ══════════════════════════════════════════════════════════════

-- ── 0. profiles_public 뷰 선(先) 재정의 (2BP01 해소) ──
-- 뷰가 boss_defeats·best_win_streak을 투영하고 있어 컬럼 drop이 막힌다.
-- ⚠ CASCADE 금지 — 이 뷰는 프로필 락다운(7/30)의 공개 통로라 통째로 지우면 앱이 깨진다.
--   코드 실측: 뷰에서 배틀 컬럼을 읽는 곳 없음(닉네임·아바타·perfect_catch_count만) → 빼도 안전.
-- Postgres는 create or replace로 뷰 컬럼을 못 빼므로 drop→create→grant 순서.
begin;
drop view if exists public.profiles_public;
create view public.profiles_public as
select
  id,
  nickname,
  avatar_url,
  admin_title,
  suspended,
  created_at,
  perfect_catch_count
from public.profiles;
grant select on public.profiles_public to anon, authenticated;
commit;

-- ── 0b. cats_public_map 뷰 선(先) 드랍 (2차 2BP01 해소) ──
-- 이 뷰는 cats 전 컬럼을 동적으로 복사해 만들어져(좌표 퍼징 뷰) 배틀·카드 컬럼을
-- 전부 물고 있다. ⚠ CASCADE 금지 — 아래 컬럼 정리 후 섹션 2b에서 같은 동적
-- 블록으로 재생성한다(그때는 정리된 컬럼 목록으로 만들어짐).
drop view if exists public.cats_public_map;

-- ── 1. 배틀 잔재 (7/20 파일 그대로 — 당시 미실행분) ──
drop table if exists card_battles;
alter table profiles drop column if exists boss_defeats;
alter table profiles drop column if exists best_win_streak;
alter table profiles drop column if exists pve_seen_keys;
alter table cats drop column if exists win_streak;
alter table cats drop column if exists best_win_streak;
alter table cats drop column if exists pve_win_count;
alter table cats drop column if exists pvp_wins;
alter table cats drop column if exists pvp_losses;
alter table cats drop column if exists pvp_draws;
alter table cats drop column if exists pve_losses;
alter table cats drop column if exists pve_draws;
alter table cats drop column if exists equipped_slots;
delete from user_items where item_key in (
  'heal_potion','shield','cleanse_potion','skill_recharge','power_up','lucky_charm',
  'skill_relearn','atk_charm','def_charm','crit_charm','eva_charm','hp_charm'
);

-- ── 2. 카드 정체성 컬럼 (8/27 추가 — 코드가 더 이상 읽지 않음) ──
alter table cats drop column if exists card_rarity;
alter table cats drop column if exists card_name;
alter table cats drop column if exists card_traits;
alter table cats drop column if exists card_stats;
alter table cats drop column if exists card_flavor;
alter table cats drop column if exists card_generated_at;
-- 배틀 스탯 (7/20에는 "카드 생성이 쓴다"고 유지했으나, 카드 생성도 폐지됨)
alter table cats drop column if exists battle_atk;
alter table cats drop column if exists battle_def;
alter table cats drop column if exists battle_eva;
alter table cats drop column if exists battle_crit;
alter table cats drop column if exists battle_special;
alter table cats drop column if exists battle_special2;
alter table cats drop column if exists battle_special3;
alter table cats drop column if exists battle_special4;
-- 테두리 코스메틱 (장착 컬럼 + 보유 아이템)
alter table cats drop column if exists equipped_border_key;
delete from user_items where item_key like 'border_%';

-- ── 2b. cats_public_map 재생성 — 정리된 컬럼 목록으로 (0b에서 드랍한 뷰) ──
-- supabase_cat_memorial_migration.sql의 동적 생성 블록 그대로: lat/lng는 좌표 퍼징,
-- memorial_by 제외, 공개 조건 동일. 재생성 후 grant·쓰기 revoke 반드시 재적용.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'cats'
     and column_name not in ('lat', 'lng', 'memorial_by');

  execute format($f$
    create view public.cats_public_map as
    select
      %s,
      lat + (((hashtext(id::text || '_lat') & 1023) - 512) * 0.0000081) as lat,
      lng + (((hashtext(id::text || '_lng') & 1023) - 512) * 0.0000101) as lng
    from public.cats
    where hidden = false and visibility = 'public' and memorial_at is null
  $f$, cols);
end $$;

grant select on public.cats_public_map to anon, authenticated;
-- 공개 뷰 쓰기 차단 — drop 후 새로 만든 뷰라 기존 revoke가 날아감, 반드시 다시 건다
revoke insert, update, delete on public.cats_public_map from anon, authenticated;

-- ── 3. 🔴 P0: add_cat_card_exp 재정의 — 돌봄 레벨 적립 보존 (8/29 버그 사냥 발견) ──
-- 기존 함수가 card_generated_at(위에서 DROP됨)을 조건으로 읽어서, 재정의 없이
-- 컬럼만 지우면 모든 돌봄 기록의 EXP 적립이 42703으로 무증상 사망한다.
-- 아래는 기존 정의(supabase_care_exp_consume_migration.sql)에서 카드 생성 조건과
-- no_card 분기만 제거한 버전 — 로그 원자 소비(연타 방어)는 그대로 유지.
create or replace function public.add_cat_card_exp(p_cat_id uuid, p_amount int default 10)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_fixed    int  := 10;   -- p_amount는 신뢰하지 않음 — 돌봄 1회 = 10 XP 고정
  v_log_id   uuid;
  v_prev_exp int;
  v_new_exp  int;
  v_prev_lvl int;
  v_new_lvl  int;
begin
  if v_uid is null then
    return '{"ok":false,"error":"unauthorized"}'::json;
  end if;

  update care_logs cl
  set card_exp_awarded_at = now()
  where cl.id = (
    select id from care_logs
    where cat_id = p_cat_id
      and author_id = v_uid
      and card_exp_awarded_at is null
      and created_at > now() - interval '10 minutes'
    order by created_at desc
    for update skip locked
    limit 1
  )
  returning cl.id into v_log_id;

  if not found then
    return '{"ok":false,"error":"no_recent_log"}'::json;
  end if;

  -- 카드 폐지(8/27): card_generated_at 조건 제거 — 모든 등록묘가 돌봄 레벨 대상
  select card_exp, card_level into v_prev_exp, v_prev_lvl
  from cats where id = p_cat_id
  for update;

  if not found then
    update care_logs set card_exp_awarded_at = null where id = v_log_id;
    return '{"ok":false,"error":"no_cat"}'::json;
  end if;

  if v_prev_lvl >= 10 then
    return json_build_object('ok', true, 'level', 10, 'exp', v_prev_exp, 'leveled_up', false);
  end if;

  v_new_exp := v_prev_exp + v_fixed;
  v_new_lvl := greatest(v_prev_lvl, compute_cat_card_level(v_new_exp));

  update cats
  set card_exp = v_new_exp, card_level = v_new_lvl
  where id = p_cat_id;

  return json_build_object(
    'ok',         true,
    'level',      v_new_lvl,
    'exp',        v_new_exp,
    'prev_level', v_prev_lvl,
    'leveled_up', v_new_lvl > v_prev_lvl
  );
end;
$$;

-- ── 4. 부록: 8/29 버그 사냥에서 나온 DB 결함 봉인 (카드와 무관하지만 한 번에 실행) ──
-- 4a. 가상(후원) 상품은 배송비 0 강제 — 게스트 RPC에만 있던 분기의 비대칭 봉인.
--     위반 시 게스트 후원 결제가 전부 거부되는 잠복 지뢰였음(F-1).
alter table products add constraint products_virtual_no_shipping
  check (not is_virtual or shipping_fee = 0);

-- 4b. signup_source 형식·길이 제약 — 클라 정규화(normalizeSource)만 있고 서버 제약이 없었음.
alter table profiles add constraint profiles_signup_source_format
  check (signup_source is null or (length(signup_source) <= 32 and signup_source ~ '^[a-z0-9._-]+$'));

-- 4c. 닉네임 중복 해소 + unique 인덱스 (7/31 팬테스트 잔여 — 실측: "학익2동 미미" 2명 등 중복 실존)
--     먼저 가입한 사람이 이름을 지키고, 뒤 가입자는 뒤에 숫자가 붙는다 (예: 학익2동 미미2).
--     ⚠ posts/comments의 author_name 스냅샷은 비정규화 의도라 소급 변경하지 않음(닉변과 동일 동작).
with d as (
  select id, row_number() over (partition by lower(nickname) order by created_at) rn
  from profiles where nickname is not null and nickname <> ''
)
update profiles p set nickname = p.nickname || d.rn
from d where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_nickname_unique_idx
  on profiles (lower(nickname)) where nickname is not null and nickname <> '';

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════
-- 검증 (실행 후):
--   select card_level, card_exp from cats limit 1;             → 정상 (남긴 컬럼)
--   select card_rarity from cats limit 1;                       → 42703 에러가 정상 (지워짐)
--   select count(*) from user_items where item_key like 'border_%';  → 0
--   앱에서 돌봄 기록 1건 → 레벨 EXP 적립 정상(+10)이면 P0 재정의 성공
--   select nickname, count(*) from profiles group by 1 having count(*) > 1;  → 0행
-- 롤백(구조만): box/supabase_card_battle_removal_20260720.sql 하단 롤백 블록 +
--   카드 컬럼은 box/supabase_catchcat_cards_migration.sql 원본 참고. 데이터 복원 불가.
-- ══════════════════════════════════════════════════════════════
-- 끝.
