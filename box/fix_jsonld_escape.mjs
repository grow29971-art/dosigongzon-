// JSON-LD XSS 이스케이프 픽스 — perl 일괄치환 사고 복구용
// 파일에 `replace(/</g, "<")` (1개 백슬래시) → `replace(/</g, "\\u003c")` (2개)
// JS 런타임에 실제 6글자 문자열 <가 되도록.
//
// 사용: cd ~/city && node box/fix_jsonld_escape.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "app");

// 정확한 매칭 대상 (1개 백슬래시 버전)
const BROKEN = `.replace(/</g, "\\u003c")`;
// 올바른 버전 (2개 백슬래시 — JS 소스에서 \\ → 런타임 \)
const FIXED = `.replace(/</g, "\\\\u003c")`;

let fixedFiles = 0;
let totalReplacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fp);
    } else if (entry.name.endsWith(".tsx")) {
      const content = fs.readFileSync(fp, "utf8");
      if (!content.includes(BROKEN)) continue;
      const count = content.split(BROKEN).length - 1;
      const next = content.split(BROKEN).join(FIXED);
      fs.writeFileSync(fp, next);
      fixedFiles += 1;
      totalReplacements += count;
      console.log(`  ${count}× ${path.relative(ROOT, fp)}`);
    }
  }
}

walk(ROOT);
console.log(`\nFixed ${totalReplacements} occurrences across ${fixedFiles} files.`);
