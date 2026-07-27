import assert from "node:assert/strict";
import test from "node:test";

import {
  onboardingSteps,
  isOnboardingStepKey,
  pendingOnboardingSteps,
  isOnboardingComplete,
} from "../lib/onboarding-steps.ts";

test("정규 3단계는 explore→care→protect 순서로 고정된다", () => {
  assert.deepEqual(
    onboardingSteps().map((s) => s.key),
    ["explore", "care", "protect"],
  );
});

test("각 단계의 href는 in-app 절대경로다", () => {
  for (const step of onboardingSteps()) {
    assert.equal(step.href.startsWith("/"), true, `${step.key} href`);
    assert.equal(step.href.startsWith("//"), false, `${step.key} 프로토콜-상대`);
  }
});

test("반환 배열을 변형해도 원본 정의는 불변이다", () => {
  const first = onboardingSteps();
  first.pop();
  first[0].href = "/hacked";
  assert.deepEqual(
    onboardingSteps().map((s) => s.key),
    ["explore", "care", "protect"],
  );
  assert.equal(onboardingSteps()[0].href, "/map");
});

test("온보딩 단계 키를 정확히 판별한다", () => {
  assert.equal(isOnboardingStepKey("explore"), true);
  assert.equal(isOnboardingStepKey("care"), true);
  assert.equal(isOnboardingStepKey("protect"), true);
  assert.equal(isOnboardingStepKey("Explore"), false);
  assert.equal(isOnboardingStepKey(""), false);
  assert.equal(isOnboardingStepKey(undefined), false);
  assert.equal(isOnboardingStepKey(3), false);
});

test("이미 안내한 단계는 빼고 남은 단계만 정규 순서로 준다 (중복 노출 방지)", () => {
  assert.deepEqual(
    pendingOnboardingSteps(["explore"]).map((s) => s.key),
    ["care", "protect"],
  );
  assert.deepEqual(
    pendingOnboardingSteps(["protect", "explore"]).map((s) => s.key),
    ["care"],
  );
});

test("아무것도 안내하지 않았으면 3단계 전부 남는다", () => {
  assert.deepEqual(
    pendingOnboardingSteps().map((s) => s.key),
    ["explore", "care", "protect"],
  );
});

test("알 수 없는/중복 shown 값은 안전하게 무시한다", () => {
  assert.deepEqual(
    pendingOnboardingSteps(["explore", "explore", "bogus", ""]).map((s) => s.key),
    ["care", "protect"],
  );
});

test("3단계 모두 안내하면 완료로 판정한다", () => {
  assert.equal(isOnboardingComplete(["explore", "care", "protect"]), true);
  assert.equal(isOnboardingComplete(["explore", "care"]), false);
  assert.equal(isOnboardingComplete([]), false);
});
