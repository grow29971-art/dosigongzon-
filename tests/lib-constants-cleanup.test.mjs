// 리디자인 후속 2/3 — lib 색·이모지 상수 정리 회귀 가드
// node --test tests/lib-constants-cleanup.test.mjs
//   (a) 화면 참조가 끊긴 장식 필드(color/emoji/bg/gradient)가 lib 상수에서 사라졌다
//   (b) 크론·메일·OG·화면 소비자가 남아 있는 필드는 그대로 있다(삭제 금지)
// 소비자 전수 조사 결과는 각 상수 옆 주석("소비자: <파일>")과 커밋 메시지에 남긴다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8").replace(/\r\n/g, "\n");

/** `export const NAME` (또는 `const NAME`) 선언부터 닫는 `};`/`];`까지 잘라낸다 */
function block(src, name) {
  const re = new RegExp(String.raw`(?:export )?const ${name}\b[^=]*=[\s\S]*?\n[\]}];`);
  const m = src.match(re);
  assert.ok(m, `${name} 선언을 찾지 못함`);
  return m[0];
}

/** `export interface NAME {` 부터 닫는 `}` 까지 */
function iface(src, name) {
  const re = new RegExp(String.raw`export interface ${name}\b[^{]*\{[\s\S]*?\n\}`);
  const m = src.match(re);
  assert.ok(m, `${name} 인터페이스를 찾지 못함`);
  return m[0];
}

const FIELD = (f) => new RegExp(String.raw`\b${f}\??\s*:`);

// ── (a) 삭제 대상 ──
const REMOVED = [
  ["lib/order-repo.ts", "ORDER_STATUS_MAP", ["color"]],
  ["lib/news-repo.ts", "BADGE_PRESETS", ["color", "bg", "gradient"]],
  ["lib/cats-repo.ts", "HEALTH_MAP", ["color", "emoji"]],
  ["lib/cats-repo.ts", "ADOPTION_MAP", ["color", "emoji"]],
  ["lib/cats-repo.ts", "VISIBILITY_MAP", ["color", "emoji"]],
  ["lib/cats-repo.ts", "GENDER_MAP", ["emoji"]],
  ["lib/cats-repo.ts", "CARE_TIPS", ["emoji"]],
  ["lib/cats-repo.ts", "DIARY_MOODS", ["emoji"]],
  ["lib/care-logs-repo.ts", "CARE_TYPE_MAP", ["color", "emoji"]],
  ["lib/experiments-repo.ts", "EXPERIMENT_ACTIVITY_MAP", ["emoji"]],
  ["lib/reactions-repo.ts", "REACTION_EMOJIS", ["color"]],
  ["lib/titles.ts", "ADMIN_TITLES", ["emoji"]],
];

for (const [file, name, fields] of REMOVED) {
  test(`${file} ${name} — 장식 필드 삭제: ${fields.join("/")}`, () => {
    const b = block(read(file), name);
    for (const f of fields) {
      assert.ok(!FIELD(f).test(b), `${name}.${f} 가 아직 남아 있음`);
    }
  });
}

test("lib/cats-repo.ts CareTip 인터페이스에 emoji 없음", () => {
  const b = iface(read("lib/cats-repo.ts"), "CareTip");
  assert.ok(!FIELD("emoji").test(b), "CareTip.emoji 가 아직 남아 있음");
  assert.ok(FIELD("title").test(b), "CareTip.title 은 유지");
});

test("lib/titles.ts AdminTitle 인터페이스에 emoji 없음 (color·hidden은 유지)", () => {
  const b = iface(read("lib/titles.ts"), "AdminTitle");
  assert.ok(!FIELD("emoji").test(b), "AdminTitle.emoji 가 아직 남아 있음");
  assert.ok(FIELD("color").test(b), "AdminTitle.color 는 유지해야 함");
  assert.ok(FIELD("hidden").test(b), "AdminTitle.hidden 은 유지해야 함");
});

// ── (b) 소비자가 있어 유지해야 하는 필드 ──
const KEPT = [
  // app/(main)/community/[id]/opengraph-image.tsx 가 emoji·color 사용
  ["lib/types.ts", "CATEGORY_MAP", ["label", "color", "emoji"]],
  // app/components/HomeAuthed.tsx 레벨업 토스트가 LevelInfo.emoji 사용
  ["lib/cats-repo.ts", "LEVEL_THRESHOLDS", ["emoji"]],
  // app/(main)/map/page.tsx 마커 HTML 이 catRoamMode().emoji 사용
  ["lib/cats-repo.ts", "REST_BY_REASON", ["emoji"]],
  // app/components/HomeAuthed.tsx 업적 토스트가 TITLES[].emoji 사용
  ["lib/titles.ts", "TITLES", ["emoji"]],
  // app/components/HomeAuthed.tsx 업적 토스트가 CATEGORY_COLORS 사용
  ["lib/titles.ts", "CATEGORY_COLORS", ["register"]],
  // app/components/ReactionBar.tsx 가 emoji 사용
  ["lib/reactions-repo.ts", "REACTION_EMOJIS", ["emoji", "label"]],
];

for (const [file, name, fields] of KEPT) {
  test(`${file} ${name} — 소비자 있는 필드 유지: ${fields.join("/")}`, () => {
    const b = block(read(file), name);
    for (const f of fields) {
      assert.ok(FIELD(f).test(b), `${name}.${f} 가 사라짐 — 소비자가 있는 필드`);
    }
  });
}

test("lib/cats-repo.ts getLevelColor 유지 (app/(main)/map/page.tsx 채팅 레벨 점)", () => {
  assert.ok(/export function getLevelColor\(/.test(read("lib/cats-repo.ts")));
});

test("lib/titles.ts ADMIN_TITLES.hidden(staff) 유지 — TitleBadge·admin/users 가 사용", () => {
  const b = block(read("lib/titles.ts"), "ADMIN_TITLES");
  assert.ok(/id: "staff"[^\n]*hidden: true/.test(b));
});
