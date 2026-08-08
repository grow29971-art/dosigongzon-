-- ══════════════════════════════════════════
-- 고양이별 테스트 데이터 정리 — 2026-08-08
--
-- 배경: 고양이별(추모) 기능 배포 당일 테스트로 3마리가 고양이별로 넘어갔다.
--       셋 다 care_logs·댓글·좋아요 0. 지도에서 내려가 있는 상태였다.
--
-- 판단: 소유 계정이 갈렸다.
--   · ㅁㄴㅇㄹ  (fc7159ef…) — 나는야운영자(관리자 본인). 당일 10:11 등록 → 12:20 발송.
--                             명백한 테스트라 삭제.
--   · ㅇㅇ ×2  (27188604…, ac7ea9b7…) — 포근한봉사자356(7/5 가입, 관리자 아님).
--                             본인 계정이 아니므로 삭제하지 않고 지도로 되돌린다.
--                             (사장님 판단 2026-08-08)
--
-- ⚠ 실행 이력: 2026-08-08 service_role REST 로 실행 완료. 이 파일은 감사 기록용.
--   삭제는 되돌릴 수 없으므로 대상 id 를 본문에 박아둔다.
--
-- ⚠ 알려진 잔재: restoreCatFromStar(지도로 되돌리기)는 memorial_flowers 를 지우지 않는다.
--   RLS 상 헌화 삭제는 헌화한 본인만 가능해서 클라이언트에서 남의 헌화를 정리할 수 없다.
--   되돌린 뒤 다시 고양이별로 보내면 예전 헌화 수가 되살아난다. 여기서는 서비스키로
--   같이 지웠다. 실사용에서 문제가 되면 "등록자는 memorial_at 이 null 인 자기 고양이의
--   헌화를 삭제할 수 있다" 정책을 추가하는 게 정석이다.
-- ══════════════════════════════════════════

-- 1) 관리자 본인 테스트 고양이 삭제 (memorial_flowers·care_logs 등은 CASCADE)
delete from public.cats where id = 'fc7159ef-ed60-4b99-b976-6c7a03befb00';

-- 2) 타 계정 고양이 2마리는 지도로 복귀
update public.cats set memorial_at = null, memorial_note = null, memorial_by = null
 where id in ('27188604-b517-423e-959d-1615337dac73', 'ac7ea9b7-e4e5-421a-aca6-53142aa01bff');

-- 3) 복귀한 아이들에게 남은 테스트 헌화 제거
delete from public.memorial_flowers
 where cat_id in ('27188604-b517-423e-959d-1615337dac73', 'ac7ea9b7-e4e5-421a-aca6-53142aa01bff');

-- ── 검증 ──
-- select count(*) from public.cats where memorial_at is not null;  -- 0 기대
-- select count(*) from public.memorial_flowers;                    -- 0 기대
-- select count(*) from public.cats;                                -- 삭제 전 246 → 245 기대

-- ── 롤백 ──
-- 2)3)은 되돌릴 수 있으나 1)의 삭제는 복구 불가(백업 복원 외 방법 없음).
-- update public.cats set memorial_at = now() where id in ('27188604-…', 'ac7ea9b7-…');
