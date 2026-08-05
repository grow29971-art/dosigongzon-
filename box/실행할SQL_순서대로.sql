-- ============================================================
--  도시공존 — 지금 실행할 SQL (2026-08-04 회의 확정)
--  실행 위치: Supabase Dashboard → SQL Editor → New query
--
--  ▶ 사용법: 아래 [1번] [2번] [3번] 블록을 하나씩 복사해서 붙여넣고 Run.
--            한 번에 다 붙이지 말고 번호 순서대로, 하나씩 하세요.
--            각 번호 끝에 "확인" 쿼리가 있습니다. 그것까지 돌리고 다음으로.
--            문제가 생기면 그 번호의 "되돌리기"만 실행하면 원상복구됩니다.
--
--  총 소요: 약 40분
-- ============================================================




-- ############################################################
-- ##  1번 — cat-photos 익명 목록조회 차단   (제일 중요, 지금 새는 중)
-- ############################################################
--
--  왜: 지금 익명 키만 있으면 유저 폴더 80개와 파일명·업로드 시각·용량이
--      통째로 열거됩니다. "누가 언제 몇 장 올렸는가"가 공개된 상태입니다.
--
--  주의: 버킷을 private으로 바꾸는 게 아닙니다. 목록조회(list)만 막고
--        공개 사진 URL 직접 접근은 그대로 둡니다. 지도 사진 안 깨집니다.

drop policy if exists "cat_photos_read_public" on storage.objects;

create policy "cat_photos_read_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'cat-photos');


-- ── 1번 확인 ──────────────────────────────────────────────
-- 아래를 돌려서 cat_photos_read_authenticated 한 줄만 나오면 성공.
select polname from pg_policy
 where polrelid = 'storage.objects'::regclass
   and polname like 'cat_photos%';

-- ★ 그리고 반드시: 브라우저 시크릿창에서 dosigongzon.com 지도를 열어
--   고양이 사진이 여전히 보이는지 눈으로 확인하세요.
--   안 보이면 아래 "1번 되돌리기"를 즉시 실행.


-- ── 1번 되돌리기 (문제 생겼을 때만) ───────────────────────
-- drop policy if exists "cat_photos_read_authenticated" on storage.objects;
-- create policy "cat_photos_read_public" on storage.objects for select using (bucket_id = 'cat-photos');




-- ############################################################
-- ##  2번 — 탈퇴해도 주문·결제·환불 기록은 남기기
-- ############################################################
--
--  왜: 지금은 회원 탈퇴 버튼 한 번에 그 사람의 주문·주문상품·환불 기록이
--      통째로 사라집니다. 전자상거래법상 대금결제 기록은 5년 보관해야 하고,
--      우리 개인정보처리방침에도 "5년 보관"이라고 적혀 있습니다.
--
--  타이밍: 지금은 실주문이 0건이라 아무 손실 없이 바꿀 수 있습니다.
--          결제를 켠 뒤에는 이미 지워진 기록을 되살릴 수 없습니다.

--  ⚠ Supabase SQL Editor는 실행을 자체 트랜잭션으로 감싼다. begin/commit을 직접 쓰거나
--    한 문장을 여러 줄로 나누면 파서가 끊어 읽어 42601(syntax error near "add")이 난다.
--    → 아래처럼 문장당 한 줄로 둘 것.

-- (1) 탈퇴 시점 기록용 컬럼
alter table public.orders add column if not exists user_deleted_at timestamptz;

-- (2) "주인 없는 주문 금지" 제약에 탈퇴 예외 추가
--     (이걸 안 하면 (3)번 때문에 탈퇴 자체가 실패합니다)
alter table public.orders drop constraint if exists orders_owner_check;
alter table public.orders add constraint orders_owner_check check (user_id is not null or guest_token is not null or user_deleted_at is not null);

-- (3) 탈퇴 시 주문을 지우지 말고 연결만 끊기 (CASCADE → SET NULL)
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders add constraint orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- (4) 컬럼 설명 (선택 — 실패해도 무방)
comment on column public.orders.user_deleted_at is '회원 탈퇴로 user_id 연결이 끊긴 시점. 법정 보존기간 만료 파기의 기준.';


