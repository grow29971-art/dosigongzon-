// Day0 활성화 재측정 — 읽기 전용(SELECT만). 실행: node scripts/measure-activation.mjs [YYYY-MM-DD 경계]
// 9/2 기준선(개발일지_20260902): 가입 93·Day0 첫밥 7.5%·픽 4.7%(상세 274뷰→13). 스포트라이트·하트·CTA 개인화가
// 9/2 투입됐으므로 "투입 전(8/19~9/1) vs 투입 후(9/3~오늘)"을 같은 정의로 비교한다.
//  · 가입: profiles.created_at
//  · Day0 첫밥: care_logs.author_id의 첫 logged_at이 가입 후 24h 이내
//  · Day0 등록: cats.caretaker_id의 첫 created_at이 가입 후 24h 이내
//  · Day0 하트: cat_likes.user_id의 첫 created_at이 가입 후 24h 이내 (9/2 신설 동선)
//  · 퍼널(기기 단위): funnel_events step별 건수 — detail→pick, signup_view→signup_home, first_feed
// service_role은 이 스크립트(로컬 Node)에서만 쓰고 결과는 숫자 요약만 출력한다(개인 식별 없음).
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "").trim();
}
const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) throw new Error("env 누락");

async function all(path) {
  // 페이지네이션(1000행 상한)
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
const ts = (s) => new Date(s).getTime();
const H24 = 24 * 3600 * 1000;

const SPLIT = process.argv[2] ?? "2026-09-02"; // 투입일(경계, 이 날은 별도 표기)
const PRE_START = "2026-08-19";
const today = new Date();

const [profiles, cares, cats, likes, pushes, funnel] = await Promise.all([
  all(`profiles?select=id,created_at&created_at=gte.${PRE_START}&order=created_at.asc`),
  all(`care_logs?select=author_id,logged_at&logged_at=gte.${PRE_START}&order=logged_at.asc`),
  all(`cats?select=caretaker_id,created_at&caretaker_id=not.is.null&created_at=gte.${PRE_START}&order=created_at.asc`),
  all(`cat_likes?select=user_id,created_at&created_at=gte.${PRE_START}&order=created_at.asc`),
  all(`push_subscriptions?select=user_id,created_at&created_at=gte.${PRE_START}&order=created_at.asc`),
  all(`funnel_events?select=step,created_at&created_at=gte.${PRE_START}&order=created_at.asc`),
]);

// 유저별 첫 행동 시각
const firstOf = (rows, k, t) => { const m = new Map(); for (const r of rows) if (r[k] && !m.has(r[k])) m.set(r[k], ts(r[t])); return m; };
const firstCare = firstOf(cares, "author_id", "logged_at");
const firstCat = firstOf(cats, "caretaker_id", "created_at");
const firstLike = firstOf(likes, "user_id", "created_at");
const firstPush = firstOf(pushes, "user_id", "created_at");

function window_(label, from, to) {
  const f = ts(from), t = ts(to);
  const users = profiles.filter((p) => ts(p.created_at) >= f && ts(p.created_at) < t);
  const n = users.length;
  const d0 = (map) => users.filter((u) => { const x = map.get(u.id); return x !== undefined && x - ts(u.created_at) <= H24; }).length;
  const ever = (map) => users.filter((u) => map.has(u.id)).length;
  const pct = (a) => (n ? `${((100 * a) / n).toFixed(1)}%` : "-");
  const fe = (step) => funnel.filter((e) => e.step === step && ts(e.created_at) >= f && ts(e.created_at) < t).length;
  const detail = fe("cat_detail_view_anon"), pick = fe("onboarding_pick");
  const days = Math.max(1, Math.round((Math.min(t, today.getTime()) - f) / 86400000));
  return {
    구간: label, 일수: days, 가입: n, "가입/일": (n / days).toFixed(1),
    "Day0 첫밥": `${d0(firstCare)} (${pct(d0(firstCare))})`,
    "Day0 등록": `${d0(firstCat)} (${pct(d0(firstCat))})`,
    "Day0 하트": `${d0(firstLike)} (${pct(d0(firstLike))})`,
    "Day0 푸시": `${d0(firstPush)} (${pct(d0(firstPush))})`,
    "첫밥(기간내 언제든)": `${ever(firstCare)} (${pct(ever(firstCare))})`,
    "퍼널 intro": fe("onboarding_intro"), "detail(anon)": detail, pick, "픽률": detail ? `${((100 * pick) / detail).toFixed(1)}%` : "-",
    signup_view: fe("signup_view"), signup_home: fe("signup_home"), first_feed: fe("first_feed"),
  };
}
const splitNext = new Date(ts(SPLIT) + 86400000).toISOString().slice(0, 10);
const rows = [
  window_(`투입 전 ${PRE_START}~${SPLIT}`, PRE_START, SPLIT),
  window_(`투입일 ${SPLIT}`, SPLIT, splitNext),
  window_(`투입 후 ${splitNext}~오늘`, splitNext, new Date(today.getTime() + 86400000).toISOString().slice(0, 10)),
];
console.table(rows);
// 주별 추이(투입 후) — 소표본이라 절대건수
const weekly = {};
for (const u of profiles) {
  if (ts(u.created_at) < ts(splitNext)) continue;
  const wk = new Date(ts(u.created_at)); wk.setUTCHours(0, 0, 0, 0); wk.setUTCDate(wk.getUTCDate() - wk.getUTCDay() + 1);
  const k = wk.toISOString().slice(0, 10);
  weekly[k] ??= { "주(월)": k, 가입: 0, "Day0 첫밥": 0, "Day0 하트": 0 };
  weekly[k].가입++;
  const fc = firstCare.get(u.id); if (fc !== undefined && fc - ts(u.created_at) <= H24) weekly[k]["Day0 첫밥"]++;
  const fl = firstLike.get(u.id); if (fl !== undefined && fl - ts(u.created_at) <= H24) weekly[k]["Day0 하트"]++;
}
console.table(Object.values(weekly));
