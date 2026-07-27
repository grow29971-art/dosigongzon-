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
  assert.equal(hrefByKey.circle, "/mypage/circle");
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

// ─────────────────────────────────────────────
// P4 계약 무결성: 카드는 계약의 label·description·href를 그대로 렌더한다.
//   어떤 섹션이 빈 라벨/설명을 갖거나 href가 절대 경로(`/`로 시작)가 아니면
//   카드에 깨진 항목이 생기고, careTeamSectionByHref의 경로 정규화도 어긋난다.
//   미래의 계약 편집이 이런 불량 값을 넣으면 즉시 실패하도록 고정한다.
// ─────────────────────────────────────────────

test("every section has a non-empty label and description", () => {
  for (const section of CARE_TEAM_SECTIONS) {
    assert.equal(typeof section.label, "string", `${section.key} label must be a string`);
    assert.ok(section.label.trim().length > 0, `${section.key} label must be non-empty`);
    assert.equal(
      typeof section.description,
      "string",
      `${section.key} description must be a string`,
    );
    assert.ok(
      section.description.trim().length > 0,
      `${section.key} description must be non-empty`,
    );
  }
});

test("every section href is an absolute in-app route (starts with '/', no scheme)", () => {
  for (const section of CARE_TEAM_SECTIONS) {
    assert.equal(typeof section.href, "string", `${section.key} href must be a string`);
    assert.ok(
      section.href.startsWith("/"),
      `${section.key} href must be an absolute in-app path`,
    );
    // 외부 스킴/프로토콜-상대 URL 금지(P4는 기존 in-app 라우트만 가리킨다).
    assert.ok(
      !section.href.startsWith("//"),
      `${section.key} href must not be a protocol-relative URL`,
    );
    assert.ok(
      !/^[a-z][a-z0-9+.-]*:/i.test(section.href),
      `${section.key} href must not contain a URL scheme`,
    );
    // 계약의 href는 careTeamSectionByHref로 자기 자신을 되찾을 수 있어야 한다.
    assert.equal(
      careTeamSectionByHref(section.href)?.key,
      section.key,
      `${section.key} href must round-trip through careTeamSectionByHref`,
    );
  }
});

test("careTeamSectionByHref matches existing routes exactly", () => {
  assert.equal(careTeamSectionByHref("/mypage/circle")?.key, "circle");
  assert.equal(careTeamSectionByHref("/map")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/community")?.key, "community");
});

test("careTeamSectionByHref ignores query string and hash (path only)", () => {
  assert.equal(careTeamSectionByHref("/map?region=seoul")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/mypage/circle#invite")?.key, "circle");
  assert.equal(careTeamSectionByHref("/community?tab=1#top")?.key, "community");
});

test("careTeamSectionByHref ignores a trailing slash (path normalization)", () => {
  assert.equal(careTeamSectionByHref("/mypage/circle/")?.key, "circle");
  assert.equal(careTeamSectionByHref("/map/")?.key, "neighborhood");
  assert.equal(careTeamSectionByHref("/community/?tab=1")?.key, "community");
  // 여러 개의 끝 슬래시도 모두 제거한다.
  assert.equal(careTeamSectionByHref("/mypage/circle//")?.key, "circle");
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

// ─────────────────────────────────────────────
// P4 불변식(기존 URL 유지): CareTeamCard는 새 라우트를 만들지 않고 오직
//   lib/care-team.ts 계약의 href만 링크 대상으로 써야 한다. 미래 편집이
//   컴포넌트에 raw 경로 문자열(href="/새경로")을 하드코딩하면 "기존 URL
//   보존" 불변식이 조용히 깨진다. 소스 감시로 그 드리프트를 고정한다.
// ─────────────────────────────────────────────

test("CareTeamCard links only through the contract (no hardcoded route href)", () => {
  const source = readRepoFile("app/components/CareTeamCard.tsx");
  // 링크 대상은 계약(section.href)에서만 온다.
  assert.ok(
    /href=\{section\.href\}/.test(source),
    "CareTeamCard must set Link href from the contract (section.href)",
  );
  // raw 경로 문자열(href="/...")을 직접 하드코딩하지 않는다 = 새 라우트 금지.
  assert.ok(
    !/href=["']\//.test(source),
    "CareTeamCard must not hardcode a raw route href (P4 keeps existing URLs)",
  );
  // 카드가 그리는 섹션 목록은 계약 함수에서만 온다.
  assert.ok(
    /careTeamSections\(\)\.map/.test(source),
    "CareTeamCard must iterate the contract via careTeamSections()",
  );
});

// ─────────────────────────────────────────────
// P4 불변식(기존 기능 삭제 금지): CareTeamCard는 각 화면의 2차 영역에
//   "더해" 보여주는 진입 카드일 뿐, 그 화면의 기존 핵심 콘텐츠를 대체·삭제
//   해서는 안 된다. 미래 편집이 CareTeamCard를 배선하며 실수로 기존 주요
//   내용을 걷어내면(예: 홈의 서클 빠른 진입, 서클의 돌봄 교대, 커뮤니티의
//   글쓰기, 지도의 학대 경보) 이 소스 감시가 즉시 실패한다.
// ─────────────────────────────────────────────

const CARE_TEAM_SURFACE_ANCHORS = {
  // 홈: P1 오늘의 돌봄 인박스 + 서클 빠른 진입은 유지되어야 한다.
  "app/components/HomeAuthed.tsx": ["careInbox", "MyCircleQuickEntry"],
  // 서클: P3 돌봄 교대 흐름은 유지되어야 한다.
  "app/(main)/mypage/circle/page.tsx": ["/api/care-shifts"],
  // 커뮤니티: 글쓰기 프롬프트는 유지되어야 한다.
  "app/(main)/community/page.tsx": ["WritePrompt"],
  // 지도: Kakao 지도 인스턴스와 상세 도구는 유지되어야 한다.
  "app/(main)/map/page.tsx": ["mapInstanceRef", "detailToolsVisible"],
};

test("CareTeamCard is added alongside, not replacing, each surface's existing content", () => {
  for (const relativePath of CARE_TEAM_CALL_SITES) {
    const source = readRepoFile(relativePath);
    // 이 화면들은 여전히 CareTeamCard를 렌더한다(추가 위치).
    assert.ok(
      source.includes("<CareTeamCard"),
      `${relativePath} should still render CareTeamCard`,
    );
    // 그리고 이 화면의 기존 핵심 콘텐츠 앵커도 그대로 남아 있어야 한다.
    for (const anchor of CARE_TEAM_SURFACE_ANCHORS[relativePath]) {
      assert.ok(
        source.includes(anchor),
        `${relativePath} must keep existing content anchor "${anchor}" (P4 must not delete existing features)`,
      );
    }
  }
});
