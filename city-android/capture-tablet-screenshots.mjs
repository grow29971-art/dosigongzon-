// Play Store 태블릿 스크린샷 자동 캡쳐 — 7인치 + 10인치
// 실행: node city-android/capture-tablet-screenshots.mjs

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const SITE = "https://dosigongzon.com";

// 두 태블릿 사이즈 — 가로비율 9:16 portrait
const DEVICES = [
  {
    name: "7inch",
    viewport: { width: 800, height: 1280, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
  },
  {
    name: "10inch",
    viewport: { width: 1200, height: 1920, deviceScaleFactor: 1.4, isMobile: true, hasTouch: true },
  },
];

const PAGES = [
  { path: "/shorts",                      file: "01-shorts",         waitFor: 2500 },
  { path: "/",                            file: "02-home",           waitFor: 2000 },
  { path: "/protection",                  file: "03-protection",     waitFor: 1500 },
  { path: "/protection/emergency-guide",  file: "04-emergency",      waitFor: 1500 },
  { path: "/tips",                        file: "05-tips",           waitFor: 1500 },
  { path: "/news",                        file: "06-news",           waitFor: 1500 },
];

async function capture() {
  console.log("🚀 태블릿 스크린샷 캡쳐 시작");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  for (const device of DEVICES) {
    console.log(`\n📱 ${device.name} 태블릿 (${device.viewport.width}×${device.viewport.height})`);
    for (const p of PAGES) {
      const page = await browser.newPage();
      await page.setViewport(device.viewport);
      await page.setUserAgent(
        "Mozilla/5.0 (Linux; Android 13; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );

      const url = `${SITE}${p.path}`;
      const filename = `tablet-${device.name}-${p.file}.png`;
      console.log(`  📸 ${p.path} → ${filename}`);
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        await new Promise((r) => setTimeout(r, p.waitFor));
        await page.screenshot({ path: join(OUT_DIR, filename), fullPage: false });
      } catch (err) {
        console.error(`     ❌ ${err.message}`);
      }
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n🎉 완료. 폴더: ${OUT_DIR}`);
}

capture().catch((err) => { console.error(err); process.exit(1); });
