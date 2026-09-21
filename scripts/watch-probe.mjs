// 감시 루프 — 쓰기 없는 자율 점검 (2026-09-07)
// 목적: 코드를 고치지 않고 "상태를 재고 기록만" 한다. 보안 계약·크론 결행·사이트·배포·지표.
// 실행: node scripts/watch-probe.mjs            (리포 루트에서, .env.local 필요)
// 출력: docs/tracking/watch/YYYY-MM-DD.md (옵시디언 볼트용, git 추적 안 함) + 콘솔 요약
// 종료코드: FAIL 1건 이상이면 1 (작업 스케줄러 "마지막 실행 결과"로 식별)
// 스케줄: Windows 작업 스케줄러 "city-watch-probe" 매일 09:30 (docs/operations.md 감시 절)
//
// 규칙: service_role 키는 이 프로세스 밖으로 나가지 않는다(리포트에 키·행 내용 미기재, 카운트만).
//       프로브는 anon/service 이중 — 권한 차이가 곧 버그의 원인인 경우가 많다(engineering-notes).

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SITE = "https://dosigongzon.com";
const GH_REPO = "grow29971-art/dosigongzon-";
const KST_OFFSET_MS = 9 * 3600 * 1000;

// ── .env.local 파싱 (따옴표·\n 혼입 제거 — engineering-notes 함정) ──
function loadEnv() {
  const p = resolve(ROOT, ".env.local");
  if (!existsSync(p)) throw new Error(".env.local 없음");
  const env = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "").trim();
  }
  return env;
}
const env = loadEnv();
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !ANON || !SERVICE) throw new Error("Supabase URL/ANON/SERVICE 키 누락");

// ── 결과 수집 ──
const results = []; // {area, name, status: PASS|FAIL|WARN|INFO, detail}
const add = (area, name, status, detail = "") => results.push({ area, name, status, detail });

async function rest(path, key, { method = "GET", headers = {} } = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, authorization: `Bearer ${key}`, ...headers },
  });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body, range: r.headers.get("content-range") };
}
async function count(path, key) {
  const r = await rest(path, key, { method: "HEAD", headers: { prefer: "count=exact" } });
  const n = r.range ? Number(r.range.split("/")[1]) : null;
  return { status: r.status, n };
}
const rowsOf = (r) => (Array.isArray(r.body) ? r.body.length : null);
const pgCode = (r) => (r.body && typeof r.body === "object" && r.body.code) || "";

// ── 1. 보안 계약 (anon) ──
async function securityProbes() {
  const area = "보안";
  // profiles 잠금: anon base profiles 0행 (2026-08-03 검증 기준)
  {
    const r = await rest("profiles?select=id&limit=5", ANON);
    const n = rowsOf(r);
    if (r.status === 200 && n === 0) add(area, "anon base profiles 0행", "PASS");
    else if (r.status >= 400) add(area, "anon base profiles 0행", "PASS", `거부(${r.status} ${pgCode(r)})`);
    else add(area, "anon base profiles 0행", "FAIL", `anon이 ${n}행 조회됨 — 프로필 잠금 회귀`);
  }
  // 좌표 컬럼: anon base cats lat/lng 거부
  {
    const r = await rest("cats?select=id,lat,lng&limit=1", ANON);
    if (r.status === 200 && rowsOf(r) > 0) add(area, "anon base cats lat/lng 거부", "FAIL", "anon이 base cats 좌표 컬럼을 읽음 — 위치 계약 위반");
    else add(area, "anon base cats lat/lng 거부", "PASS", `${r.status} ${pgCode(r)}`);
  }
  // 공개 지도 뷰는 anon에 살아 있어야 함 (거부되면 비로그인 지도 사망)
  {
    const r = await count("cats_public_map?select=id", ANON);
    if (r.status < 400 && r.n > 0) add(area, "anon cats_public_map 조회 가능", "PASS", `${r.n}행`);
    else add(area, "anon cats_public_map 조회 가능", "FAIL", `status ${r.status}, count ${r.n} — 비로그인 지도 데이터 소스 사망`);
  }
  // 학대 제보: anon 0행
  {
    const r = await rest("zone_reports?select=id&limit=5", ANON);
    const n = rowsOf(r);
    if (r.status >= 400 || n === 0) add(area, "anon zone_reports 0행", "PASS", `${r.status} ${pgCode(r)}`);
    else add(area, "anon zone_reports 0행", "FAIL", `anon이 ${n}행 조회됨`);
  }
  // 크론 하트비트 테이블: anon 차단
  {
    const r = await rest("cron_runs?select=id&limit=1", ANON);
    const n = rowsOf(r);
    if (r.status >= 400 || n === 0) add(area, "anon cron_runs 차단", "PASS", `${r.status} ${pgCode(r)}`);
    else add(area, "anon cron_runs 차단", "FAIL", `anon이 ${n}행 조회됨`);
  }
  // 로그인 실패 로그·퍼널: anon 읽기 0행
  for (const t of ["auth_error_logs", "funnel_events", "orders"]) {
    const r = await rest(`${t}?select=id&limit=1`, ANON);
    const n = rowsOf(r);
    if (r.status >= 400 || n === 0) add(area, `anon ${t} 0행`, "PASS", `${r.status} ${pgCode(r)}`);
    else add(area, `anon ${t} 0행`, "FAIL", `anon이 ${n}행 조회됨`);
  }
  // service 키 자체 생존(만료·회전 감지) — 이게 죽으면 이하 크론·지표 판정 무의미
  {
    const r = await count("profiles?select=id", SERVICE);
    if (r.status < 400 && r.n > 0) add(area, "service 키 유효", "PASS", `profiles ${r.n}`);
    else add(area, "service 키 유효", "FAIL", `status ${r.status}`);
  }
}

