import assert from "node:assert/strict";
import test from "node:test";

import {
  CARE_TEAM_SECTIONS,
  careTeamSections,
  findCareTeamSection,
} from "../lib/care-team.ts";

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
