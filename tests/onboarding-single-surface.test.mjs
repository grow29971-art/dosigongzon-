import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// P1-3 소스 감시 회귀: "중복 안내 단일 3단계 온보딩" 불변식.
//
// 첫 방문 온보딩 표면은 지도 위 MapIntroSheet 1장으로 단일화되어 있고,
// 인터스티셜 /onboarding 페이지는 폐지(리다이렉트 전용)되었다.
// 이 테스트는 중복 온보딩 표면이 다시 살아나는 회귀를 소스 레벨에서 막는다.
// (UI·flag·URL·라우트·데이터 변경 없음, 파일 삭제 없음 - 감시 전용)

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("/onboarding 페이지는 인터스티셜을 부활시키지 않고 리다이렉트 전용으로 남는다", () => {
  const src = read("app/onboarding/page.tsx");
  // 지도(/map)로 replace 하는 리다이렉트여야 한다.
  assert.match(src, /router\.replace\(\s*["']\/map["']\s*\)/);
  // 인터스티셜 온보딩 UI(JSX 마운트)가 다시 들어오면 안 된다: <MapIntroSheet 렌더 금지.
  assert.doesNotMatch(src, /<\s*MapIntroSheet/);
});

test("첫 방문 게이트는 단일 지도 온보딩(/map)으로만 유도한다", () => {
  const src = read("app/components/LandingOnboardingGate.tsx");
  // /map 이외의 온보딩 라우트로 유도하지 않는다.
  const replaceTargets = [...src.matchAll(/router\.replace\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (m) => m[1],
  );
  assert.ok(replaceTargets.length > 0, "replace 대상이 있어야 한다");
  for (const t of replaceTargets) {
    assert.equal(t, "/map", `게이트 replace 대상은 /map 이어야 한다: ${t}`);
  }
});

test("첫 방문 온보딩 표면(MapIntroSheet)은 지도 레이아웃에서 정확히 한 번 렌더된다", () => {
  const layout = read("app/(main)/map/layout.tsx");
  // 주석 등을 제외한 실제 JSX 마운트(<MapIntroSheet)가 정확히 1회여야 단일 표면이다.
  const mounts = (layout.match(/<\s*MapIntroSheet/g) ?? []).length;
  assert.equal(mounts, 1, `MapIntroSheet JSX 마운트는 1회여야 한다: ${mounts}`);
});
