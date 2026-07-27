import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { onboardingSteps } from "../lib/onboarding-steps.ts";

const here = dirname(fileURLToPath(import.meta.url));
const libPath = join(here, "..", "lib", "onboarding-steps.ts");
const src = readFileSync(libPath, "utf8");

// P1 "중복 안내 단일 3단계 온보딩" 불변식을 소스 레벨에서 고정한다.
// 온보딩 안내는 단일 진실원본(canonical 3-step)에서만 나와야 하며,
// 각 단계는 서로 다른 실제 in-app 라우트를 가리켜 중복/깨진 안내면을 만들지 않는다.

test("각 단계 href는 서로 겹치지 않는 고유 in-app 경로다 (중복 안내면 방지)", () => {
  const hrefs = onboardingSteps().map((s) => s.href);
  const unique = new Set(hrefs);
  assert.equal(
    unique.size,
    hrefs.length,
    `온보딩 href가 중복됨: ${hrefs.join(", ")}`,
  );
  for (const href of hrefs) {
    assert.equal(href.startsWith("/"), true, `${href} in-app 절대경로 아님`);
    assert.equal(href.startsWith("//"), false, `${href} 프로토콜-상대 URL`);
    assert.equal(/^[a-z]+:/i.test(href), false, `${href} 외부 URL 스킴 포함`);
  }
});

test("단일 진실원본 CANONICAL_ONBOARDING_STEPS가 as const 상수로 한 번만 정의된다", () => {
  // 진실원본 상수 선언은 정확히 1회여야 한다(여러 정의로 갈라지면 '단일' 불변식 붕괴).
  const declMatches = src.match(/const\s+CANONICAL_ONBOARDING_STEPS\b/g) || [];
  assert.equal(declMatches.length, 1, "CANONICAL_ONBOARDING_STEPS 정의는 1회여야 함");
  // 방어 복사 불변을 위해 as const로 얼어 있어야 한다.
  assert.match(src, /CANONICAL_ONBOARDING_STEPS[\s\S]*?\]\s*as const/);
  // 공개 조회 함수는 상수를 방어 복사(map spread)로만 노출한다.
  assert.match(src, /CANONICAL_ONBOARDING_STEPS\.map\(\(s\)\s*=>\s*\(\{\s*\.\.\.s\s*\}\)\)/);
});

test("소스에 하드코딩된 온보딩 href는 정규 3경로 집합과 일치한다", () => {
  const found = [...src.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  const canonical = onboardingSteps().map((s) => s.href).sort();
  assert.deepEqual(found, canonical, "소스 href 목록이 정규 3단계와 어긋남");
});
