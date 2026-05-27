// Play Store 피처 그래픽 (1024×500) 자동 생성
// 실행: node city-android/generate-feature-graphic.mjs
// 출력: city-android/screenshots/feature-graphic-1024x500.png

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "screenshots");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>도시공존</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

  body {
    width: 1024px;
    height: 500px;
    overflow: hidden;
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(135deg, #FFF8F2 0%, #FBE9D6 50%, #F0D5B5 100%);
    position: relative;
  }

  /* 배경 — 따뜻한 그라디언트 + 서울 도시 실루엣 느낌 */
  .bg-decorations {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* 따뜻한 원형 라이트 */
  .light-1 {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,193,143,0.5) 0%, transparent 60%);
    top: -200px;
    right: -150px;
  }
  .light-2 {
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(196,126,90,0.25) 0%, transparent 60%);
    bottom: -100px;
    left: -50px;
  }

  /* 발자국 흐릿한 패턴 */
  .paw {
    position: absolute;
    font-size: 40px;
    opacity: 0.12;
    color: #A8684A;
  }
  .paw-1 { top: 60px; right: 380px; transform: rotate(-15deg); }
  .paw-2 { top: 120px; right: 320px; transform: rotate(25deg); font-size: 28px; }
  .paw-3 { bottom: 80px; right: 280px; transform: rotate(-30deg); font-size: 32px; }
  .paw-4 { top: 200px; right: 460px; transform: rotate(10deg); font-size: 36px; }

  /* 메인 컨텐츠 */
  .container {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 80px;
    gap: 60px;
  }

  .text-block {
    flex: 1;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(196,126,90,0.12);
    color: #A8684A;
    padding: 8px 18px;
    border-radius: 100px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: 24px;
    border: 1.5px solid rgba(196,126,90,0.25);
  }

  h1 {
    font-size: 68px;
    font-weight: 900;
    line-height: 1.1;
    color: #2C2C2C;
    letter-spacing: -0.04em;
    margin-bottom: 20px;
  }

  h1 .accent {
    background: linear-gradient(135deg, #C47E5A 0%, #A8684A 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: 22px;
    font-weight: 600;
    color: #5C5C5C;
    line-height: 1.5;
    letter-spacing: -0.01em;
  }

  .features {
    display: flex;
    gap: 12px;
    margin-top: 28px;
    flex-wrap: wrap;
  }

  .feature-tag {
    background: rgba(255,255,255,0.85);
    color: #5C5C5C;
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 15px;
    font-weight: 700;
    border: 1.5px solid rgba(196,126,90,0.18);
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }

  /* 우측 그림 영역 */
  .visual-block {
    width: 360px;
    height: 360px;
    position: relative;
    flex-shrink: 0;
  }

  /* 큰 둥근 박스 — 폰 화면처럼 */
  .phone-mock {
    position: absolute;
    width: 220px;
    height: 360px;
    background: linear-gradient(180deg, #C47E5A 0%, #A8684A 100%);
    border-radius: 36px;
    box-shadow:
      0 30px 60px rgba(196,126,90,0.35),
      0 12px 24px rgba(0,0,0,0.12),
      inset 0 0 0 6px rgba(255,255,255,0.3);
    top: 0;
    right: 60px;
    transform: rotate(8deg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 24px;
  }

  .phone-cat {
    font-size: 96px;
    line-height: 1;
    margin-bottom: 16px;
  }

  .phone-text {
    color: white;
    text-align: center;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.4;
  }

  .phone-text small {
    display: block;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.85;
    margin-top: 6px;
  }

  /* 작은 떠있는 원형 카드들 */
  .floating-card {
    position: absolute;
    background: white;
    padding: 12px 16px;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.10);
    font-size: 14px;
    font-weight: 700;
    color: #2C2C2C;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .floating-card-1 {
    top: 30px;
    left: -10px;
    color: #D85555;
  }

  .floating-card-2 {
    bottom: 50px;
    right: -10px;
    color: #48A59E;
  }

  .floating-card-3 {
    top: 180px;
    left: 10px;
    color: #C47E5A;
  }

  .icon {
    width: 22px;
    height: 22px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }
</style>
</head>
<body>
  <div class="bg-decorations">
    <div class="light-1"></div>
    <div class="light-2"></div>
    <div class="paw paw-1">🐾</div>
    <div class="paw paw-2">🐾</div>
    <div class="paw paw-3">🐾</div>
    <div class="paw paw-4">🐾</div>
  </div>

  <div class="container">
    <div class="text-block">
      <div class="badge">🐱 길고양이 시민 참여 플랫폼</div>
      <h1>도시는 사람만의<br><span class="accent">공간이 아니에요</span></h1>
      <p class="tagline">
        길고양이를 돌보고, 구조하고, 임시보호하는<br>
        시민들이 함께 만드는 따뜻한 도시
      </p>
      <div class="features">
        <div class="feature-tag">🗺️ 동네 지도</div>
        <div class="feature-tag">🚨 긴급 구조</div>
        <div class="feature-tag">🏠 임시보호·입양</div>
        <div class="feature-tag">🎬 냥숏츠</div>
      </div>
    </div>

    <div class="visual-block">
      <div class="floating-card floating-card-1">
        <span class="icon" style="background:rgba(216,85,85,0.12)">🚨</span>
        긴급 구조
      </div>
      <div class="floating-card floating-card-3">
        <span class="icon" style="background:rgba(196,126,90,0.12)">📍</span>
        우리 동네
      </div>
      <div class="floating-card floating-card-2">
        <span class="icon" style="background:rgba(72,165,158,0.12)">💬</span>
        전체 채팅
      </div>
      <div class="phone-mock">
        <div class="phone-cat">🐈</div>
        <div class="phone-text">
          도시공존
          <small>매일의 돌봄이 쌓이는 곳</small>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function generate() {
  console.log("🚀 Puppeteer 시작...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await page.setContent(HTML, { waitUntil: "networkidle0" });
  // 폰트 로딩 대기
  await new Promise((r) => setTimeout(r, 1500));

  const out = join(OUT_DIR, "feature-graphic-1024x500.png");
  await page.screenshot({ path: out, fullPage: false, omitBackground: false });
  console.log(`✅ 저장됨: ${out}`);

  await browser.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
