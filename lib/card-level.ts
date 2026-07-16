// ══════════════════════════════════════════
// 카드(고양이) EXP → 레벨 커브 (Lv1~10) — 순수 모듈, React/DB import 금지.
// ⚠️ DB의 compute_cat_card_level(supabase_security_audit_20260716_2_migration.sql)과
//    반드시 동일 임계값을 유지할 것. 예전엔 care/checkin/battle 4곳에 복붙돼 있어
//    한 곳만 바꾸면 케어 레벨과 전투 레벨이 갈라지는 드리프트 위험이 있었음 → 단일화.
// (주의: lib/cats-repo.ts의 computeLevel은 '계정 레벨'로 이것과 완전히 별개다.)
// ══════════════════════════════════════════

export const CARD_LEVEL_THRESHOLDS = [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800];

/** 누적 카드 EXP → 레벨(1~10). */
export function cardLevelFromExp(exp: number): number {
  for (let i = CARD_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= CARD_LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}
