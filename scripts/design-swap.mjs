// 리디자인 「익숙한 동네앱」(결정 0007) — 구 아이보리·웜 브라운 hex → 새 뉴트럴 토큰 치환 도구 (2026-09-16)
//
// 사용법:
//   node scripts/design-swap.mjs <경로...> [--mode=var|hex] [--report] [--dry]
//     경로     파일 또는 디렉터리(재귀, .ts/.tsx/.css). app/globals.css·node_modules·.next 는 항상 제외.
//     --mode   var(기본): 6자리 hex → CSS 토큰 참조 var(--color-…)
//              hex      : 6자리 hex → 새 스케일 hex (SVG 문자열·canvas·<meta>·opengraph-image 등 var() 불가 문맥용)
//     --report 치환하지 않고, 남아 있는 hex 리터럴을 파일별로 집계 출력(허용 목록·제외 경로 제외)
//     --dry    치환하지 않고, 파일별 변경 예정 건수만 출력
//
// 치환 규칙(모드 무관하게 항상 적용되는 것 포함):
//   1. 6자리 hex(대소문자 무시) → 모드에 따라 var() 또는 새 hex
//   2. 알파 접미사 결합 8자리 hex(#211D1740 등)는 var() 불가 → 항상 새 hex + 접미사 보존(#19191940)
//   3. rgba(r,g,b 프리픽스 → 새 값, 알파·공백 스타일 보존. primary rgba(176,92,54 는 유지
//   4. Tailwind 라운드 강등: rounded-2xl/3xl/4xl(방향 변형 포함) → -xl. rounded-full 유지
//
// warm-swap/civic-swap 의 리터럴 치환 패턴을 계승하되 매핑 값은 globals.css 2026-09-16 기준선.
// 롤백: 도구를 돌린 커밋을 revert (기준선 방식). 이 파일 자체는 앱 코드를 건드리지 않는다.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** 구 6자리 hex(대문자 키) → { var: 토큰 참조, hex: 새 스케일 hex }. 알파 접미사 결합 시에는 hex 값이 쓰인다. */
export const HEX_MAP = Object.freeze({
  // 구 아이보리·웜 뉴트럴 → 뉴트럴 그레이
  "#FAF6F0": { var: "var(--color-surface)", hex: "#FFFFFF" },
  "#FFFDF9": { var: "var(--color-surface)", hex: "#FFFFFF" },
  "#F3EEE5": { var: "var(--color-surface-alt)", hex: "#F5F5F5" },
  "#E9E2D8": { var: "var(--color-border)", hex: "#E8E8E8" },
  "#F0EAE0": { var: "var(--color-divider)", hex: "#EFEFEF" },
  "#D8CFC1": { var: "var(--color-gray-300)", hex: "#D9D9D9" },
  "#C0B7A9": { var: "var(--color-gray-400)", hex: "#BDBDBD" },
  "#A39A8D": { var: "var(--color-text-light)", hex: "#767676" },
  "#857C6E": { var: "var(--color-gray-600)", hex: "#5E5E5E" },
  "#5D564B": { var: "var(--color-text-sub)", hex: "#4B4B4B" },
  "#3A342B": { var: "var(--color-gray-800)", hex: "#2E2E2E" },
  "#211D17": { var: "var(--color-text-main)", hex: "#191919" },
  // 구 테라코타 파생 → primary 토큰 (hex 모드 값은 globals.css 현행값)
  "#AD5E3B": { var: "var(--color-primary)", hex: "#B05C36" },
  "#C97C52": { var: "var(--color-primary-light)", hex: "#C97C52" },
  "#8A4325": { var: "var(--color-primary-dark)", hex: "#8A4325" },
});

/** rgba 프리픽스 [r,g,b] → [R,G,B]. 알파·공백은 보존. primary(176,92,54)는 포함하지 않는다. */
export const RGBA_MAP = Object.freeze([
  [[250, 246, 240], [255, 255, 255]],
  [[33, 29, 23], [25, 25, 25]],
  [[93, 86, 75], [75, 75, 75]],
  [[163, 154, 141], [118, 118, 118]],
  [[233, 226, 216], [232, 232, 232]],
  [[243, 238, 229], [245, 245, 245]],
]);

/** --report 에서 제외할 hex(브랜드 색: 카카오 노랑·네이버 초록). */
export const REPORT_ALLOW = Object.freeze(["#FEE500", "#03C75A"]);

/** 치환 대상에서 제외할 경로 (토큰 정의 자체). */
const SWAP_EXCLUDE = [/(^|[\\/])app[\\/]globals\.css$/];
/** --report 에서 제외할 경로 (hex 필수 문맥 + 토큰 정의 자체). */
const REPORT_EXCLUDE = [
  /(^|[\\/])opengraph-image\.tsx$/,
  /(^|[\\/])lib[\\/]cat-art\.ts$/,
  // 잔존 허용(리디자인 spec): meta theme-color는 var() 불가, darkcheck는 다크닝 점검용 리터럴,
  // api 아래 이메일 HTML 템플릿은 이번 범위 제외(후속)
  /(^|[\\/])app[\\/]layout\.tsx$/,
  /(^|[\\/])app[\\/]darkcheck[\\/]/,
  /(^|[\\/])app[\\/]api[\\/]/,
  ...SWAP_EXCLUDE,
];

export const MODES = Object.freeze(["var", "hex"]);

