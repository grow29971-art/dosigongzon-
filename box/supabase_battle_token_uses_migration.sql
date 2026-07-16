-- 도시공존 — 배틀 토큰 단회화 (2026-07-16 보안 감사 #3 완화)
-- 문제: /api/cats/card-battle(manual)이 발급한 서명 토큰을 /record가 검증만 하고
--   소모하지 않아, 같은 토큰을 15분 동안 반복 전송하면 매칭 1회로 코인·EXP·전적을
--   여러 번 수령 가능했음 (winner도 자기신고라 항상 "me"로 보낼 수 있음).
-- 해결: 사용된 토큰 해시를 기록하는 테이블 + unique 제약으로 1회만 인정.
--   (winner 서버 판정은 수동 배틀 전체 재작성이 필요해 후속 과제 — 이 완화로
--    파밍은 "실제 매칭 1회당 1회 보상"으로 제한됨)
-- 코드는 테이블이 없으면(42P01) 기존 동작으로 폴백하므로 실행 전에도 안전.

create table if not exists public.battle_token_uses (
  token_hash text primary key,          -- sha256(토큰 원문)
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now()
);

-- RLS: 정책 없이 활성화만 — anon/authenticated 접근 전부 거부, service_role만 사용
alter table public.battle_token_uses enable row level security;

-- 오래된 기록 정리용 인덱스 (토큰 수명 15분 — 하루 지난 행은 지워도 무방)
create index if not exists battle_token_uses_used_at_idx on public.battle_token_uses (used_at);

-- ─────────────────────────────────────────────
-- 롤백 (원복 시 아래 실행 — 코드는 자동으로 기존 '검증만' 동작으로 폴백)
-- drop table if exists public.battle_token_uses;
-- ─────────────────────────────────────────────
