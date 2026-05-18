-- ══════════════════════════════════════════
-- 도시공존 — cats visibility 정책에 hidden 필터 복원
-- 원인: Private Circle 마이그레이션이 cats_read_public(hidden=false 체크 포함)을
--       cats_read_by_visibility로 교체하면서 hidden 필터가 누락됨.
--       → 신고 3건 누적 자동 숨김 정책이 cats에 대해 작동 안 함.
-- 해결: cats_read_by_visibility에 hidden=false 조건 AND 추가.
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: supabase_circle_recursion_fix.sql, supabase_auto_hide_reported_migration.sql
-- ══════════════════════════════════════════

drop policy if exists "cats_read_by_visibility" on public.cats;

create policy "cats_read_by_visibility"
  on public.cats
  for select
  using (
    hidden = false
    and (
      visibility = 'public'
      or auth.uid() = caretaker_id
      or (
        visibility = 'circle'
        and public.is_circle_member_of(caretaker_id)
      )
    )
  );

-- 본인 등록 핀은 hidden 상태여도 본인은 볼 수 있게 별도 정책 추가
-- (본인이 신고된 본인 핀의 상태를 확인하고 수정·삭제할 수 있어야 함)
drop policy if exists "cats_read_own_even_hidden" on public.cats;
create policy "cats_read_own_even_hidden"
  on public.cats
  for select
  using (auth.uid() = caretaker_id);

-- admin은 모든 cats (숨김 포함) 조회 가능 — 기존 cats_read_admin 정책 유지
-- (auto_hide_reported_migration.sql에서 이미 생성됨, 영향 없음)

notify pgrst, 'reload schema';
