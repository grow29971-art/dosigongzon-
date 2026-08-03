// 실체화 도감 — 실제 고양이 사진으로 가상 종(18종)의 도감이 "실체화"(내 실사진으로 진화)된다.
//
// 경로 2가지:
//  1) matchSpeciesFromFeatures — 구 클라이언트 호환: 무늬/털색 자가신고를 종에 매칭.
//     (2026-07-13 형질 픽커 제거로 새 클라이언트는 이 경로를 타지 않는다)
//  2) pickMaterializableByRarity — 현행: 완벽 포획 성공 시 카드 등급과 같은 등급의
//     미실체화 종 하나를 결정적으로 골라 실체화. "잘 잡은 순간"의 보상으로 재배치.
//
// 판타지 종(황금냥/설산냥/밤하늘냥)과 사진 판별 불가 종(민털냥/숏다리냥/동그리꼬리냥)은
// 의도적으로 실체화 불가 목록에서 제외.

import type { CatFeatures } from "@/lib/cat-grade-rules"; // 냥줍과 동일 계보 — city 기존 모듈 재사용 (2026-08-04 catch 이식)
import { SPECIES_BY_KEY } from "@/lib/catch/spawn-species";

export const MATERIALIZABLE_KEYS = [
  "calico", "tortie", "oddeye", "siamese", "tuxedo",
  "cheese", "mackerel", "graytabby", "norwegian",
  "allblack", "allwhite", "russianblue",
] as const;

/** 완벽 포획 보상 실체화 — 미실체화 종 중 카드 등급과 같은 등급 우선, 없으면 아무거나.
 *  cardId 해시로 결정적 선택(재시도해도 같은 결과). 전부 실체화됐으면 null. */
export function pickMaterializableByRarity(
  rarity: string, taken: Record<string, string>, seed: string,
): string | null {
  const cands = MATERIALIZABLE_KEYS.filter(k => !taken[k]);
  if (cands.length === 0) return null;
  const same = cands.filter(k => SPECIES_BY_KEY[k]?.rarity === rarity);
  const pool = same.length > 0 ? same : cands;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

export function matchSpeciesFromFeatures(features: Partial<CatFeatures> | null | undefined): string | null {
  if (!features?.pattern) return null;
  const pattern = features.pattern;
  const colors = new Set(features.colors ?? []);
  const traits = new Set(features.traits ?? []);
  const has = (c: string) => colors.has(c);

  // 1) 무늬 자체가 종을 결정하는 경우
  if (pattern === "calico") return "calico";
  if (pattern === "tortoiseshell" || pattern === "torbie") return "tortie";
  if (traits.has("odd_eye")) return "oddeye";
  if (pattern === "colorpoint") return "siamese";
  if (pattern === "tuxedo") return "tuxedo";

  // 2) 줄무늬(tabby) — 색으로 세분
  if (pattern === "tabby") {
    if (has("orange") || has("cream")) return "cheese";
    if (has("gray") && has("black")) return "mackerel";
    if (has("gray")) return "graytabby";
    if (has("brown")) return "norwegian";
    return "mackerel"; // 색 불명확한 줄무늬 기본값
  }

  // 3) 단색(solid)
  if (pattern === "solid") {
    if (has("black")) return "allblack";
    if (has("white")) return "allwhite";
    if (has("gray")) return "russianblue";
    if (has("orange") || has("cream")) return "cheese";
    return null;
  }

  // 4) 얼룩(bicolor/van) — 흑백이면 턱시도 계열, 주황이면 치즈 계열
  if (pattern === "bicolor" || pattern === "van") {
    if (has("black") && has("white")) return "tuxedo";
    if (has("orange")) return "cheese";
    return null;
  }

  return null;
}
