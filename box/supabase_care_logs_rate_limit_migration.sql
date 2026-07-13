-- ══════════════════════════════════════════
-- 돌봄 기록 도배 방지 — DB 레벨 하드 제한 (2026-07-13)
-- 배경: 포인트(현금성 할인) 도입으로 돌봄/출석 체계가 공격 표면이 됨.
--       클라이언트 rate limit(분당 8/일 120)은 직접 REST 호출로 우회 가능하므로
--       DB 트리거로 최종 방어선 구축. 랭킹/레벨/카드등급 오염 차단 목적.
-- 정책: 사용자당 1분 12건 / 하루(KST) 150건 초과 시 거부.
--       service_role(출석체크 자동 기록 등, auth.uid()가 null)은 면제.
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════

create or replace function public.care_logs_rate_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_minute_count integer;
  v_day_count integer;
begin
  -- service_role 경유(서버 자동 기록)는 면제 — auth.uid()가 null
  if auth.uid() is null then
    return new;
  end if;
  -- 본인 명의가 아닌 author_id 위조 차단 (RLS와 이중 방어)
  if new.author_id is distinct from auth.uid() then
    raise exception '본인 명의로만 기록할 수 있어요';
  end if;

  select count(*) into v_minute_count
    from care_logs
   where author_id = new.author_id
     and created_at > now() - interval '1 minute';
  if v_minute_count >= 12 then
    raise exception '돌봄 기록이 너무 잦아요. 잠시 후 다시 시도해주세요';
  end if;

  select count(*) into v_day_count
    from care_logs
   where author_id = new.author_id
     and created_at > (now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul';
  if v_day_count >= 150 then
    raise exception '오늘의 돌봄 기록 한도에 도달했어요. 내일 다시 기록해주세요';
  end if;

  return new;
end $$;

drop trigger if exists care_logs_rate_guard_trg on public.care_logs;
create trigger care_logs_rate_guard_trg
  before insert on public.care_logs
  for each row execute function public.care_logs_rate_guard();

-- ── 롤백 ──
-- drop trigger if exists care_logs_rate_guard_trg on public.care_logs;
-- drop function if exists public.care_logs_rate_guard();
