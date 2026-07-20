-- ══════════════════════════════════════════════════════════════
-- 카드배틀 기능 전면 삭제 — DB 정리 (2026-07-20)
-- 코드 삭제(커밋 참조)와 세트. 이 SQL은 "선택" 정리다:
--   실행하지 않아도 앱은 정상 동작한다 (코드가 더 이상 이 컬럼/테이블을 읽지 않음).
--   지금 당장 실행하지 말고, 배포 후 1~2주 문제없음을 확인한 뒤 실행 권장.
--
-- ⚠️ 컬럼/테이블 DROP은 데이터가 사라진다. 아래 롤백 SQL은 "구조"만 복원하고
--    데이터는 복원하지 못한다 (2026-07-20 기준 배틀 사용 실유저 ~0명이라 손실 미미).
--
-- 유지하는 것 (삭제 금지):
--   cats.battle_atk / battle_def / battle_eva / battle_crit / battle_special~4
--     → 카드 생성(generate-card·합성·승급)이 여전히 쓰는 카드 고유 스탯/기술
--   profiles.perfect_catch_count → 포획 타이틀에 계속 사용
--   user_items + 테두리/케어 아이템, equip_item_atomic RPC → 테두리 장착에 계속 사용
-- ══════════════════════════════════════════════════════════════

-- 1) 배틀 기록 테이블
drop table if exists card_battles;

-- 2) profiles 배틀 카운터 (perfect_catch_count는 남긴다!)
alter table profiles drop column if exists boss_defeats;
alter table profiles drop column if exists best_win_streak;
-- PVE 도감(야생동물 조우 기록) — 도감 페이지 삭제됨
alter table profiles drop column if exists pve_seen_keys;

-- 3) cats 배틀 전적/장비 컬럼
alter table cats drop column if exists win_streak;
alter table cats drop column if exists best_win_streak;
alter table cats drop column if exists pve_win_count;
alter table cats drop column if exists pvp_wins;
alter table cats drop column if exists pvp_losses;
alter table cats drop column if exists pvp_draws;
alter table cats drop column if exists pve_losses;
alter table cats drop column if exists pve_draws;
-- 부위별 장비창(전투 참 5종) — 테두리는 equipped_border_key 별도 컬럼이라 영향 없음
alter table cats drop column if exists equipped_slots;

-- 4) 삭제된 상점 품목의 잔여 보유 기록 (전투 소모품·장착 참·스킬 머신)
delete from user_items where item_key in (
  'heal_potion','shield','cleanse_potion','skill_recharge','power_up','lucky_charm',
  'skill_relearn','atk_charm','def_charm','crit_charm','eva_charm','hp_charm'
);

-- ══════════════════════════════════════════════════════════════
-- 롤백 (구조 복원용 — 데이터는 복원 불가)
-- ══════════════════════════════════════════════════════════════
-- create table if not exists card_battles (
--   id uuid primary key default gen_random_uuid(),
--   attacker_cat_id uuid references cats(id) on delete cascade,
--   defender_cat_id uuid references cats(id) on delete cascade,
--   winner_id uuid,
--   created_at timestamptz default now()
-- );  -- (정확한 원본 스키마는 box/supabase_battle_*.sql 이력 참고)
-- alter table profiles add column if not exists boss_defeats int default 0;
-- alter table profiles add column if not exists best_win_streak int default 0;
-- alter table profiles add column if not exists pve_seen_keys text[] default '{}';
-- alter table cats add column if not exists win_streak int default 0;
-- alter table cats add column if not exists best_win_streak int default 0;
-- alter table cats add column if not exists pve_win_count int default 0;
-- alter table cats add column if not exists pvp_wins int default 0;
-- alter table cats add column if not exists pvp_losses int default 0;
-- alter table cats add column if not exists pvp_draws int default 0;
-- alter table cats add column if not exists pve_losses int default 0;
-- alter table cats add column if not exists pve_draws int default 0;
-- alter table cats add column if not exists equipped_slots jsonb;
-- (user_items 행 삭제는 롤백 불가 — 코드 롤백 시 아이템 재구매 필요)
