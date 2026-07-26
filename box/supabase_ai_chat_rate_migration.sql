-- ══════════════════════════════════════════
-- AI 집사 채팅 분산 Rate Limit (2026-07-26 보안 강화 — 운영 적용 대기)
-- 배경: app/api/chat 의 rate limit이 모듈-스코프 Map(인메모리)이라 Vercel 다중
--   인스턴스에서 인스턴스별로 카운트 → 실효 한도 = 설정값 × 인스턴스 수, 콜드스타트
--   리셋. Gemini 호출 비용 어뷰징 표면. Postgres 단일 소스로 인스턴스 무관 고정 한도.
-- 설계: 유저 1행 고정창(fixed-window) 카운터. RPC가 원자적으로 창 리셋/증가/거부 판정.
--   쓰기는 service_role만(서버 라우트 경유) — 클라이언트 직접 호출 차단.
-- 실행 위치: Supabase Dashboard → SQL Editor (idempotent — 재실행 안전)
-- 선행: auth.users 존재
-- ══════════════════════════════════════════

create table if not exists public.ai_chat_rate (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

alter table public.ai_chat_rate enable row level security;
-- 정책 없음 = 클라이언트 기본 거부. service_role은 RLS 우회(서버 전용).

-- 원자적 판정 RPC — 반환: {allowed, retry_after, remaining}
create or replace function public.check_ai_chat_rate(
  p_user_id uuid,
  p_limit int,
  p_window_seconds int default 60
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now         timestamptz := now();
  v_window_end  timestamptz;
  v_row         public.ai_chat_rate;
begin
  -- 행 없으면 생성(첫 요청). 있으면 잠금.
  insert into public.ai_chat_rate (user_id, window_start, count)
    values (p_user_id, v_now, 0)
    on conflict (user_id) do nothing;

  select * into v_row from public.ai_chat_rate where user_id = p_user_id for update;

  v_window_end := v_row.window_start + make_interval(secs => p_window_seconds);

  -- 창 만료 → 리셋하고 이번 요청 허용
  if v_now >= v_window_end then
    update public.ai_chat_rate
      set window_start = v_now, count = 1
      where user_id = p_user_id;
    return jsonb_build_object('allowed', true, 'remaining', greatest(p_limit - 1, 0));
  end if;

  -- 창 내 한도 초과 → 거부
  if v_row.count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(ceil(extract(epoch from (v_window_end - v_now)))::int, 1)
    );
  end if;

  -- 창 내 여유 → 증가하고 허용
  update public.ai_chat_rate set count = count + 1 where user_id = p_user_id;
  return jsonb_build_object('allowed', true, 'remaining', greatest(p_limit - v_row.count - 1, 0));
end $$;

-- 클라이언트 직접 호출 차단 — 서버 라우트(service_role)만
revoke all on function public.check_ai_chat_rate(uuid, int, int) from public, anon, authenticated;
grant execute on function public.check_ai_chat_rate(uuid, int, int) to service_role;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════
-- ROLLBACK (되돌리기)
-- ------------------------------------------------------------
-- drop function if exists public.check_ai_chat_rate(uuid, int, int);
-- drop table if exists public.ai_chat_rate cascade;
-- ══════════════════════════════════════════
