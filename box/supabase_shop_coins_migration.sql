-- ── 상점/코인 시스템 ──
-- 코인: 배틀 승리(소량) + 돌봄 활동(일 제한) + 로그인(1일 1회)으로 획득
-- 아이템: user_items에 보유 수량 저장, 구매/사용은 서버(service_role)에서만 처리

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_bonus_date DATE,
  ADD COLUMN IF NOT EXISTS last_care_coin_date DATE,
  ADD COLUMN IF NOT EXISTS care_coin_count_today INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;

-- 본인 보유 아이템만 조회 가능 (구매/사용은 service_role API를 통해서만 처리 — 클라이언트 직접 쓰기 금지)
DROP POLICY IF EXISTS "user_items_select_own" ON user_items;
CREATE POLICY "user_items_select_own" ON user_items
  FOR SELECT USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON user_items FROM authenticated, anon;

-- 결과 확인
SELECT 'shop coins migration done' AS status;
