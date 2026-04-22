import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = {};
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, "").replace(/\\r/g, "").replace(/\\t/g, "").trim();
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [total, dummy, real] = await Promise.all([
  sb.from("cats").select("*", { count: "exact", head: true }),
  sb.from("cats").select("*", { count: "exact", head: true }).is("caretaker_id", null),
  sb.from("cats").select("*", { count: "exact", head: true }).not("caretaker_id", "is", null),
]);

console.log("전체 고양이:        ", total.count);
console.log("더미 (caretaker X): ", dummy.count);
console.log("실제 유저 등록:     ", real.count);

// 실제 유저 등록 중 caretaker별 분포
const { data: realCats } = await sb
  .from("cats")
  .select("caretaker_name, caretaker_id")
  .not("caretaker_id", "is", null);

if (realCats) {
  const byUser = new Map();
  for (const c of realCats) {
    const key = c.caretaker_name || c.caretaker_id;
    byUser.set(key, (byUser.get(key) ?? 0) + 1);
  }
  console.log("\n실제 유저 등록 분포:");
  for (const [name, n] of [...byUser.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${n}마리`);
  }
}
