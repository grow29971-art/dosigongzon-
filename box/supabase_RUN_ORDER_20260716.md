# 2026-07-16 SQL 실행 순서 (사장님 실행 필요)

Supabase Dashboard → SQL Editor에서 **아래 순서대로** 실행하세요. ⚠ Chrome 번역 OFF.
전부 코드에 폴백이 있어 실행 전에도 앱은 안 죽지만, 실행해야 보안·정합성이 완성됩니다.

## 실행 순서

1. **`supabase_care_migration.sql`** (아직 안 하셨으면 최우선)
   - cats에 fed_at/mood_at/fed_day/fed_today/pet_day 컬럼 추가.
   - 이걸 먼저 안 하면 4번(게임 컬럼 가드)의 cats 트리거가 없는 컬럼을 참조해 깨집니다.
   - 실행 전엔 다마고치 케어가 홈에서 "준비 중" 카드로 표시.

2. **`supabase_coins_tx_migration.sql`** (코인 지급 원자화)
   - `increment_coins`, `award_care_bonus_atomic` RPC 생성.
   - 출석·로그인·돌봄·배틀 코인 지급의 갱신 소실(lost update) 방지.

3. **`supabase_consume_item_migration.sql`** (아이템 소모 원자화)
   - `consume_user_item` RPC 생성.
   - 케어 간식·전투 소모품·스킬 재배정의 재고 중복 사용 차단.

4. **`supabase_game_columns_guard_migration.sql`** (게임 경제 컬럼 조작 차단) ⭐ 보안 핵심
   - profiles/cats의 코인·전적·보상날짜·케어상태 컬럼을 REST 직접 PATCH로 못 바꾸게 하는 트리거.
   - **반드시 1번(care 마이그레이션) 실행 후에.**

5. **`supabase_security_audit_20260716_2_migration.sql`** (감사 후속 3건) ⭐ 보안 핵심
   - buy_shop_item_atomic 권한 회수(무한 코인 발행 차단) — **즉시 효과 큼**.
   - 카드 레벨 커브 통일 + add_cat_card_exp EXP 주입 차단.
   - streak_freezes 직접 INSERT 정책 삭제(스트릭 조작 차단).

6. **`supabase_battle_token_uses_migration.sql`** (배틀 토큰 단회화)
   - `battle_token_uses` 테이블 생성 — 매칭 1회당 보상 1회로 제한.

## 실행 후 검증 (권장)

anon 키 + 일반 유저 JWT로 REST 직접 호출해 아래가 막히는지 확인:
- `PATCH /rest/v1/profiles?id=eq.<본인>` body `{"coins":999999}` → 트리거 예외(권한 없음)
- `POST /rest/v1/rpc/buy_shop_item_atomic` `{p_price:-100000}` → 권한 없음(권한 회수됨)
- `PATCH /rest/v1/cats?id=eq.<본인고양이>` body `{"card_level":10}` → 트리거 예외

## 롤백
각 SQL 파일 하단 주석에 롤백 SQL 포함. 코드는 RPC/테이블/트리거가 없어도 폴백 동작.
