// D 아이보리 에디토리얼 — 하드코딩 뉴트럴/테라코타 hex 일괄 웜 전환 (2026-08-26)
// terra-swap 패턴: 색→색 리터럴 치환이라 style·SVG·canvas 어디서든 안전.
// 대상: app/·lib/ 의 .ts/.tsx. 롤백은 이 커밋 revert (기준선 방식).
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const MAP = [
  // 뉴트럴 그레이 → 웜 그레이 (globals.css 새 스케일과 동일 값)
  ["#191F28", "#211D17"], ["#333D4B", "#3A342B"], ["#4E5968", "#5D564B"],
  ["#6B7684", "#857C6E"], ["#8B95A1", "#A39A8D"], ["#B0B8C1", "#C0B7A9"],
  ["#D1D6DB", "#D8CFC1"], ["#E5E8EB", "#E9E2D8"], ["#F2F4F6", "#F3EEE5"],
  ["#F9FAFB", "#FAF6F0"],
  // 구 테라코타 → 딥 테라코타
  ["#AD5E3B", "#B05C36"], ["#C47E5A", "#C97C52"],
  // rgba 형태 (r,g,b 프리픽스만 — 알파는 보존)
  ["rgba(25,31,40", "rgba(33,29,23"], ["rgba(25, 31, 40", "rgba(33, 29, 23"],
  ["rgba(78,89,104", "rgba(93,86,75"], ["rgba(78, 89, 104", "rgba(93, 86, 75"],
  ["rgba(139,149,161", "rgba(163,154,141"], ["rgba(139, 149, 161", "rgba(163, 154, 141"],
  ["rgba(229,232,235", "rgba(233,226,216"], ["rgba(229, 232, 235", "rgba(233, 226, 216"],
  ["rgba(242,244,246", "rgba(243,238,229"], ["rgba(242, 244, 246", "rgba(243, 238, 229"],
  ["rgba(249,250,251", "rgba(250,246,240"], ["rgba(249, 250, 251", "rgba(250, 246, 240"],
  ["rgba(173,94,59", "rgba(176,92,54"], ["rgba(173, 94, 59", "rgba(176, 92, 54"],
  ["rgba(196,126,90", "rgba(201,124,82"], ["rgba(196, 126, 90", "rgba(201, 124, 82"],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      yield* walk(p);
    } else if (/\.(tsx|ts|css)$/.test(name)) {
      yield p;
    }
  }
}

let filesChanged = 0, total = 0;
for (const root of ["app", "lib"]) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    let out = src;
    for (const [from, to] of MAP) {
      out = out.split(from).join(to);
      // 소문자 hex 변형도 처리
      if (from.startsWith("#")) out = out.split(from.toLowerCase()).join(to);
    }
    if (out !== src) {
      const n = MAP.reduce((s, [f]) => s + (src.split(f).length - 1) + (f.startsWith("#") ? src.split(f.toLowerCase()).length - 1 : 0), 0);
      writeFileSync(file, out, "utf8");
      filesChanged++;
      total += n;
    }
  }
}
console.log(`done: ${filesChanged} files, ~${total} replacements`);
