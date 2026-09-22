// 커뮤니티 사용량(봇 제외) — 읽기 전용. 실행: node scripts/measure-community.mjs [일수=7]
// 봇 판정은 lib/community-personas isBotAuthor와 동일: author_title='staff' 또는 구 봇 명의 4종.
// 출력은 집계 숫자뿐(개인 식별 없음). service_role은 로컬 Node에서만.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "").trim();
}
const SB = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const LEGACY_BOT_NAMES = ["AI 집사 나비", "집사 나비", "골목지기", "치즈네이모"];
const isBot = (r) => r.author_title === "staff" || LEGACY_BOT_NAMES.includes(r.author_name ?? "");

async function all(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
const days = Number(process.argv[2] ?? 7);
const since = new Date(Date.now() - days * 86400000).toISOString();
const kstDay = (iso) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);

const [posts, comments, reactions, admins] = await Promise.all([
  all(`posts?select=id,author_id,author_name,author_title,category,created_at,view_count&created_at=gte.${since}&order=created_at.asc`),
  all(`post_comments?select=id,post_id,author_id,author_name,author_title,created_at&created_at=gte.${since}&order=created_at.asc`),
  all(`reactions?select=user_id,target_type,target_id,created_at&created_at=gte.${since}`).catch(() => []),
  all(`admins?select=user_id`),
]);
const adminIds = new Set(admins.map((a) => a.user_id));
const tag = (r) => (isBot(r) ? "bot" : adminIds.has(r.author_id) ? "admin" : "user");

const summarize = (rows) => {
  const by = { user: 0, admin: 0, bot: 0 };
  const users = new Set();
  for (const r of rows) { const t = tag(r); by[t]++; if (t === "user") users.add(r.author_id); }
  return { ...by, "유저 수": users.size };
};
console.log(`\n기간: 최근 ${days}일 (${since.slice(0, 10)} ~ 오늘)`);
console.table({ 글: summarize(posts), 댓글: summarize(comments) });

// 유저 글의 카테고리·일자
const userPosts = posts.filter((p) => tag(p) === "user");
const userComments = comments.filter((c) => tag(c) === "user");
const byDay = {};
for (const p of userPosts) { const d = kstDay(p.created_at); byDay[d] ??= { 글: 0, 댓글: 0 }; byDay[d].글++; }
for (const c of userComments) { const d = kstDay(c.created_at); byDay[d] ??= { 글: 0, 댓글: 0 }; byDay[d].댓글++; }
console.log("유저 활동 일자별(KST):"); console.table(byDay);
const byCat = {};
for (const p of userPosts) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
console.log("유저 글 카테고리:", byCat);

// 유저 댓글이 달린 대상: 봇 글 vs 유저 글
const postTag = new Map(posts.map((p) => [p.id, tag(p)]));
const allPosts = await all(`posts?select=id,author_name,author_title,author_id&id=in.(${[...new Set(userComments.map((c) => c.post_id).filter(Boolean))].join(",") || "00000000-0000-0000-0000-000000000000"})`).catch(() => []);
for (const p of allPosts) postTag.set(p.id, tag(p));
const cmtTarget = { "봇 글에": 0, "유저 글에": 0, "관리자 글에": 0, "알 수 없음": 0 };
for (const c of userComments) { const t = postTag.get(c.post_id); cmtTarget[t === "bot" ? "봇 글에" : t === "user" ? "유저 글에" : t === "admin" ? "관리자 글에" : "알 수 없음"]++; }
console.log("유저 댓글 대상:", cmtTarget);

// 반응(이모지)·조회
const userReactions = reactions.filter((r) => !adminIds.has(r.user_id));
console.log(`반응(이모지, 관리자 제외): ${userReactions.length}건 / ${new Set(userReactions.map((r) => r.user_id)).size}명`);
const views = posts.reduce((s, p) => s + (p.view_count ?? 0), 0);
console.log(`최근 ${days}일 작성 글의 누적 조회수 합: ${views} (봇 글 포함, 봇 글 ${posts.filter((p) => tag(p) === "bot").length}건)`);
