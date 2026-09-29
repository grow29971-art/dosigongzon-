import assert from "node:assert/strict";
import test from "node:test";

import { isHoldout, journeyDay, planJourney, journeyMessage } from "../lib/journey.ts";

const NOW = new Date("2026-09-30T00:00:00Z");
const ago = (d) => new Date(+NOW - d * 864e5 - 1000).toISOString();
const plan = (days, done = []) => planJourney({ userId: "u", createdAt: ago(days), now: NOW, done });

test("holdout은 결정적이고 약 10%다", () => {
  assert.equal(isHoldout("abc"), isHoldout("abc"));
  let n = 0;
  for (let i = 0; i < 5000; i++) if (isHoldout(crypto.randomUUID())) n++;
  assert.ok(n > 350 && n < 650, `holdout ${n}/5000`);
});

test("가입 당일은 welcome, 재실행(done)이면 보낼 것 없음", () => {
  assert.equal(plan(0).send, "welcome");
  assert.equal(plan(0, ["welcome"]).send, null);
});

test("놓친 단계는 skipped로 돌리고 가장 늦은 도래 단계 1개만 보낸다", () => {
  const p = plan(3);
  assert.equal(p.send, "d3");
  assert.deepEqual(p.skipped, ["welcome", "d1"]);
  assert.equal(plan(3, ["welcome", "d1", "d3"]).send, null);
  assert.equal(plan(7, ["welcome", "d1"]).send, "d7");
});

test("day는 만 하루 단위", () => {
  assert.equal(journeyDay(ago(1), NOW), 1);
  assert.equal(journeyDay(NOW, NOW), 0);
});

test("d1: 고양이 유무에 따라 문구·링크가 갈리고 문구에 느낌표·이모지가 없다", () => {
  assert.equal(journeyMessage("d1", { hasCat: false }).url, "/map?add=1");
  assert.equal(journeyMessage("d1", { hasCat: true, catId: "c1" }).url, "/cats/c1");
  assert.equal(journeyMessage("d7", { hasCat: true }).url, "/mypage/circle");
  for (const s of ["welcome", "d1", "d3", "d7"]) {
    const m = journeyMessage(s, { hasCat: false });
    assert.ok(!/[!\p{Extended_Pictographic}]/u.test(m.title + m.body), s);
  }
});