// ── 2. 크론 하트비트 (service, cron_runs) ──
// 기대 주기: vercel.json 16개 + 디스패처 서브잡(daily-dispatch 5·요일별 2·weekly-dispatch 2)
function loadCronExpectations() {
  const vercel = JSON.parse(readFileSync(resolve(ROOT, "vercel.json"), "utf8"));
  const list = [];
  for (const c of vercel.crons) {
    const name = c.path.replace("/api/cron/", "");
    const [min, hour, , , dow] = c.schedule.split(" ");
    list.push({ name, min: Number(min), hour: Number(hour), dow: dow === "*" ? null : dow.split(",").map(Number) });
  }
  // daily-dispatch 서브잡 (00:00 UTC)
  for (const n of ["news-crawl", "admin-daily-digest", "payment-reconcile", "weather-alert", "fund-snapshot"])
    list.push({ name: n, min: 0, hour: 0, dow: null, via: "daily-dispatch" });
  // KST 요일별: 수요일 engagement-push, 토요일 onboarding-nudge → UTC 00:00 기준 같은 날
  list.push({ name: "engagement-push", min: 0, hour: 0, dow: [3], via: "daily-dispatch" });
  list.push({ name: "onboarding-nudge", min: 0, hour: 0, dow: [6], via: "daily-dispatch" });
  // weekly-dispatch 서브잡 (일 23:00 UTC). weekly-digest는 2026-09-19 회의로 발송 보류(디스패처 배열에서 제외) —
  // 재동의 UI 후 복원 시 여기도 "weekly-digest" 복원.
  for (const n of ["retention-report"])
    list.push({ name: n, min: 0, hour: 23, dow: [0], via: "weekly-dispatch" });
  return list;
}
// 마지막으로 "실행됐어야 할" UTC 시각 계산 (now 이전 가장 최근 스케줄 발화점)
function lastDue({ min, hour, dow }, now) {
  for (let d = 0; d < 9; d++) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d, hour, min));
    if (t > now) continue;
    if (dow && !dow.includes(t.getUTCDay())) continue;
    return t;
  }
  return null;
}
async function cronProbes() {
  const area = "크론";
  const now = new Date();
  const since = new Date(now.getTime() - 9 * 86400 * 1000).toISOString();
  const r = await rest(`cron_runs?select=name,ran_at&ran_at=gte.${since}&order=ran_at.desc&limit=2000`, SERVICE);
  if (r.status >= 400 || !Array.isArray(r.body)) {
    add(area, "cron_runs 조회", "FAIL", `status ${r.status} ${pgCode(r)}`);
    return;
  }
  const lastRun = new Map();
  for (const row of r.body) if (!lastRun.has(row.name)) lastRun.set(row.name, new Date(row.ran_at));
  const GRACE_MS = 90 * 60 * 1000; // Vercel cron 지연 여유 90분
  for (const c of loadCronExpectations()) {
    const due = lastDue(c, now);
    const ran = lastRun.get(c.name);
    const label = `${c.name}${c.via ? ` (via ${c.via})` : ""}`;
    if (!due) { add(area, label, "INFO", "판정 창 밖"); continue; }
    // 발화점 + 여유가 아직 안 지났으면 직전 주기로 판정
    const judgeAt = now.getTime() - due.getTime() < GRACE_MS ? lastDue(c, new Date(due.getTime() - 60000)) : due;
    if (!judgeAt) { add(area, label, "INFO", "판정 창 밖"); continue; }
    const kst = (d) => new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ") + " KST";
    if (ran && ran >= judgeAt) add(area, label, "PASS", `마지막 ${kst(ran)}`);
    else add(area, label, "FAIL", `기대 ${kst(judgeAt)} 이후 하트비트 없음${ran ? ` (마지막 ${kst(ran)})` : " (9일 내 기록 없음)"}`);
  }
}

