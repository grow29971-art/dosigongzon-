// Play Store 스크린샷 자동 캡쳐 — 라이브 사이트(dosigongzon.com)에서 모바일 뷰로 PNG 저장.
// 실행: node city-android/capture-screenshots.mjs
// 출력: city-android/screenshots/ 에 1080x1920 PNG 파일

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const SITE = "https://dosigongzon.com";

// Pixel 7 비율 — Play Store 권장 9:16 portrait
const VIEWPORT = {
  width: 412,
  height: 915,
  deviceScaleFactor: 2.625,  // 1080×2400 캡쳐 결과
  isMobile: true,
  hasTouch: true,
  isLandscape: false,
};

// 캡쳐할 페이지 목록 (공개 페이지만)
const PAGES = [
  { path: "/shorts",                       file: "01-shorts.png",         label: "동물숏츠 — 큐레이션된 길고양이 영상 피드", waitFor: 2500 },
  { path: "/",                             file: "02-home-landing.png",   label: "도시공존 — 길고양이와 함께 사는 도시",   waitFor: 2000 },
  { path: "/protection",                   file: "03-protection.png",     label: "보호지침 — 응급·새끼·TNR·약품 가이드",   waitFor: 1500 },
  { path: "/protection/emergency-guide",   file: "04-emergency-guide.png",label: "응급 처치 가이드 — 발견 시 첫 30분",     waitFor: 1500 },
  { path: "/tips",                         file: "05-tips.png",           label: "꿀팁게시판 — 돌봄 정보글 모음",          waitFor: 1500 },
  { path: "/news",                         file: "06-news.png",           label: "고양이 사회 소식 — TNR·법령·행사",       waitFor: 1500 },
  { path: "/guide",                        file: "07-guide.png",          label: "도시공존 사용법",                        waitFor: 1500 },
  { path: "/about",                        file: "08-about.png",          label: "도시공존이 만들어진 이유",                waitFor: 1500 },
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
