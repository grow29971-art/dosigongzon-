// 도시공존 라이브 사이트 스모크 테스트
// 핵심 페이지 hit → console error·HTTP 에러·응답시간 수집

import puppeteer from "puppeteer";

const ROUTES = [
  { path: "/", label: "홈(랜딩)" },
  { path: "/signup", label: "가입" },
  { path: "/login", label: "로그인" },
  { path: "/map", label: "지도" },
  { path: "/tips", label: "꿀팁" },
  { path: "/faq", label: "FAQ" },
  { path: "/about", label: "소개" },
  { path: "/guide", label: "가이드" },
  { path: "/areas", label: "지역" },
  { path: "/shorts", label: "숏폼" },
  { path: "/protection", label: "보호지침" },
  { path: "/ranking", label: "랭킹" },
];

const BASE = "https://dosigongzon.com";

const browser = await puppeteer.launch({ headless: "new" });
const results = [];

for (const r of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true }); // 모바일 가입자 광고 대상
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1");

  const consoleErrors = [];
  const pageErrors = [];
  const failedReqs = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 200)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!url.includes("data:") && !url.includes("analytics")) {
      failedReqs.push(`${req.failure()?.errorText} ${url.slice(0, 100)}`);
    }
  });

  const t0 = Date.now();
  let status = 0;
  try {
    const resp = await page.goto(`${BASE}${r.path}`, {
      waitUntil: "networkidle2",
      timeout: 30_000,
    });
    status = resp?.status() ?? 0;
  } catch (e) {
    pageErrors.push(`goto: ${e.message?.slice(0, 100)}`);
  }
  const elapsed = Date.now() - t0;

  results.push({
    label: r.label,
    path: r.path,
    status,
    ms: elapsed,
    consoleErrors: consoleErrors.length,
    pageErrors: pageErrors.length,
    failedReqs: failedReqs.length,
    consoleErrorSample: consoleErrors[0] ?? "",
    pageErrorSample: pageErrors[0] ?? "",
    failedReqSample: failedReqs[0] ?? "",
  });

  await page.close();
}

await browser.close();

// 표 출력
console.log("\n=== 도시공존 라이브 스모크 테스트 ===");
console.log("path                 status  ms      cErr  pErr  fReq");
console.log("─".repeat(70));
for (const r of results) {
  console.log(
    `${r.path.padEnd(20)} ${String(r.status).padEnd(7)} ${String(r.ms).padEnd(7)} ${String(r.consoleErrors).padEnd(5)} ${String(r.pageErrors).padEnd(5)} ${String(r.failedReqs)}`,
  );
}

// 에러 디테일
const hasError = results.some((r) => r.consoleErrors > 0 || r.pageErrors > 0 || r.failedReqs > 0);
if (hasError) {
  console.log("\n=== 에러 샘플 ===");
  for (const r of results) {
    if (r.consoleErrors > 0 || r.pageErrors > 0 || r.failedReqs > 0) {
      console.log(`\n${r.path}:`);
      if (r.consoleErrorSample) console.log(`  console: ${r.consoleErrorSample}`);
      if (r.pageErrorSample) console.log(`  pageerr: ${r.pageErrorSample}`);
      if (r.failedReqSample) console.log(`  failed:  ${r.failedReqSample}`);
    }
  }
} else {
  console.log("\n✅ 모든 페이지 에러 없음");
}

// 느린 페이지 경고
const slow = results.filter((r) => r.ms > 3000);
if (slow.length > 0) {
  console.log("\n⚠️ 3초 초과 페이지:");
  for (const r of slow) console.log(`  ${r.path}: ${r.ms}ms`);
}
