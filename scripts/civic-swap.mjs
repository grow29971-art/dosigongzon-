// 시빅 포스터(대안 C) — 하드코딩 웜 뉴트럴/테라코타 hex 일괄 잉크·뉴트럴 전환 (2026-09-16)
// warm-swap 패턴: 색→색 리터럴 치환이라 style·SVG·canvas·OG 이미지 어디서든 안전.
// 알파 접미사 결합(#B05C3615 등)도 앞 6자리만 바뀌어 그대로 동작한다.
// 대상: app/·lib/ 의 .ts/.tsx (globals.css는 별도 커밋에서 수동 교체). 롤백은 이 커밋 revert.
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const MAP = [
  // 테라코타 계열 → 잉크
  ["#B05C36", "#111111"], ["#C97C52", "#333333"], ["#8A4325", "#000000"],
  // 웜 뉴트럴 → 뉴트럴 (globals.css 새 스케일과 동일 값)
  ["#FAF6F0", "#FFFFFF"], ["#FFFDF9", "#FFFFFF"], ["#F3EEE5", "#F2F2F2"],
  ["#E9E2D8", "#E0E0E0"], ["#F0EAE0", "#EBEBEB"], ["#D8CFC1", "#CFCFCF"],
  ["#C0B7A9", "#B5B5B5"], ["#A39A8D", "#8A8A8A"], ["#857C6E", "#6B6B6B"],
  ["#5D564B", "#555555"], ["#3A342B", "#2A2A2A"], ["#211D17", "#111111"],
  // rgba 형태 (r,g,b 프리픽스만 — 알파는 보존)
  ["rgba(176,92,54", "rgba(17,17,17"], ["rgba(176, 92, 54", "rgba(17, 17, 17"],
  ["rgba(250,246,240", "rgba(255,255,255"], ["rgba(250, 246, 240", "rgba(255, 255, 255"],
  ["rgba(33,29,23", "rgba(17,17,17"], ["rgba(33, 29, 23", "rgba(17, 17, 17"],
  ["rgba(93,86,75", "rgba(85,85,85"], ["rgba(93, 86, 75", "rgba(85, 85, 85"],
  ["rgba(163,154,141", "rgba(138,138,138"], ["rgba(163, 154, 141", "rgba(138, 138, 138"],
  ["rgba(233,226,216", "rgba(224,224,224"], ["rgba(233, 226, 216", "rgba(224, 224, 224"],
  ["rgba(243,238,229", "rgba(242,242,242"], ["rgba(243, 238, 229", "rgba(242, 242, 242"],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walk(p);
    } else if (/\.(tsx|ts)$/.test(name)) {
      yield p;
    }
  }
}

let filesChanged = 0, total = 0;
for (const root of ["app", "lib"]) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    let out = src;
    let n = 0;
    for (const [from, to] of MAP) {
      const variants = from.startsWith("#") ? [from, from.toLowerCase()] : [from];
      for (const v of variants) {
        const parts = out.split(v);
        n += parts.length - 1;
        out = parts.join(to);
      }
    }
    if (out !== src) {
      writeFileSync(file, out, "utf8");
      filesChanged++;
      total += n;
    }
  }
}
console.log(`done: ${filesChanged} files, ${total} replacements`);