// ── 3. 사이트·배포 ──
async function siteProbes() {
  const area = "사이트";
  for (const path of ["/", "/map", "/shop"]) {
    try {
      const t0 = Date.now();
      const r = await fetch(SITE + path, { redirect: "follow", headers: { "user-agent": "city-watch-probe" } });
      const ms = Date.now() - t0;
      if (r.ok) add(area, `GET ${path}`, ms > 8000 ? "WARN" : "PASS", `${r.status} ${ms}ms`);
      else add(area, `GET ${path}`, "FAIL", `${r.status} ${ms}ms`);
    } catch (e) {
      add(area, `GET ${path}`, "FAIL", String(e.message || e));
    }
  }
  try {
    const head = await fetch(`https://api.github.com/repos/${GH_REPO}/commits/main`, { headers: { "user-agent": "city-watch-probe", accept: "application/vnd.github+json" } });
    const sha = (await head.json()).sha;
    const st = await fetch(`https://api.github.com/repos/${GH_REPO}/commits/${sha}/status`, { headers: { "user-agent": "city-watch-probe", accept: "application/vnd.github+json" } });
    const state = (await st.json()).state;
    if (state === "success") add(area, "main 최신 커밋 배포 상태", "PASS", `${sha.slice(0, 7)} ${state}`);
    else if (state === "pending") add(area, "main 최신 커밋 배포 상태", "WARN", `${sha.slice(0, 7)} ${state}`);
    else add(area, "main 최신 커밋 배포 상태", "FAIL", `${sha.slice(0, 7)} ${state}`);
  } catch (e) {
    add(area, "main 최신 커밋 배포 상태", "WARN", `GitHub 조회 실패: ${e.message}`);
  }
}

// ── 4. 지표 (INFO — 판정 아님, 추세용) ──
async function metricProbes() {
  const area = "지표";
  const now = new Date();
  const kstMidnight = new Date(Math.floor((now.getTime() + KST_OFFSET_MS) / 86400000) * 86400000 - KST_OFFSET_MS);
  const d1 = new Date(kstMidnight.getTime() - 86400000).toISOString();
  const d7 = new Date(kstMidnight.getTime() - 7 * 86400000).toISOString();
  const q = async (label, path) => {
    const r = await count(path, SERVICE);
    add(area, label, r.status < 400 ? "INFO" : "WARN", r.status < 400 ? String(r.n) : `status ${r.status}`);
  };
  await q("가입 어제(KST)", `profiles?select=id&created_at=gte.${d1}&created_at=lt.${kstMidnight.toISOString()}`);
  await q("가입 7일", `profiles?select=id&created_at=gte.${d7}`);
  await q("케어 기록 어제(KST)", `care_logs?select=id&logged_at=gte.${d1}&logged_at=lt.${kstMidnight.toISOString()}`);
  await q("케어 기록 7일", `care_logs?select=id&logged_at=gte.${d7}`);
  await q("로그인 실패 로그 7일", `auth_error_logs?select=id&created_at=gte.${d7}`);
  await q("미처리 신고(reports pending)", `reports?select=id&status=eq.pending`);
  await q("미처리 문의(inquiries pending)", `inquiries?select=id&status=eq.pending`);
}

// ── 실행 ──
for (const fn of [securityProbes, cronProbes, siteProbes, metricProbes]) {
  try { await fn(); } catch (e) { add(fn.name, "실행 예외", "FAIL", String(e.message || e)); }
}

const nowKst = new Date(Date.now() + KST_OFFSET_MS);
const dateStr = nowKst.toISOString().slice(0, 10);
const timeStr = nowKst.toISOString().slice(11, 16);
const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
const icon = { PASS: "✅", FAIL: "❌", WARN: "⚠️", INFO: "·" };

let md = `# 감시 ${dateStr} ${timeStr} KST\n\n`;
md += `판정: ${fails.length ? `**FAIL ${fails.length}건**` : "이상 없음"}${warns.length ? ` · WARN ${warns.length}건` : ""}\n\n`;
if (fails.length) {
  md += `## 이상\n\n`;
  for (const r of fails) md += `- ❌ [${r.area}] ${r.name} — ${r.detail}\n`;
  md += `\n> 새로 나타난 이상이면 [[findings]]에 조건·영향·미해결 이유와 함께 기록한다.\n\n`;
}
for (const area of ["보안", "크론", "사이트", "지표"]) {
  md += `## ${area}\n\n`;
  for (const r of results.filter((x) => x.area === area)) md += `- ${icon[r.status]} ${r.name}${r.detail ? ` — ${r.detail}` : ""}\n`;
  md += `\n`;
}
md += `---\n생성: scripts/watch-probe.mjs · 이전: [[${new Date(nowKst.getTime() - 86400000).toISOString().slice(0, 10)}]]\n`;

const outDir = resolve(ROOT, "docs/tracking/watch");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, `${dateStr}.md`), md, "utf8");
writeFileSync(resolve(outDir, "latest.md"), md, "utf8");

console.log(`[watch] ${dateStr} ${timeStr} KST — FAIL ${fails.length} / WARN ${warns.length} / 총 ${results.length}`);
for (const r of [...fails, ...warns]) console.log(`  ${icon[r.status]} [${r.area}] ${r.name} — ${r.detail}`);
console.log(`  → docs/tracking/watch/${dateStr}.md`);
process.exit(fails.length ? 1 : 0);
