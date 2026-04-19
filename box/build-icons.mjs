// SVG → PNG (192×192, 512×512) + favicon.ico
// 실행: node box/build-icons.mjs
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("box/icon-source.svg");
const OUT_DIR = path.resolve("public/icons");
const FAVICON_DIR = path.resolve("app");

async function main() {
  const svg = await fs.readFile(SRC);

  // PWA 아이콘 2종
  await sharp(svg)
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "icon-192.png"));
  console.log("✓ icon-192.png");

  await sharp(svg)
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "icon-512.png"));
  console.log("✓ icon-512.png");

  // Apple touch icon (180×180, iOS 홈 화면)
  await sharp(svg)
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png");

  // favicon.ico 는 app/favicon.ico 에 위치 (Next.js 자동 serve)
  // sharp는 ico 직접 못 하므로 32×32 PNG 만들어서 favicon.ico 자리에 덮어쓰기
  // (Next.js는 PNG도 favicon으로 serve 가능하지만 ico 포맷 유지 위해 별도 변환 필요)
  await sharp(svg)
    .resize(48, 48)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "favicon-48.png"));
  console.log("✓ favicon-48.png (참고: app/favicon.ico 는 수동 교체 필요시 온라인 변환)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
