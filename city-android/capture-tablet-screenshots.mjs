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

// 휴대전화용(capture-screenshots.mjs)과 같은 현행 화면 — 2026-09-30 교체. 고양이 상세는 실물 고양이만.
const PAGES = [
  { path: "/hello",                                     file: "01-hello",      waitFor: 2000, firstVisit: true },
  { path: "/map",                                       file: "02-map",        waitFor: 4000 },
  { path: "/cats/56ad219e-745e-4af7-836a-4717cc666fd6", file: "03-cat-detail", waitFor: 2500 },
  { path: "/protection",                                file: "04-protection", waitFor: 1500 },
  { path: "/protection/emergency-guide",                file: "05-emergency",  waitFor: 1500 },
  { path: "/tips",                                      file: "06-tips",       waitFor: 2000 },
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

      // 첫 방문 팝업·쿠키 배너가 화면을 가리지 않게(휴대전화용과 같은 키)
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem("dosigongzon_cookie_consent", "rejected");
        localStorage.setItem("dosigongzon_onboarded", "true");
        localStorage.setItem("dosigongzon_intro_map_anon_ts", String(Date.now()));
        localStorage.setItem("dosigongzon_signup_nudge_dismissed", String(Date.now()));
        localStorage.setItem("dosigongzon_points_guide_seen_v1", "1");
        localStorage.setItem("dosigongzon_intro_map_chat_guide_v1", String(Date.now()));
      });
      if (!p.firstVisit) {
        await page.setCookie({ name: "hello_seen", value: "1", domain: "dosigongzon.com", path: "/" });
      }
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
