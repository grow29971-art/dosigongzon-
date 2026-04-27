// 예쁜 스크린샷 v2
// - 세로: 비로그인 홈, 로그인 지도, 로그인 보호지침
// - 가로: 로그인 마이페이지

import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const OUT = "C:\\Users\\acer\\Desktop";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

console.log("매직링크 생성 중...");
const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
  type: "magiclink",
  email: "grow29971@gmail.com",
  options: { redirectTo: "https://dosigongzon.com/" },
});
if (linkErr) {
  console.error("매직링크 실패:", linkErr.message);
  process.exit(1);
}
const magicLink = linkData.properties.action_link;
console.log("✓ 매직링크 생성됨");

const browser = await puppeteer.launch({ headless: "new" });

// ── 1. 비로그인 홈 (새 incognito context) ──
console.log("\n[1/4] 비로그인 홈 캡처");
const ctx1 = await browser.createBrowserContext();
const page1 = await ctx1.newPage();
await page1.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });
await page1.goto("https://dosigongzon.com/", { waitUntil: "networkidle2", timeout: 60000 });
// onboarding redirect 차단
await page1.evaluate(() => {
  try { localStorage.setItem("dosigongzon_onboarded", "true"); } catch {}
});
await page1.reload({ waitUntil: "networkidle2" });
await wait(3000);
await page1.screenshot({ path: `${OUT}\\raw-home-loggedout.png` });
console.log("✓ raw-home-loggedout.png");
await ctx1.close();

// ── 2~4. 로그인 컨텍스트 ──
const ctx2 = await browser.createBrowserContext();
const page2 = await ctx2.newPage();
await page2.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });

console.log("\n매직링크로 로그인 중...");
await page2.goto(magicLink, { waitUntil: "networkidle2", timeout: 60000 });
await wait(3000);
await page2.evaluate(() => {
  try { localStorage.setItem("dosigongzon_onboarded", "true"); } catch {}
});
console.log("✓ 로그인 완료");

console.log("\n[2/4] 로그인 지도 캡처");
await page2.goto("https://dosigongzon.com/map", { waitUntil: "networkidle2", timeout: 60000 });
await wait(6000); // 지도 마커 로딩
await page2.screenshot({ path: `${OUT}\\raw-map-loggedin.png` });
console.log("✓ raw-map-loggedin.png");

console.log("\n[3/4] 보호지침 캡처");
await page2.goto("https://dosigongzon.com/protection", { waitUntil: "networkidle2", timeout: 60000 });
await wait(3000);
await page2.screenshot({ path: `${OUT}\\raw-protection.png` });
console.log("✓ raw-protection.png");

console.log("\n[4/4] 마이페이지 캡처");
await page2.goto("https://dosigongzon.com/mypage", { waitUntil: "networkidle2", timeout: 60000 });
await wait(3000);
await page2.screenshot({ path: `${OUT}\\raw-mypage.png` });
console.log("✓ raw-mypage.png");

await ctx2.close();
await browser.close();
console.log("\n완료. 다음 단계: PowerShell 합성");
