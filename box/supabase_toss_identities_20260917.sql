-- ══════════════════════════════════════════════════════════════
-- 앱인토스 토스 로그인 계정 매핑 테이블 — toss_identities (2026-09-17)
-- 실행 위치: Supabase Dashboard → SQL Editor  ⚠ Chrome 번역 OFF
-- 선행: 없음 (auth.users만 참조)
-- ══════════════════════════════════════════════════════════════
--
-- [배경]
--   앱인토스 미니앱(city-toss/)은 토스 로그인만 허용된다(자사 로그인 금지, 체크리스트).
--   /api/toss/login 브릿지가 토스 userKey로 Supabase 유저를 찾거나 만들고 magiclink token_hash로
--   세션을 준다. userKey ↔ auth.users.id 매핑이 이 테이블이다. 토스 쪽 개인정보(실명·전화·CI)는
--   저장하지 않는다 — userKey(토스 내부 식별 번호)만 둔다.
--
-- [접근 정책]
--   service_role(브릿지 라우트) 전용. RLS 켜고 4종 정책은 전부 "본인 행 SELECT만" 수준으로 닫는다 —
--   로그인 유저가 자기 매핑 존재 여부를 읽는 것 외엔 anon·authenticated 모두 불가.
--   service_role은 RLS를 우회하므로 정책이 필요 없다.
--
-- [검증] 실행 후:
--   1) anon 키로 GET /rest/v1/toss_identities?select=* → [] (0행, 200)
--   2) select count(*) from public.toss_identities;  -- 0
--   3) 미니앱 QR 테스트로 토스 로그인 1회 → 1행 생성, auth.users에 toss-<userKey>@toss.dosigongzon.com 1명
-- ══════════════════════════════════════════════════════════════

create table if not exists public.toss_identities (
  user_key   text primary key,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.toss_identities is
  '앱인토스 토스 로그인 userKey ↔ auth.users 매핑. 브릿지(/api/toss/login, service_role) 전용. 개인정보 없음.';

alter table public.toss_identities enable row level security;

drop policy if exists toss_identities_select_own on public.toss_identities;
create policy toss_identities_select_own on public.toss_identities
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists toss_identities_insert_none on public.toss_identities;
create policy toss_identities_insert_none on public.toss_identities
  for insert to authenticated
  with check (false);

drop policy if exists toss_identities_update_none on public.toss_identities;
create policy toss_identities_update_none on public.toss_identities
  for update to authenticated
  using (false);

drop policy if exists toss_identities_delete_none on public.toss_identities;
create policy toss_identities_delete_none on public.toss_identities
  for delete to authenticated
  using (false);

-- anon은 정책이 없으므로 기본 거부. 컬럼 권한도 회수해 REST 노출 0을 보장한다.
revoke all on public.toss_identities from anon;
grant select on public.toss_identities to authenticated;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════
-- 롤백 (되돌릴 때만):
--   drop table if exists public.toss_identities;
--   -- 생성된 토스 계정(auth.users email like 'toss-%@toss.dosigongzon.com')은 Dashboard에서 개별 삭제.
-- ══════════════════════════════════════════════════════════════
-- 끝.
