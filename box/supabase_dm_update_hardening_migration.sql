-- ══════════════════════════════════════════
-- 🟡 direct_messages UPDATE 하드닝 (2026-07-24)
-- 문제(7/23 팬테스트 LOW): dm_update_read 정책이 `using`만 있고 `with check`가 없어
--   수신자가 받은 메시지를 UPDATE하며 body·sender_name을 변조 가능(발신자 발언 위조).
--   앱은 is_read=true만 쓰지만, REST로 같은 행에 body 변조 UPDATE를 직접 칠 수 있음.
-- 해결: ① with check로 receiver_id 유지 강제 + ② 컬럼 레벨 UPDATE 권한으로
--   수신자가 '읽음 관련 컬럼(is_read, read_at)'만 바꾸도록 근본 차단.
--   (RLS with_check는 행 단위라 컬럼 위조는 못 막음 → 컬럼 grant가 진짜 방어.)
-- service_role(서버/cron)은 권한 무관하게 계속 전체 UPDATE 가능.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

-- 1) 정책에 with check 추가 (receiver_id를 남의 것으로 바꾸는 UPDATE 차단)
drop policy if exists "dm_update_read" on public.direct_messages;
create policy "dm_update_read"
  on public.direct_messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- 2) 컬럼 레벨 UPDATE 권한 — 읽음 처리 컬럼만 허용 (body/발신자 위조 근본 차단)
revoke update on public.direct_messages from authenticated;
grant update (is_read, read_at) on public.direct_messages to authenticated;

notify pgrst, 'reload schema';

-- 검증(실행 후):
--   수신자 JWT로 PATCH /rest/v1/direct_messages?id=eq.<내가받은메시지> body={"is_read":true} → 200
--   수신자 JWT로 PATCH ... body={"body":"위조"} → 403 (컬럼 권한 없음)

-- ── ROLLBACK (되돌리기) ──
-- revoke update (is_read, read_at) on public.direct_messages from authenticated;
-- grant update on public.direct_messages to authenticated;
-- drop policy if exists "dm_update_read" on public.direct_messages;
-- create policy "dm_update_read"
--   on public.direct_messages for update
--   using (auth.uid() = receiver_id);
-- notify pgrst, 'reload schema';
