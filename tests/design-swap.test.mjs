// 리디자인 색·라운드 치환 도구 회귀 가드 — node --test tests/design-swap.test.mjs
// scripts/design-swap.mjs 의 순수 함수(swapText·reportHex·isReportExcluded)를 임시 문자열로 검증한다.
// 파일 시스템 접근 없음. 매핑 값은 app/globals.css 2026-09-16 기준선(결정 0007)과 일치해야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HEX_MAP,
  RGBA_MAP,
  REPORT_ALLOW,
  swapText,
  reportHex,
  isReportExcluded,
  isSwapExcluded,
} from "../scripts/design-swap.mjs";

test("(a) 알파 접미사 8자리 hex — 접미사 보존, var() 아닌 새 hex", () => {
  const { out, count } = swapText("color: #211D1740; bg: #FAF6F0CC; keep: #B05C3615", { mode: "var" });
  assert.equal(out, "color: #19191940; bg: #FFFFFFCC; keep: #B05C3615");
  assert.equal(count, 2);
  // hex 모드도 동일
  assert.equal(swapText("#211D1740", { mode: "hex" }).out, "#19191940");
});

test("(b) rgba 프리픽스 치환 — 알파 보존, 공백 유무 둘 다", () => {
  const src = "a: rgba(250,246,240, 0.5); b: rgba(250, 246, 240, .08); c: rgba(33,29,23,0.3); d: rgba(176, 92, 54, 0.1)";
  const { out, count } = swapText(src, { mode: "var" });
  assert.equal(out, "a: rgba(255,255,255, 0.5); b: rgba(255, 255, 255, .08); c: rgba(25,25,25,0.3); d: rgba(176, 92, 54, 0.1)");
  assert.equal(count, 3);
  for (const [from] of RGBA_MAP) {
    assert.notEqual(from.join(","), "176,92,54", "primary rgba는 매핑에 있으면 안 됨");
  }
});

test("(c) 대소문자 무시 — 소문자·혼합 hex도 치환", () => {
  const { out, count } = swapText("#faf6f0 #Faf6F0 #211d17 #ad5e3b", { mode: "var" });
  assert.equal(out, "var(--color-surface) var(--color-surface) var(--color-text-main) var(--color-primary)");
  assert.equal(count, 4);
  assert.equal(swapText("#211d1740", { mode: "var" }).out, "#19191940");
});

test("(c-2) 더 긴 토큰의 일부는 건드리지 않음", () => {
  // 6자리 뒤에 hex가 아닌 문자가 붙는 경우만 치환, 더 긴 id 문자열은 그대로
  const src = "#FAF6F0Z #FAF6F0123 #FAF6F0";
  const { out } = swapText(src, { mode: "var" });
  assert.equal(out, "#FAF6F0Z #FAF6F0123 var(--color-surface)");
});

test("(d) Tailwind 라운드 강등 — 2xl/3xl→xl, 방향 변형 동일, rounded-full 유지", () => {
  const src = 'className="rounded-3xl rounded-2xl rounded-t-2xl rounded-b-3xl rounded-tl-2xl md:rounded-2xl rounded-full rounded-xl rounded-lg"';
  const { out, count } = swapText(src, { mode: "var" });
  assert.equal(out, 'className="rounded-xl rounded-xl rounded-t-xl rounded-b-xl rounded-tl-xl md:rounded-xl rounded-full rounded-xl rounded-lg"');
  assert.equal(count, 6);
});

test("(e) hex 모드와 var 모드 결과 차이", () => {
  const src = "fill=\"#FAF6F0\" stroke=\"#AD5E3B\" bg=\"#F3EEE5\" c=\"#C97C52\" d=\"#8A4325\"";
  const v = swapText(src, { mode: "var" }).out;
  const h = swapText(src, { mode: "hex" }).out;
  assert.equal(v, "fill=\"var(--color-surface)\" stroke=\"var(--color-primary)\" bg=\"var(--color-surface-alt)\" c=\"var(--color-primary-light)\" d=\"var(--color-primary-dark)\"");
  assert.equal(h, "fill=\"#FFFFFF\" stroke=\"#B05C36\" bg=\"#F5F5F5\" c=\"#C97C52\" d=\"#8A4325\"");
  assert.notEqual(v, h);
  // 매핑 표 전수: var 모드 값은 전부 var(--color-…) 형태, hex 모드 값은 6자리 hex
  for (const [from, to] of Object.entries(HEX_MAP)) {
    assert.match(from, /^#[0-9A-F]{6}$/, `키는 대문자 6자리 hex: ${from}`);
    assert.match(to.var, /^var\(--color-[a-z0-9-]+\)$/, `var 값 형식: ${from}`);
    assert.match(to.hex, /^#[0-9A-F]{6}$/, `hex 값 형식: ${from}`);
  }
});

test("(e-2) 시빅 잉크·라임 값은 매핑에 없다", () => {
  const targets = Object.values(HEX_MAP).map((t) => t.hex);
  for (const bad of ["#111111", "#000000", "#333333", "#C8FF00", "#D4FF3A"]) {
    assert.ok(!targets.includes(bad), `시빅 색 ${bad} 재사용 금지`);
  }
});

test("(f) report — 허용 목록·제외 경로를 뺀다", () => {
  const src = "#FEE500 #03C75A #fee500 #B05C36 #B05C36 #191919 #19191940 #ZZZZZZ";
  const r = reportHex(src);
  assert.deepEqual(r, { "#B05C36": 2, "#191919": 2 });
  assert.deepEqual(REPORT_ALLOW.map((s) => s.toUpperCase()).sort(), ["#03C75A", "#FEE500"]);
  assert.equal(isReportExcluded("app/opengraph-image.tsx"), true);
  assert.equal(isReportExcluded("app/cats/[id]/opengraph-image.tsx"), true);
  assert.equal(isReportExcluded(["C:", "x", "city", "app", "shop", "opengraph-image.tsx"].join("\\")), true);
  assert.equal(isReportExcluded("lib/cat-art.ts"), true);
  assert.equal(isReportExcluded(["C:", "x", "city", "lib", "cat-art.ts"].join("\\")), true);
  assert.equal(isReportExcluded("app/globals.css"), true, "토큰 정의 자체는 잔여 hex 집계에서 제외");
  assert.equal(isReportExcluded("app/page.tsx"), false);
  assert.equal(isReportExcluded("lib/cat-art-extra.ts"), false);
});

test("(g) globals.css 는 치환 대상에서 제외", () => {
  assert.equal(isSwapExcluded("app/globals.css"), true);
  assert.equal(isSwapExcluded(["C:", "x", "city", "app", "globals.css"].join("\\")), true);
  assert.equal(isSwapExcluded("app/page.tsx"), false);
  assert.equal(isSwapExcluded("app/shop/globals.css.bak"), false);
});

test("(h) 변경 없는 입력은 count 0, 원문 그대로", () => {
  const src = "const a = 'rounded-full #B05C36 rgba(176,92,54,0.1)';";
  const r = swapText(src, { mode: "var" });
  assert.equal(r.out, src);
  assert.equal(r.count, 0);
});

test("(i) 알 수 없는 mode 는 예외", () => {
  assert.throws(() => swapText("#FAF6F0", { mode: "rgb" }));
});
