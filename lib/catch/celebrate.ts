// 축하 파티클 — canvas-confetti 래퍼 (냥줍 lib/celebrate.ts 이식, 2026-08-04 P2).
// 포획 결과·상자 잭팟·쓰다듬기의 "도파민 순간" 전용. 등급이 오를수록 연출이 커진다.
// 샤이니는 어떤 등급이든 무지개 프리즘이 덧붙는다.
import confetti from "canvas-confetti";

const RARITY_COLORS: Record<string, string[]> = {
  common: ["#9CA3AF", "#E8F0FE", "#FFFFFF"],
  uncommon: ["#22C55E", "#86EFAC", "#FFFFFF"],
  rare: ["#3B82F6", "#93C5FD", "#00C9FF", "#FFFFFF"],
  legendary: ["#F5A623", "#FFD700", "#FFF3C4", "#FF8C00"],
};
const RAINBOW = ["#FF5E5E", "#FFB347", "#FFE156", "#7DDE92", "#4DD7FF", "#B39DFF", "#FF8AD8"];

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 포획 결과 화면 진입 순간 — 등급별 축하 버스트 */
export function celebrateCatch(rarity: string, shiny = false) {
  if (reduced()) return;
  const colors = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;
  // zIndex: 결과 화면(오버레이 z-500대)보다 위
  const base = { zIndex: 2000, colors, disableForReducedMotion: true } as const;

  if (rarity === "legendary") {
    // 금빛 폭풍 — 중앙 폭발 → 양옆 대포 → 별 낙하
    confetti({ ...base, particleCount: 90, spread: 100, startVelocity: 42, origin: { y: 0.55 } });
    setTimeout(() => {
      confetti({ ...base, particleCount: 45, angle: 60, spread: 55, origin: { x: 0, y: 0.65 } });
      confetti({ ...base, particleCount: 45, angle: 120, spread: 55, origin: { x: 1, y: 0.65 } });
    }, 250);
    setTimeout(() => confetti({
      ...base, particleCount: 36, spread: 120, startVelocity: 24, gravity: 0.7,
      shapes: ["star"], scalar: 1.3, origin: { y: 0.4 },
    }), 550);
  } else if (rarity === "rare") {
    confetti({ ...base, particleCount: 70, spread: 85, startVelocity: 38, origin: { y: 0.55 } });
    setTimeout(() => confetti({ ...base, particleCount: 30, spread: 60, startVelocity: 28, origin: { y: 0.5 } }), 300);
  } else if (rarity === "uncommon") {
    confetti({ ...base, particleCount: 50, spread: 75, startVelocity: 32, origin: { y: 0.55 } });
  } else {
    confetti({ ...base, particleCount: 26, spread: 55, startVelocity: 24, origin: { y: 0.55 } });
  }

  if (shiny) {
    setTimeout(() => confetti({
      particleCount: 60, spread: 160, startVelocity: 20, gravity: 0.6, scalar: 0.9,
      colors: RAINBOW, zIndex: 2000, disableForReducedMotion: true, origin: { y: 0.45 },
    }), 400);
  }
}

/** 상자 잭팟 등 — 트로피 순간의 골드 샤워 */
export function celebrateVictory() {
  if (reduced()) return;
  confetti({
    particleCount: 80, spread: 90, startVelocity: 38, origin: { y: 0.6 },
    colors: RARITY_COLORS.legendary, zIndex: 2000, disableForReducedMotion: true,
  });
  setTimeout(() => confetti({
    particleCount: 40, spread: 120, startVelocity: 22, gravity: 0.7, shapes: ["star"], scalar: 1.2,
    colors: ["#FFD700", "#FFF3C4"], zIndex: 2000, disableForReducedMotion: true, origin: { y: 0.4 },
  }), 350);
}

/** 쓰다듬기 — 핑크 하트가 폭신하게 떠오른다 (지도에서 내 냥이를 만났을 때) */
export function celebratePet() {
  if (reduced()) return;
  // 하트 모양은 shapeFromText 지원 브라우저에서만 — 미지원이면 핑크 파티클 폴백
  const heartShape = typeof confetti.shapeFromText === "function"
    ? [confetti.shapeFromText({ text: "💗", scalar: 1.6 })]
    : undefined;
  confetti({
    particleCount: 16, spread: 65, startVelocity: 16, gravity: 0.45, decay: 0.92,
    scalar: heartShape ? 1.6 : 1,
    shapes: heartShape,
    colors: ["#FF6EB0", "#FF9FCB", "#FFC1DC"],
    zIndex: 2000, disableForReducedMotion: true, origin: { y: 0.6 },
  });
}
