// D 리디자인 실렌더 검증 — 홈·지도·쇼핑 스크린샷 (verify-petition-card.mjs 패턴)
import puppeteer from "puppeteer";
import fs from "fs";

const BASE = "https://dosigongzon.com";
const OUT = "C:\\Users\\grow2\\AppData\\Local\\Temp\\claude\\C--Users-grow2-city\\9e3469fe-3be1-4663-a2f7-bb89aaeefb17\\scratchpad\\";
const env = fs.readFileSync("C:\\Users\\grow2\\city\\.env.local", "utf8");
const SVC = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n\\]+)/)?.[1]?.trim();
const SB = "https://sozxbnvgsougkliibnxl.supabase.co";
if (!SVC) { console.error("no service key"); process.exit(1); }

const res = await fetch(`${SB}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SVC}`, apikey: SVC },
  body: JSON.stringify({ type: "magiclink", email: "grow29971@gmail.com", options: { redirect_to: BASE } }),
});
const d = await res.json();
if (!d.action_link) { console.error("magiclink fail:", JSON.stringify(d).slice(0, 150)); process.exit(1); }
console.log("magiclink ok");

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

// 게이트/모달 억제 시도
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.evaluate(() => {
  try {
    const keys = ["dosigongzon_intro_shop", "dosigongzon_intro_map", "dosigongzon_intro_home", "dosigongzon_app_guide_seen", "pwa_prompt_dismissed"];
    for (const k of keys) localStorage.setItem(k, "1");
  } catch {}
});

await page.goto(d.action_link, { waitUntil: "networkidle2", timeout: 45000 });
await new Promise(r => setTimeout(r, 4000));

const shots = [["/", "d_home.png", 6000], ["/map", "d_map.png", 8000], ["/shop", "d_shop.png", 5000]];
for (const [path, file, wait] of shots) {
  await page.goto(BASE + path, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
  await new Promise(r => setTimeout(r, wait));
  // 떠있는 모달 닫기 시도 (X 버튼/오버레이)
  await page.keyboard.press("Escape").catch(() => {});
  await page.screenshot({ path: OUT + file });
  console.log("shot:", file);
}
await browser.close();
console.log("done");
