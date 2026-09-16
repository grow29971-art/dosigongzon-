// 지도 화면군 리디자인 회귀 가드 — node --test tests/redesign-map.test.mjs
// 2026-09-16 「익숙한 동네앱」 리디자인(결정 0007) T5. 소스를 텍스트로 읽어 다음을 고정한다:
//   (a) 지도 화면군 파일에 구 아이보리·웜 잉크 hex, 죽은 serif-display 클래스, placehold.co 참조가 없다
//   (b) map/page.tsx의 핵심 앵커(mapInstanceRef·detailToolsVisible·escapeHtml()가 그대로 남아 있다
//   (c) map/layout.tsx의 <MapIntroSheet JSX 마운트는 정확히 1회
//   (d) 퍼널 계측 호출(logFunnelEvent()이 FirstFeedBar·MapIntroSheet·PendingCareHandoff에 남아 있다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const MAP_FILES = [
  "app/(main)/map/page.tsx",
  "app/(main)/map/layout.tsx",
  "app/components/MapIntroSheet.tsx",
  "app/components/MapIntroModal.tsx",
  "app/components/MapCoachmark.tsx",
  "app/components/MapChatGuideModal.tsx",
  "app/components/CatLocationPicker.tsx",
  "app/components/ShareMyLocation.tsx",
  "app/components/VisibilityIntroSheet.tsx",
  "app/components/SafetyCallSheet.tsx",
  "app/components/FirstFeedBar.tsx",
  "app/components/PendingCareHandoff.tsx",
];

test("(a) 지도 화면군: 구 아이보리 hex·serif-display·placehold.co 잔재 없음", () => {
  const banned = ["#FAF6F0", "#211D17", "#5D564B", "serif-display", "placehold.co"];
  for (const f of MAP_FILES) {
    const src = read(f).toUpperCase();
    for (const s of banned) {
      assert.ok(!src.includes(s.toUpperCase()), `${f}에 "${s}" 가 남아 있음`);
    }
  }
});

test("(b) map/page.tsx 핵심 앵커 유지", () => {
  const src = read("app/(main)/map/page.tsx");
  for (const anchor of ["mapInstanceRef", "detailToolsVisible", "escapeHtml("]) {
    assert.ok(src.includes(anchor), `map/page.tsx에 "${anchor}" 가 있어야 한다`);
  }
});

test("(c) map/layout.tsx의 <MapIntroSheet 마운트는 정확히 1회", () => {
  const layout = read("app/(main)/map/layout.tsx");
  const mounts = (layout.match(/<\s*MapIntroSheet/g) ?? []).length;
  assert.equal(mounts, 1, `MapIntroSheet JSX 마운트는 1회여야 한다: ${mounts}`);
});

test("(d) 퍼널 계측 logFunnelEvent( 호출 유지", () => {
  for (const f of [
    "app/components/FirstFeedBar.tsx",
    "app/components/MapIntroSheet.tsx",
    "app/components/PendingCareHandoff.tsx",
  ]) {
    assert.ok(read(f).includes("logFunnelEvent("), `${f}에 logFunnelEvent( 호출이 있어야 한다`);
  }
});
