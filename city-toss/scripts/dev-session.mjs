// 로컬 개발용: 본 앱 .env.local의 service_role로 magiclink token_hash를 만들어 미니앱 dev 서버에 세션을 넣는다.
// 사용: node scripts/dev-session.mjs <이메일>  →  http://localhost:5173/?dev_token_hash=... 출력
// service_role은 이 스크립트(로컬 Node)에서만 쓰이고 브라우저·번들에는 절대 들어가지 않는다.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l.trim())).filter(Boolean).map((m) => [m[1], m[2].replace(/^"(.*)"$/, "$1")]),
);
const email = process.argv[2];
if (!email) { console.error("이메일을 주세요"); process.exit(1); }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
if (error) { console.error(error.message); process.exit(1); }
console.log(`http://localhost:5173/?dev_token_hash=${data.properties.hashed_token}`);
