-- 도시공존 — cats SELECT 정책 재확인/재적용 (안전, 재실행해도 무해)
--
-- 배경: "개인만보기로 등록한 내 고양이가 지도에 안 보인다"는 문의로 점검한 결과,
-- 이 프로젝트 히스토리에 cats SELECT 정책이 여러 마이그레이션(circle_migration →
-- visibility_hidden_fix → security_hotfix_20260519 → auto_hide_reported_migration)을
-- 거치며 서로 다른 버전의 "cats_read_public" / "cats_read_by_visibility" 정책이
-- 중복 생성될 위험이 있었던 게 확인됨(security_hotfix_20260519.sql의 FIX 3 코멘트 참고).
-- 지금 당장 문제를 일으키는지는 대시보드에서 직접 확인 못 했지만(SQL Editor 접근 권한 없음),
-- 안전하게 "최종적으로 맞는 상태"를 다시 못박아두는 용도로 이 파일을 한 번 더 실행해줘.
--
-- 최종적으로 살아있어야 하는 cats SELECT 정책 2개:
--   1) cats_read_by_visibility — hidden=false 이면서 (public이거나 / 본인 고양이이거나 / circle 멤버인 circle 고양이)
--   2) cats_read_own_even_hidden — 본인 고양이는 hidden 여부와 무관하게 항상 보임
-- "cats_read_public"이라는 이름의 정책이 남아있으면(hidden=false만 체크, visibility 무시)
-- private/circle 고양이가 전체 공개되는 개인정보 노출 위험이 있으므로 반드시 제거한다.

drop policy if exists "cats_read_public" on public.cats;

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

drop policy if exists "cats_read_own_even_hidden" on public.cats;
create policy "cats_read_own_even_hidden"
  on public.cats
  for select
  using (auth.uid() = caretaker_id);

notify pgrst, 'reload schema';
