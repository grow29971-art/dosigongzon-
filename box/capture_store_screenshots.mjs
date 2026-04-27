// Play Console / 미니앱 스토어용 스크린샷 자동 캡처.
// 실행: cd C:\Users\acer\city; node box/capture_store_screenshots.mjs
//
// 출력: 바탕화면에 PNG 6장
//   - 세로형 636x1048 × 4장 (home, map, protection, news)
//   - 가로형 1504x741 × 2장 (map, protection)

import puppeteer from "puppeteer";

const OUT = "C:\\Users\\acer\\Desktop";

const VERTICAL = [
  { url: "https://dosigongzon.com/", name: "vertical-home" },
  { url: "https://dosigongzon.com/map", name: "vertical-map" },
  { url: "https://dosigongzon.com/protection", name: "vertical-protection" },
  { url: "https://dosigongzon.com/news", name: "vertical-news" },
];

const HORIZONTAL = [
  { url: "https://dosigongzon.com/map", name: "horizontal-map" },
  { url: "https://dosigongzon.com/protection", name: "horizontal-protection" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("브라우저 시작 중... (첫 실행은 Chromium 다운로드로 시간 걸릴 수 있음)");
  const browser = await puppeteer.launch({ headless: "new" });

  console.log("\n세로형 캡처 시작 (636x1048)");
  for (const s of VERTICAL) {
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 636, height: 1048, deviceScaleFactor: 1 });
      await page.goto(s.url, { waitUntil: "networkidle2", timeout: 60000 });
      await wait(3000); // 추가 렌더링 대기 (지도 등)
      const out = `${OUT}\\${s.name}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${s.name}.png`);
      await page.close();
    } catch (err) {
      console.error(`  ✗ ${s.name}:`, err.message);
    }
  }

  console.log("\n가로형 캡처 시작 (1504x741)");
  for (const s of HORIZONTAL) {
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1504, height: 741, deviceScaleFactor: 1 });
      await page.goto(s.url, { waitUntil: "networkidle2", timeout: 60000 });
      await wait(3000);
      const out = `${OUT}\\${s.name}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${s.name}.png`);
      await page.close();
    } catch (err) {
      console.error(`  ✗ ${s.name}:`, err.message);
    }
  }

  await browser.close();
  console.log("\n완료. 바탕화면 확인하세요.");
})();
