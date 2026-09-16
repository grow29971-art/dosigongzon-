// 디자인 토큰 회귀 가드 — node --test tests/design-tokens.test.mjs
// 2026-09-16 리디자인 「익숙한 동네앱」(결정 0007) 기준선. app/globals.css·app/layout.tsx·public/manifest.json을
// 텍스트로 읽어 다음을 고정한다:
//   1. 아이보리 바탕·세리프 서체·.theme-mono 스코프가 되살아나지 않는다
//   2. primary 테라코타 #B05C36 유지, 카드·시트 라운드 상한 12px
//   3. 자동 다크닝 방어(color-scheme: light dark) 유지
//   4. 본문 텍스트 토큰 3종은 흰 바탕 대비 WCAG AA(4.5:1) 이상
//   5. layout.tsx에 Noto Serif 로딩 없음, manifest theme_color 순백
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));

/** `--name: value;` 형태의 토큰 값을 globals.css에서 읽는다 (첫 정의 기준). */
function token(name) {
  const m = css.match(new RegExp(`${name.replace(/[-]/g, "\-")}:\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

/** WCAG 2.x 상대 휘도 — sRGB 6자리 hex 전용 */
function luminance(hex) {
  const h = hex.replace("#", "");
  assert.equal(h.length, 6, `6자리 hex여야 함: ${hex}`);
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrastOnWhite(hex) {
  const l = luminance(hex);
  return (1 + 0.05) / (l + 0.05);
}

test("(a) 아이보리·세리프·theme-mono 잔재 없음", () => {
  for (const s of ["#FAF6F0", "#FFFDF9", "#F3EEE5", "Noto Serif", "--font-serif", ".theme-mono"]) {
    assert.ok(!css.toUpperCase().includes(s.toUpperCase()), `globals.css에 "${s}" 가 남아 있음`);
  }
});

test("(b) primary 테라코타 유지", () => {
  assert.equal(token("--color-primary")?.toUpperCase(), "#B05C36");
});

test("(c) 라운드 상한 — card·sheet 12px", () => {
  assert.equal(token("--radius-card"), "12px");
  assert.equal(token("--radius-sheet"), "12px");
});

test("(d) 자동 다크닝 방어 선언 유지", () => {
  assert.ok(/color-scheme:\s*light dark/.test(css), "html { color-scheme: light dark } 필요");
});

test("(e) 본문 텍스트 토큰 3종 흰 바탕 대비 4.5:1 이상", () => {
  for (const name of ["--color-text-main", "--color-text-sub", "--color-text-light"]) {
    const v = token(name);
    assert.ok(v, `${name} 토큰 없음`);
    const ratio = contrastOnWhite(v);
    assert.ok(ratio >= 4.5, `${name}=${v} 대비 ${ratio.toFixed(2)} < 4.5`);
  }
  // 자기 검증: 계산식이 순백/순흑에서 21을 내는지
  assert.ok(Math.abs(contrastOnWhite("#000000") - 21) < 0.01);
});

test("(f) layout.tsx에 noto-serif 없음 · manifest theme_color 순백", () => {
  assert.ok(!layout.toLowerCase().includes("noto-serif"), "layout.tsx에 Noto Serif 링크가 남아 있음");
  assert.equal(manifest.theme_color.toUpperCase(), "#FFFFFF");
  assert.equal(manifest.background_color.toUpperCase(), "#FFFFFF");
  assert.match(layout, /themeColor:\s*"#FFFFFF"/);
});
