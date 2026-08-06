-- ══════════════════════════════════════════
-- 방송 전 조치 — 더미 커뮤니티 글 중 "사람을 속이는 것"만 숨김 (2026-08-06)
--
-- 배경: `author_id`가 NULL인 시드 게시글이 58건 있다. 커뮤니티가 비어 보이지 않게
--       넣어둔 것이고, 그 목적 자체는 유효하다. 그런데 그중 34건은 성격이 다르다.
--
--   · adoption 11 / foster 13 — 가짜 입양·임보 공고. 작성자가 없어 연락이 닿지 않는다.
--       방송을 보고 입양하려는 사람이 문의하면 즉시 드러나고, 그걸 발견하는 건
--       기자가 아니라 선의의 시청자다. 길고양이 커뮤니티에서 신뢰는 유일한 통화라
--       "가짜 입양글"이 한 번 붙으면 후원·제휴 파트너까지 함께 탄다.
--   · emergency 10 — 가짜 학대·긴급 제보. 본문에 실제 건물명·지역명이 들어 있다
--       (예: "부평동 우성빌라 뒷골목", "구월동 놀이터 뒤"). 이건 지표 정직성 문제가
--       아니라 특정 장소를 지목한 허위사실 적시다.
--
--   · market 14 / free 10 — 그대로 둔다. 중고거래·잡담은 누구를 속이지도, 특정
--       장소를 지목하지도 않는다. 커뮤니티 공백 방지라는 원래 목적에 맞는다.
--
-- 방식: 삭제가 아니라 hidden = true. 되돌리기 한 줄이고 데이터는 남는다.
-- 배포 불필요: 코드 변경 0, SQL만.
--
-- ⚠ 실행 시점 주의: 방송·집회 24시간 이내에는 하지 말 것.
--    글이 빠지면서 내 동네 필터·HOT 게시글·프로필 활동 목록이 예상 밖으로 비어 보일 수
--    있다. 실행 후 최소 하루는 눈으로 확인할 시간을 두고 돌린다.
-- ══════════════════════════════════════════

-- [실행 전 확인] 대상이 몇 건인지 (34건 근처여야 정상)
select category, count(*) as cnt
  from public.posts
 where author_id is null
   and hidden = false
   and category in ('adoption', 'foster', 'emergency')
 group by category
 order by category;


-- [조치] 숨김 처리
update public.posts
   set hidden = true
 where author_id is null
   and hidden = false
   and category in ('adoption', 'foster', 'emergency');


-- [확인] 위 쿼리를 다시 돌리면 0행이어야 한다.
-- 남아 있는 더미(market·free)는 그대로인지도 함께 확인:
-- select category, count(*) from public.posts
--  where author_id is null and hidden = false group by category;
--   → market 14, free 10 만 남으면 정상


-- ══════════════════════════════════════════
-- 롤백
-- ══════════════════════════════════════════
-- update public.posts
--    set hidden = false
--  where author_id is null
--    and category in ('adoption', 'foster', 'emergency');
