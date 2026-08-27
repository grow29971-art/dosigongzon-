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

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════
-- 검증 (실행 후):
--   select card_level, card_exp from cats limit 1;             → 정상 (남긴 컬럼)
--   select card_rarity from cats limit 1;                       → 42703 에러가 정상 (지워짐)
--   select count(*) from user_items where item_key like 'border_%';  → 0
-- 롤백(구조만): box/supabase_card_battle_removal_20260720.sql 하단 롤백 블록 +
--   카드 컬럼은 box/supabase_catchcat_cards_migration.sql 원본 참고. 데이터 복원 불가.
-- ══════════════════════════════════════════════════════════════
-- 끝.
