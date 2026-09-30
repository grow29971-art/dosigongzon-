// Play Store 스크린샷 자동 캡쳐 — 라이브 사이트(dosigongzon.com)에서 모바일 뷰로 PNG 저장.
// 실행: node city-android/capture-screenshots.mjs
// 출력: city-android/screenshots/ 에 1080x1920 PNG 파일 (Play 규칙: 긴 변 ≤ 짧은 변 × 2 — 1080x2400은 거부됨)

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const SITE = "https://dosigongzon.com";

// 9:16 portrait — 360×640 × 3 = 1080×1920
const VIEWPORT = {
  width: 360,
  height: 640,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  isLandscape: false,
};

// 캡쳐할 페이지 목록 (공개 페이지만) — 2026-09-30 현행 화면으로 교체.
// 고양이 상세는 실물 고양이만(더미 photo_url 'dummy-real/'은 대외 자료 금지).
const PAGES = [
  { path: "/hello",                                          file: "01-hello.png",      waitFor: 2000, firstVisit: true },
  { path: "/map",                                            file: "02-map.png",        waitFor: 4000 },
  { path: "/cats/56ad219e-745e-4af7-836a-4717cc666fd6",      file: "03-cat-detail.png", waitFor: 2500 },
  { path: "/protection",                                     file: "04-protection.png", waitFor: 1500 },
  { path: "/protection/emergency-guide",                     file: "05-emergency.png",  waitFor: 1500 },
  { path: "/tips",                                           file: "06-tips.png",       waitFor: 2000 },
];

async function capture() {
  console.log("🚀 Puppeteer 시작...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    // User-Agent를 모바일로 설정 (반응형 사이트가 모바일 레이아웃 보여주도록)
    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );

    // 쿠키 배너(거부로 — 캡처 중 광고 픽셀 미발화)·지도 첫 안내 시트는 이미 본 상태로
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("dosigongzon_cookie_consent", "rejected");
      localStorage.setItem("dosigongzon_onboarded", "true");
      localStorage.setItem("dosigongzon_intro_map_anon_ts", String(Date.now()));
      localStorage.setItem("dosigongzon_signup_nudge_dismissed", String(Date.now()));
      localStorage.setItem("dosigongzon_points_guide_seen_v1", "1");
      localStorage.setItem("dosigongzon_intro_map_chat_guide_v1", String(Date.now()));
    });
    // 첫 방문 덮개(HelloScreen)는 01번에서만 — 나머지는 본 화면이 보이게 쿠키를 심는다
    if (!p.firstVisit) {
      await page.setCookie({ name: "hello_seen", value: "1", domain: "dosigongzon.com", path: "/" });
    }
    const url = `${SITE}${p.path}`;
    console.log(`📸 ${p.path} → ${p.file}`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      // 페이지 안정화 대기 (애니메이션·이미지 로드)
      await new Promise((r) => setTimeout(r, p.waitFor));
      // 첫 화면만 캡쳐 (full page 아님 — 모바일 1080×2400)
      const out = join(OUT_DIR, p.file);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`   ✅ 저장됨: ${out}`);
    } catch (err) {
      console.error(`   ❌ ${p.path} 실패:`, err.message);
    }
    await page.close();
  }

  await browser.close();
  console.log(`\n🎉 캡쳐 완료. 폴더: ${OUT_DIR}`);
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
