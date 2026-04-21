// 주요 public.* 테이블을 JSON으로 덤프.
// 사용: node scripts/backup-db.mjs
// 결과: box/backups/<timestamp>/<table>.json

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      // 쌍따옴표/홑따옴표 제거 + escape 시퀀스(\n, \r, \t) 정리
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      // Vercel CLI가 리터럴 \n 을 끝에 끼워넣는 케이스 방어
      v = v.replace(/\\n/g, "").replace(/\\r/g, "").replace(/\\t/g, "").trim();
      env[m[1]] = v;
    }
  } catch (e) {
    throw new Error("Failed to read .env.local: " + e.message);
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 덤프 대상 테이블 (존재 안 하는 건 자동 skip)
const TABLES = [
  "profiles",
  "cats",
  "cat_comments",
  "cat_comment_votes",
  "care_logs",
  "cat_likes",
  "cat_location_history",
  "posts",
  "post_comments",
  "direct_messages",
  "user_follows",
  "user_activity_regions",
  "user_suspensions",
  "invite_events",
  "reactions",
  "inquiries",
  "news",
  "admins",
  "rescue_hospitals",
  "reports",
  "push_subscriptions",
  "pharmacy_guide_items",
  "auth_error_logs",
];

const PAGE = 1000;

async function dumpTable(name) {
  const all = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from(name)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      // 테이블 없음 (code 42P01 등)
      if (error.code === "42P01" || /does not exist/i.test(error.message)) {
        return { skipped: true, reason: "table not found" };
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { rows: all };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join("box", "backups", stamp);
  mkdirSync(dir, { recursive: true });

  const summary = { timestamp: stamp, tables: {} };
  console.log(`📦 백업 시작 → ${dir}`);

  for (const t of TABLES) {
    try {
      const res = await dumpTable(t);
      if (res.skipped) {
        summary.tables[t] = { skipped: true };
        console.log(`  · ${t}: skip (${res.reason})`);
        continue;
      }
      const file = join(dir, `${t}.json`);
      writeFileSync(file, JSON.stringify(res.rows, null, 2), "utf8");
      summary.tables[t] = { rows: res.rows.length };
      console.log(`  ✓ ${t}: ${res.rows.length}행`);
    } catch (e) {
      summary.tables[t] = { error: e.message };
      console.log(`  ✗ ${t}: ${e.message}`);
    }
  }

  writeFileSync(join(dir, "_summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n✅ 완료. 요약: ${join(dir, "_summary.json")}`);
}

main().catch((e) => {
  console.error("백업 실패:", e);
  process.exit(1);
});
