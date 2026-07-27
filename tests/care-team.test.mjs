import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CARE_TEAM_SECTIONS,
  careTeamSections,
  careTeamSectionByHref,
  findCareTeamSection,
} from "../lib/care-team.ts";

function readRepoFile(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8");
}

test("care team sections keep fixed order: circle -> neighborhood -> community", () => {
  assert.deepEqual(
    careTeamSections().map((s) => s.key),
    ["circle", "neighborhood", "community"],
  );
});

test("care team sections preserve existing URLs (no new routes)", () => {
  const hrefByKey = Object.fromEntries(
    careTeamSections().map((s) => [s.key, s.href]),
  );
  assert.equal(hrefByKey.circle, "/circle");
  assert.equal(hrefByKey.neighborhood, "/map");
  assert.equal(hrefByKey.community, "/community");
});

test("careTeamSections returns a fresh copy (caller cannot mutate the contract)", () => {
  const first = careTeamSections();
  first[0].label = "changed";
  first.push({ key: "circle", label: "x", description: "x", href: "/x" });
  const second = careTeamSections();
  assert.equal(second.length, 3);
  assert.equal(second[0].label, "돌봄 서클");
});

test("findCareTeamSection returns the matching section by key", () => {
  const section = findCareTeamSection("neighborhood");
  assert.ok(section);
  assert.equal(section.href, "/map");
});

test("findCareTeamSection is fail-safe for unknown / prototype / non-string keys", () => {
  assert.equal(findCareTeamSection("nope"), undefined);
  assert.equal(findCareTeamSection("toString"), undefined);
  assert.equal(findCareTeamSection("constructor"), undefined);
  assert.equal(findCareTeamSection(null), undefined);
  assert.equal(findCareTeamSection(undefined), undefined);
});

test("every section key is unique and present in the exported contract", () => {
  const keys = CARE_TEAM_SECTIONS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("careTeamSectionByHref matches existing routes exactly", () => {
  assert.equal(careTeamSectionByHref("/circle")?.key, "circle");
  assert.equal(careTeamSectionByHref("/map")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/community")?.key, "community");
});

test("careTeamSectionByHref ignores query string and hash (path only)", () => {
  assert.equal(careTeamSectionByHref("/map?region=seoul")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/circle#invite")?.key, "circle");
  assert.equal(careTeamSectionByHref("/community?tab=1#top")?.key, "community");
});

test("careTeamSectionByHref ignores a trailing slash (path normalization)", () => {
  assert.equal(careTeamSectionByHref("/circle/")?.key, "circle");
  assert.equal(careTeamSectionByHref("/map/")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/community/?tab=1")?.key, "community");
  // 여러 개의 끝 슬래시도 모두 제거한다.
  assert.equal(careTeamSectionByHref("/circle//")?.key, "circle");
  // 루트/부분 경로는 여전히 매칭되지 않는다.
  assert.equal(careTeamSectionByHref("/"), undefined);
  assert.equal(careTeamSectionByHref("/mapx/"), undefined);
});

test("careTeamSectionByHref is fail-safe for unknown / partial / non-string href", () => {
  assert.equal(careTeamSectionByHref("/nope"), undefined);
  assert.equal(careTeamSectionByHref("/mapx"), undefined);
  assert.equal(careTeamSectionByHref("map"), undefined);
  assert.equal(careTeamSectionByHref(""), undefined);
  assert.equal(careTeamSectionByHref(null), undefined);
  assert.equal(careTeamSectionByHref(undefined), undefined);
});

// ─────────────────────────────────────────────
// P4 배선 계약: CareTeamCard가 노출되는 모든 진입면(홈·서클·커뮤니티·지도)은
//   반드시 P4 flag로 게이팅되어야 한다. flag off / kill switch on이면 카드가
//   렌더되지 않아야 하는데, 렌더 조건에서 flag 검사가 빠지면 fail-closed 원칙이
//   깨진다. 소스 정규식 감시로 그 드리프트를 고정한다(기존 테스트 스타일).
// ─────────────────────────────────────────────

const CARE_TEAM_CALL_SITES = [
  "app/components/HomeAuthed.tsx",
  "app/(main)/mypage/circle/page.tsx",
  "app/(main)/community/page.tsx",
  "app/(main)/map/page.tsx",
];

test("every surface that renders CareTeamCard gates it behind the P4 flag", () => {
  for (const relativePath of CARE_TEAM_CALL_SITES) {
    const source = readRepoFile(relativePath);
    assert.ok(
      source.includes("<CareTeamCard"),
      `${relativePath} should render CareTeamCard`,
    );
    // 직접 flag 검사 또는 P4 flag에서 파생된 게이트 변수(showCareTeam) 중 하나로
    // 반드시 fail-closed 게이팅되어야 한다.
    const directlyGated = /isCoreJourneyEnabled\(\s*["']P4["']\s*\)/.test(source);
    const derivedGate =
      /const\s+showCareTeam\s*=\s*isCoreJourneyEnabled\(\s*["']P4["']\s*\)/.test(
        source,
      ) && /showCareTeam\s*&&\s*<CareTeamCard/.test(source);
    assert.ok(
      directlyGated || derivedGate,
      `${relativePath} must gate CareTeamCard behind the P4 flag (fail-closed)`,
    );
  }
});
