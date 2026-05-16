// 더미 게시글·댓글의 author_name·본문에서 캣맘·캣대디 → 케어테이커 정리.
// 실행: node --env-file=.env.local box/rename_dummy_posts_comments.mjs
//
// 식별: author_id IS NULL (실유저 X)
// 대상 테이블: posts(content), post_comments(body), cat_comments(body) + 각 author_name

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ env 누락");
  process.exit(1);
}
const supabase = createClient(url.trim(), key.trim());

// 순서: 합성형 → 단독
function rename(orig) {
  if (!orig) return orig;
  let out = orig;
  out = out.replace(/캣맘\s*[·\/]\s*캣대디/g, "케어테이커");
  out = out.replace(/캣맘과\s*캣대디/g, "케어테이커");
  out = out.replace(/캣대디/g, "케어테이커");
  out = out.replace(/캣맘/g, "케어테이커");
  return out;
}

async function processTable(table, textCols) {
  const filterCols = textCols.map((c) => `${c}.ilike.%캣맘%,${c}.ilike.%캣대디%`).join(",");

  const { data, error } = await supabase
    .from(table)
    .select(["id", ...textCols].join(","))
    .is("author_id", null)
    .or(filterCols);

  if (error) {
    console.error(`❌ ${table} 조회 실패: ${error.message}`);
    return;
  }

  console.log(`\n📋 ${table}: ${data.length}건 대상`);
  let updated = 0;
  let failed = 0;

  for (const row of data) {
    const patch = {};
    for (const c of textCols) {
      if (typeof row[c] !== "string") continue;
      const next = rename(row[c]);
      if (next !== row[c]) patch[c] = next;
    }
    if (Object.keys(patch).length === 0) continue;

    const { error: updErr } = await supabase.from(table).update(patch).eq("id", row.id);
    if (updErr) {
      console.error(`❌ ${table} #${row.id}: ${updErr.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`   ✅ ${updated} 업데이트${failed ? ` (실패 ${failed})` : ""}`);
}

await processTable("posts", ["author_name", "content"]);
await processTable("post_comments", ["author_name", "body"]);
await processTable("cat_comments", ["author_name", "body"]);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━\n완료");
