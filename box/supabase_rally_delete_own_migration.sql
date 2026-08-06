-- ══════════════════════════════════════════
-- 집회 참여 철회(취소) 허용 (2026-08-06)
--
-- 왜: rally_participations에 DELETE 정책이 없어 한 번 참여하면 스스로 지울 수 없었다.
--     집회 참여 이력은 정치적 견해로 해석될 여지가 있는 정보라, 본인이 언제든
--     철회할 수 있어야 한다. 처리방침 고지와 함께 짝을 이루는 조치다.
--
-- 범위: 본인 행 + 일반 참여(admin_extra=false)만. 관리자 부스트 행은 건드리지 않는다.
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- 선행: box/supabase_rally_participation_migration.sql
-- ══════════════════════════════════════════

drop policy if exists "rally_delete_own" on public.rally_participations;
create policy "rally_delete_own" on public.rally_participations for delete to authenticated using (user_id = auth.uid() and admin_extra = false);


-- ── 확인 (실행 후) ──
-- 정책이 4개(select/insert/delete + 기존) 나오면 성공
select polname from pg_policy where polrelid = 'public.rally_participations'::regclass;


-- ══════════════════════════════════════════
-- 집회 종료 후 파기 (8/9 이후 실행 — 고지한 보유기간대로)
-- ══════════════════════════════════════════
-- delete from public.rally_participations;


-- ══════════════════════════════════════════
-- 롤백
-- ══════════════════════════════════════════
-- drop policy if exists "rally_delete_own" on public.rally_participations;