-- ── 2번 확인 ──────────────────────────────────────────────
-- ⓐ 아래가 'n' 을 반환하면 성공 ('n' = SET NULL, 'c' = 예전 CASCADE)
select confdeltype from pg_constraint where conrelid = 'public.orders'::regclass and conname = 'orders_user_id_fkey';

-- ⓑ 아래가 한 줄 나오면 성공
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name = 'user_deleted_at';


-- ── 2번 되돌리기 (문제 생겼을 때만) ───────────────────────
-- alter table public.orders drop constraint if exists orders_user_id_fkey;
-- alter table public.orders add constraint orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
-- alter table public.orders drop constraint if exists orders_owner_check;
-- alter table public.orders add constraint orders_owner_check check (user_id is not null or guest_token is not null);
-- alter table public.orders drop column if exists user_deleted_at;




-- ############################################################
-- ##  3번 — 집회 참여하기 버튼 살리기   (8/8 보신각 / 안 가시면 건너뛰기)
-- ############################################################
--
--  왜: 홈에 집회 포스터 배너는 떠 있는데, 이 테이블이 없어서
--      "참여하기" 버튼이 아예 화면에 안 나오고 있습니다.
--      참여 의사 인원을 세려면 필요합니다.
--
--  설계: 일반 유저는 1인 1회. 관리자는 중복 클릭 허용(현장 접수용).
--        전체 명단은 비공개, 총 인원수만 공개.

create table if not exists public.rally_participations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 관리자 부스트 행: 일반 유저는 항상 false, true는 admins 등재자만 (RLS로 강제)
  admin_extra boolean not null default false,
  created_at timestamptz not null default now()
);

-- 일반 참여는 유저당 1회 — admin_extra=true 행은 제한 없음
create unique index if not exists rally_participations_one_per_user
  on public.rally_participations (user_id)
  where admin_extra = false;

alter table public.rally_participations enable row level security;

-- INSERT: 본인 행만 + 정지 유저 차단 + admin_extra=true는 관리자만
drop policy if exists "rally_insert_own" on public.rally_participations;
create policy "rally_insert_own"
  on public.rally_participations for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_user_not_suspended(auth.uid())
    and (
      admin_extra = false
      or exists (select 1 from public.admins a where a.user_id = auth.uid())
    )
  );

-- SELECT: 본인 행만 (참여 여부 확인용) — 전체 명단은 비공개
drop policy if exists "rally_select_own" on public.rally_participations;
create policy "rally_select_own"
  on public.rally_participations for select to authenticated
  using (user_id = auth.uid());

-- UPDATE/DELETE 정책 없음 = 불가 (참여 취소 기능 없음)

-- 카운트 RPC — 익명 포함 모두에게 총 참여 수만 노출
create or replace function public.rally_participation_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint from public.rally_participations;
$$;

grant execute on function public.rally_participation_count() to anon, authenticated;


-- ── 3번 확인 ──────────────────────────────────────────────
-- 아래가 0 을 반환하면 성공 (아직 아무도 안 눌렀으니 0이 정상)
select public.rally_participation_count();


-- ── 3번 되돌리기 (집회 끝나고 정리할 때) ──────────────────
-- drop function if exists public.rally_participation_count();
-- drop table if exists public.rally_participations;




-- ============================================================
--  이번에는 실행하지 않는 것들 (회의에서 뺀 이유)
-- ============================================================
--
--  · 경제성 RPC 권한 회수      → 익명으로 확인해보니 이미 잠겨 있음. 돌리면 헛수고
--  · daily_stats 익명조회 차단 → 방문 통계라 보안 문제가 아님. 오히려 공개해도 되는 자료
--  · default privileges 잠금   → 문제됐던 뷰 2개는 8/2에 이미 처리됨.
--                                 다음에 새 뷰 만들 때 같이 하면 충분
--  · get_guest_order 축소      → 결제 열 때 같이. 지금은 주문이 0건이라 의미 없음
--  · 레이트리밋 DB 전환        → 결제 열 때 같이
-- ============================================================
