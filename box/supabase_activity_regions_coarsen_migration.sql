-- ══════════════════════════════════════════
-- 🧹 활동지역 과거 좌표 코어스닝 (선택, 2026-08-02)
-- 실행 위치: Supabase Dashboard → SQL Editor
--
-- 배경: 2026-08-02 이전 "내 위치" 버튼은 GPS 실좌표를 그대로 user_activity_regions에
-- 저장했다 (무신고 구성 위반 소지). 코드는 이제 행정동 중심으로 스냅하지만,
-- 과거 행에는 GPS 유래 좌표가 남아있을 수 있고 지도 선택 유래와 구분이 불가하다.
-- → 전체를 0.005° (~550m) 격자로 반올림해 개인 위치 식별 불가 수준으로 뭉갠다.
--   반경 프리셋이 500m~5km라 동네 필터 기능엔 영향 미미.
--
-- ⚠️ 비가역 — 실행 전 백업 SELECT 결과를 보관할 것.
-- ══════════════════════════════════════════

-- 0) 백업 (결과를 CSV로 저장해두기)
select user_id, slot, name, lat, lng, radius_m from public.user_activity_regions;

-- 1) 코어스닝
update public.user_activity_regions
set lat = round((lat / 0.005)::numeric, 0) * 0.005,
    lng = round((lng / 0.005)::numeric, 0) * 0.005;

-- 검증: 소수 3자리 이하로만 남는지
-- select lat, lng from public.user_activity_regions limit 10;

-- ── ROLLBACK ──
-- 좌표 반올림은 비가역. 되돌리려면 0)에서 보관한 백업으로 수동 UPDATE.
