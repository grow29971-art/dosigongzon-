// 더미 고양이의 caretaker_name "X 캣맘"·"X 캣대디" → "X 케어테이커" 정리.
// 실행: node --env-file=.env.local box/rename_dummy_caretakers.mjs
//
// 식별: caretaker_id IS NULL (실제 가입 유저가 아닌 시드 데이터)
// 동작: caretaker_name 컬럼만 정규식 치환. 다른 컬럼·실유저는 절대 건드리지 않음.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ env 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url.trim(), key.trim());

// 순서 중요: 합성·복합 형태 먼저, 단독 마지막.
function rename(orig) {
  if (!orig) return orig;
  let out = orig;
  // 캣맘·캣대디, 캣맘/캣대디 결합형
  out = out.replace(/캣맘\s*[·\/]\s*캣대디/g, "케어테이커");
  out = out.replace(/캣맘과\s*캣대디/g, "케어테이커");
  // 단독
  out = out.replace(/캣대디/g, "케어테이커");
  out = out.replace(/캣맘/g, "케어테이커");
  return out;
}

const { data: cats, error } = await supabase
  .from("cats")
  .select("id, caretaker_name")
  .is("caretaker_id", null)
  .or("caretaker_name.ilike.%캣맘%,caretaker_name.ilike.%캣대디%");

if (error) {
  console.error("❌ 조회 실패:", error.message);
  process.exit(1);
}

console.log(`📋 변경 대상 ${cats.length}건 발견.\n`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (const cat of cats) {
  const oldName = cat.caretaker_name;
  const newName = rename(oldName);
  if (newName === oldName) {
    skipped++;
    continue;
  }

  const { error: updErr } = await supabase
    .from("cats")
    .update({ caretaker_name: newName })
    .eq("id", cat.id);

  if (updErr) {
    console.error(`❌ ${oldName}: ${updErr.message}`);
    failed++;
  } else {
    console.log(`✓ "${oldName}" → "${newName}"`);
    updated++;
  }
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ 업데이트: ${updated}`);
if (skipped > 0) console.log(`⏭  변경 불필요: ${skipped}`);
if (failed > 0) console.log(`❌ 실패: ${failed}`);
