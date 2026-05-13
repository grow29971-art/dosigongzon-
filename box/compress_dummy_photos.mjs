// 더미 cat 사진 백필 압축 (1회성).
// 실행: node --env-file=.env.local box/compress_dummy_photos.mjs
//
// 배경:
//   seed_real_dummy_cats.mjs가 원본 JPEG(최대 10MB)을 그대로 업로드해 dummy-real/ 폴더에
//   2~10MB 파일 130+개가 누적. LCP 5.7s + Supabase egress 폭증의 주범.
//   클라 업로드는 convertImageToWebp(1280px/WebP)로 압축하지만 시드 스크립트는 우회.
//
// 동작:
//   1) cat-photos/dummy-real/ 안의 모든 파일 list
//   2) >= 500KB 파일만 처리 (이미 작은 건 스킵)
//   3) 다운로드 → sharp로 1280px max + JPEG quality 82 재인코딩 → upsert 업로드
//   4) URL은 동일하므로 DB photo_url 업데이트 불필요
//
// 동일 파일을 두 번 돌려도 안전(이미 작아진 파일은 SKIP). 실패는 콘솔 출력 후 계속.

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase = createClient(url, key);
const BUCKET = "cat-photos";
const PREFIX = "dummy-real";
const MIN_SIZE = 500 * 1024; // 500KB 이상만 압축
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 82;

console.log(`🔍 ${BUCKET}/${PREFIX}/ 스캔 중...`);

const { data: files, error: listError } = await supabase.storage
  .from(BUCKET)
  .list(PREFIX, { limit: 1000, sortBy: { column: "name", order: "asc" } });

if (listError) {
  console.error("❌ list 실패:", listError.message);
  process.exit(1);
}

const candidates = (files ?? []).filter((f) => {
  const sz = f.metadata?.size ?? 0;
  return sz >= MIN_SIZE;
});

console.log(`📊 전체 ${files?.length ?? 0}개 중 ${candidates.length}개가 ${MIN_SIZE / 1024}KB 이상\n`);

let processed = 0;
let totalBefore = 0;
let totalAfter = 0;
let failed = 0;

for (const file of candidates) {
  const path = `${PREFIX}/${file.name}`;
  const sizeBefore = file.metadata.size;
  totalBefore += sizeBefore;

  try {
    // 1. 다운로드
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
    if (dlErr) throw dlErr;
    const buf = Buffer.from(await blob.arrayBuffer());

    // 2. sharp 재인코딩 (긴 변 1280px, JPEG q82)
    const compressed = await sharp(buf)
      .rotate() // EXIF 회전 적용
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    // 효과가 미미하면 (10% 이내 감소) 건너뛰기 (이미 잘 압축된 파일)
    if (compressed.length > sizeBefore * 0.9) {
      console.log(`  ⏭️  SKIP ${path}: ${(sizeBefore / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (감소 미미)`);
      totalAfter += sizeBefore;
      continue;
    }

    // 3. upsert 업로드 (같은 경로 덮어쓰기)
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
    if (upErr) throw upErr;

    totalAfter += compressed.length;
    processed++;
    const ratio = ((1 - compressed.length / sizeBefore) * 100).toFixed(0);
    console.log(`  ✅ ${path}: ${(sizeBefore / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB (-${ratio}%)`);
  } catch (e) {
    failed++;
    console.error(`  ❌ ${path}:`, e.message ?? e);
    totalAfter += sizeBefore;
  }
}

console.log(`\n📈 결과`);
console.log(`   처리: ${processed}개 / 실패: ${failed}개`);
console.log(`   이전: ${(totalBefore / 1024 / 1024).toFixed(1)}MB`);
console.log(`   이후: ${(totalAfter / 1024 / 1024).toFixed(1)}MB`);
console.log(`   절감: ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(1)}MB (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(0)}%)`);
