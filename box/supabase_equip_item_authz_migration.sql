-- ══════════════════════════════════════════
-- 🔴 보안: equip_item_atomic 권한 회수 (IDOR 차단) — 2026-07-16
-- 문제: equip_item_atomic(p_user_id, p_cat_id, p_slot, p_item_key)이 SECURITY DEFINER +
--       authenticated에 EXECUTE 부여 상태인데, 내부에서 p_user_id를 auth.uid()와 대조하지 않음.
--       (소유권 검사가 v_caretaker_id <> p_user_id 뿐 — 둘 다 공격자 입력)
--       → 로그인 유저가 REST로 POST /rest/v1/rpc/equip_item_atomic 에 피해자 p_user_id·p_cat_id를
--         넣어 타인 장비 강제 해제/재장착·인벤토리 재고 차감(그리핑) 가능.
-- 원인: 앱의 정상 경로(app/api/cats/equip-item/route.ts)는 service_role 클라이언트로 호출하므로
--       authenticated 권한이 필요 없음. authenticated에 열려 있는 것 자체가 구멍.
-- 해결: buy_shop_item_atomic 감사(security_audit_20260716_2)와 동일 패턴 — authenticated 권한 회수,
--       service_role만 실행 가능하게. 서버 API는 그대로 동작(무영향).
-- 실행 위치: Supabase Dashboard → SQL Editor (⚠ Chrome 번역 OFF)
-- ══════════════════════════════════════════

revoke execute on function public.equip_item_atomic(uuid, uuid, text, text) from authenticated;
revoke execute on function public.equip_item_atomic(uuid, uuid, text, text) from anon;

-- service_role은 명시적으로 부여(기본 소유자 권한 외 보강 — 이미 있으면 no-op)
grant execute on function public.equip_item_atomic(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';

-- 검증(실행 후): 일반 유저 JWT + anon 키로
--   POST /rest/v1/rpc/equip_item_atomic {p_user_id, p_cat_id, p_slot, p_item_key}
--   → 401/403 (permission denied for function equip_item_atomic)
--   앱 내 장착/해제(서버 라우트 경유)는 정상 동작.

-- ── 롤백 (권한 원복 — 권장 안 함, IDOR 재개방) ──
-- grant execute on function public.equip_item_atomic(uuid, uuid, text, text) to authenticated;