const RGBA_LOOKUP = new Map(RGBA_MAP.map(([from, to]) => [from.join(","), to]));

// 6자리 hex + 선택적 2자리 알파, 뒤에 영숫자가 이어지면 더 긴 문자열이므로 제외
const HEX_RE = /#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-zA-Z])/g;
// rgba( r , g , b  — 공백 그룹을 캡처해 스타일 보존
const RGBA_RE = /rgba\((\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})/g;
// rounded[-방향]-(2xl|3xl|4xl) — 앞뒤 경계는 클래스 문자열 토큰 기준
const ROUNDED_RE = /(?<![\w-])rounded(-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-(?:2|3|4)xl(?![\w-])/g;

export function isReportExcluded(filePath) {
  return REPORT_EXCLUDE.some((re) => re.test(filePath));
}

export function isSwapExcluded(filePath) {
  return SWAP_EXCLUDE.some((re) => re.test(filePath));
}

/**
 * 순수 함수: 문자열 하나를 치환한다.
 * @param {string} src
 * @param {{ mode?: "var" | "hex" }} [opts]
 * @returns {{ out: string, count: number }}
 */
export function swapText(src, opts = {}) {
  const mode = opts.mode ?? "var";
  if (!MODES.includes(mode)) throw new Error(`알 수 없는 mode: ${mode} (var|hex)`);
  let count = 0;

  let out = src.replace(HEX_RE, (m, base, alpha) => {
    const entry = HEX_MAP[`#${base.toUpperCase()}`];
    if (!entry) return m;
    const next = alpha ? `${entry.hex}${alpha}` : entry[mode];
    if (next === m) return m;
    count++;
    return next;
  });

  out = out.replace(RGBA_RE, (m, ws0, r, ws1, g, ws2, b) => {
    const to = RGBA_LOOKUP.get(`${Number(r)},${Number(g)},${Number(b)}`);
    if (!to) return m;
    count++;
    return `rgba(${ws0}${to[0]}${ws1}${to[1]}${ws2}${to[2]}`;
  });

  out = out.replace(ROUNDED_RE, (_m, dir = "") => {
    count++;
    return `rounded${dir}-xl`;
  });

  return { out, count };
}

/**
 * 순수 함수: 남아 있는 hex 리터럴을 집계한다(대문자 6자리 기준, 알파 접미사 결합도 앞 6자리로 합산).
 * 허용 목록은 제외. 경로 제외는 호출자가 isReportExcluded 로 판단한다.
 * @param {string} src
 * @returns {Record<string, number>}
 */
export function reportHex(src) {
  const allow = new Set(REPORT_ALLOW.map((s) => s.toUpperCase()));
  const counts = {};
  for (const m of src.matchAll(HEX_RE)) {
    const key = `#${m[1].toUpperCase()}`;
    if (allow.has(key)) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// CLI

const TARGET_EXT = /\.(tsx|ts|css)$/;

function* walk(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) {
      if (name === "node_modules" || name === ".next" || name === ".git") continue;
      yield* walk(join(p, name));
    }
  } else if (TARGET_EXT.test(p)) {
    yield p;
  }
}

function parseArgs(argv) {
  const opts = { mode: "var", report: false, dry: false, paths: [] };
  for (const a of argv) {
    if (a.startsWith("--mode=")) opts.mode = a.slice("--mode=".length);
    else if (a === "--report") opts.report = true;
    else if (a === "--dry") opts.dry = true;
    else if (a.startsWith("--")) throw new Error(`알 수 없는 옵션: ${a}`);
    else opts.paths.push(a);
  }
  if (!MODES.includes(opts.mode)) throw new Error(`--mode 는 var|hex 중 하나: ${opts.mode}`);
  if (opts.paths.length === 0) throw new Error("경로를 하나 이상 지정하세요");
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);
  const cwd = process.cwd();
  const files = [];
  for (const p of opts.paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new Error(`경로 없음: ${p}`);
    for (const f of walk(abs)) files.push(f);
  }
  const rel = (f) => (f.startsWith(cwd + sep) ? f.slice(cwd.length + 1) : f).split(sep).join("/");

  if (opts.report) {
    const totals = {};
    let filesWith = 0;
    for (const f of files) {
      if (isReportExcluded(f)) continue;
      const counts = reportHex(readFileSync(f, "utf8"));
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) continue;
      filesWith++;
      console.log(`${rel(f)}: ${entries.map(([h, n]) => `${h}x${n}`).join(" ")}`);
      for (const [h, n] of entries) totals[h] = (totals[h] ?? 0) + n;
    }
    const sum = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    console.log(`--- ${filesWith} files, ${sum.reduce((s, [, n]) => s + n, 0)} literals`);
    for (const [h, n] of sum) console.log(`  ${h} x${n}`);
    return;
  }

  let filesChanged = 0, total = 0;
  for (const f of files) {
    if (isSwapExcluded(f)) continue;
    const src = readFileSync(f, "utf8");
    const { out, count } = swapText(src, { mode: opts.mode });
    if (count === 0 || out === src) continue;
    filesChanged++;
    total += count;
    console.log(`${rel(f)}: ${count}`);
    if (!opts.dry) writeFileSync(f, out, "utf8");
  }
  console.log(`${opts.dry ? "dry" : "done"} (mode=${opts.mode}): ${filesChanged} files, ${total} replacements`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
