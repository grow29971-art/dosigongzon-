// 학대경보 특정인 지목 필터 — node --test tests/person-targeting.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findPersonTargeting } from "../lib/abuse-patterns.ts";

test("사람 지목은 잡는다", () => {
  for (const t of [
    "302호 아저씨가 발로 찼어요",
    "옆집 할머니가 쥐약을 놨대요",
    "경비원이 쫓아냈어요",
    "관리소장이 급식소를 치웠어요",
    "편의점 사장이 물을 뿌렸어요",
  ]) assert.ok(findPersonTargeting(t).length > 0, t);
});

test("상황 서술·기본 경보 문구는 통과", () => {
  for (const t of [
    "⚠️ 학대·위험 의심 경보 (지도에서 원터치로 켰어요)",
    "다리를 절고 있고 누가 돌을 던진 것 같아요",
    "밤에 비명 소리가 났어요. 오늘 밥은 안 먹었어요",
    "",
  ]) assert.equal(findPersonTargeting(t).length, 0, t);
});
