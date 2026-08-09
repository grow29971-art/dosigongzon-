-- ══════════════════════════════════════════
-- funnel_events 유입 출처(source) 컬럼 — 2026-08-09
--
-- 왜:
--   인스타그램에 월 10만원을 쓰고 있는데 그 돈이 뭘 샀는지 알 수 없다.
--   클라이언트 Meta 픽셀은 쿠키 동의 후에만 로드되고(ConsentManager.tsx:87),
--   그 유실을 복구할 서버 CAPI 는 META_PIXEL_ACCESS_TOKEN 미설정으로 silent skip 중이다.
--   그리고 픽셀이 살아나도 그건 "메타가 보는 숫자"이지 우리 퍼널이 아니다.
--   당근·네이버카페·오프라인을 추가하면 어느 채널이 움직였는지 가를 방법이 전혀 없다.
--
--   실물 고양이 109마리가 50개 넘는 동에 흩어져 있어(한 동 최대 9마리) 전국 대상 광고는
--   빈 지도로 사람을 보낸다. 채널·지역을 좁혀야 하는데, 좁히려면 먼저 재야 한다.
--
-- 설계:
--   기존 6개 스텝의 발화 지점·조건을 일절 건드리지 않는 **순수 가산** 변경이다.
--   nullable 컬럼 하나만 늘리므로 기존 행과 8/18 판정 집계는 그대로다.
--   first-touch 귀속 — 처음 들어온 경로를 끝까지 유지한다(가입은 며칠 뒤에 일어난다).
--
-- ⚠ 이 SQL 실행 전에는 source 가 그냥 무시된다(컬럼이 없으면 upsert 가 통째로 실패하므로
--    코드는 컬럼 유무와 무관하게 동작하도록 서버에서 조건부로 넣는다 — route.ts 참고).
--
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ══════════════════════════════════════════

alter table public.funnel_events add column if not exists source text;

comment on column public.funnel_events.source is
  '유입 출처(first-touch). utm_source 우선, 없으면 referrer 호스트에서 유추. 소문자 [a-z0-9_.-] 32자 이내.';

create index if not exists funnel_events_source_idx on public.funnel_events(source) where source is not null;

-- ── 검증 ──
-- select source, step, count(*) from public.funnel_events
--   group by source, step order by count(*) desc;
--
-- 채널별 퍼널 (이게 목적이다):
-- select source,
--        count(*) filter (where step='onboarding_intro')      as intro,
--        count(*) filter (where step='cat_detail_view_anon')  as detail,
--        count(*) filter (where step='onboarding_pick')       as pick,
--        count(*) filter (where step='signup_view')           as signup_view,
--        count(*) filter (where step='signup_home')           as signup,
--        count(*) filter (where step='first_feed')            as first_feed
--   from public.funnel_events group by source order by intro desc;

-- ── 롤백 ──
-- drop index if exists funnel_events_source_idx;
-- alter table public.funnel_events drop column if exists source;
