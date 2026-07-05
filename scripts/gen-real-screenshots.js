// 실제 로그인 상태 앱스토어 스크린샷 v3 — Supabase 쿠키 직접 주입
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const SUPABASE_URL = "https://sozxbnvgsougkliibnxl.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY    = "sb_publishable_HzB9d7zu8_1IVMtZOAZdTw_n3xKdLPT";
const USER_EMAIL  = "grow29971@gmail.com";
const BASE_URL    = "https://dosigongzon.com";
const PROJECT_REF = "sozxbnvgsougkliibnxl";
const LS_KEY      = `sb-${PROJECT_REF}-auth-token`;

const OUT = "C:\\Users\\1\\Desktop\\AppStoreScreenshots_Real";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const W = 414, H = 896, DPR = 3;

// JWT 디코딩 (서명 검증 불필요)
function decodeJWT(token) {
  const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
}

// puppeteer로 action_link 방문 → URL 해시에서 토큰 추출
async function getTokens(browser) {
  // 1. 매직링크 발급
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
    body: JSON.stringify({
      type: "magiclink",
      email: USER_EMAIL,
      options: { redirect_to: `${BASE_URL}?ios=1` },
    }),
  });
  const d = await res.json();
  if (!d.action_link) throw new Error("링크 실패: " + JSON.stringify(d));
  console.log("  action_link 발급 완료, puppeteer로 방문 중...");

  // 2. 먼저 dosigongzon.com 방문해서 localStorage 선점 (온보딩 리다이렉트 방지)
  const tmpPage = await browser.newPage();
  await tmpPage.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  await tmpPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await tmpPage.evaluate(() => {
    localStorage.setItem("dosigongzon_onboarded", "true");
    localStorage.setItem("dosigongzon_cookie_consent", "accepted");
  });
  console.log("  localStorage 선점 완료, action_link 방문 중...");

  // 3. action_link 방문 → Supabase가 dosigongzon.com#access_token=... 로 리디렉트
  await tmpPage.goto(d.action_link, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000)); // Supabase SDK가 hash 처리 대기
  console.log("  현재 URL:", tmpPage.url());

  // 3. URL 해시 또는 localStorage에서 토큰 추출
  const result = await tmpPage.evaluate((lsKey) => {
    // localStorage에서 먼저 시도
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      try { return { source: "localStorage", data: JSON.parse(raw) }; } catch {}
    }
    // URL 해시에서 시도
    const hash = window.location.hash.replace("#", "");
    const p = new URLSearchParams(hash);
    const at = p.get("access_token");
    const rt = p.get("refresh_token");
    const ea = p.get("expires_at");
    if (at) return { source: "hash", data: { access_token: at, refresh_token: rt, expires_at: parseInt(ea || "0") } };
    return null;
  }, LS_KEY);

  // 4. 쿠키도 저장 (세션 유지용)
  const cookies = await tmpPage.cookies();
  await tmpPage.close();

  if (!result) throw new Error("토큰을 찾을 수 없음. URL: " + (await tmpPage.url?.() || "?"));

  console.log(`✅ 토큰 획득 (from ${result.source})`);
  const sess = result.data;
  return {
    access_token:  sess.access_token,
    refresh_token: sess.refresh_token,
    expires_at:    sess.expires_at || Math.floor(Date.now()/1000) + 3600,
    existingCookies: cookies,
  };
}

// 완전한 세션 객체 구성 (user 포함)
function buildSession(access_token, refresh_token, expires_at) {
  const payload = decodeJWT(access_token);
  return {
    access_token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at,
    refresh_token,
    user: {
      id:                   payload.sub,
      aud:                  payload.aud  || "authenticated",
      role:                 payload.role || "authenticated",
      email:                payload.email || "",
      email_confirmed_at:   new Date(0).toISOString(),
      phone:                payload.phone || "",
      app_metadata:         payload.app_metadata  || {},
      user_metadata:        payload.user_metadata || {},
      is_anonymous:         false,
      created_at:           new Date(0).toISOString(),
      updated_at:           new Date(0).toISOString(),
    },
  };
}

// Supabase SSR 쿠키 형식으로 주입 (청크 처리 포함)
async function setCookies(page, session) {
  const raw = JSON.stringify(session);
  const CHUNK = 3600;

  const expDate = new Date(session.expires_at * 1000);
  const base = { domain: "dosigongzon.com", path: "/", secure: true, sameSite: "Lax", expires: Math.floor(expDate.getTime() / 1000) };

  if (raw.length <= CHUNK) {
    await page.setCookie({ name: LS_KEY, value: raw, ...base });
  } else {
    // 청크 분할
    const chunks = [];
    for (let i = 0; i * CHUNK < raw.length; i++) chunks.push(raw.slice(i * CHUNK, (i + 1) * CHUNK));
    for (let i = 0; i < chunks.length; i++) {
      await page.setCookie({ name: `${LS_KEY}.${i}`, value: chunks[i], ...base });
    }
    // Supabase SSR은 청크 수도 쿠키로 저장
    await page.setCookie({ name: `${LS_KEY}.chunks`, value: String(chunks.length), ...base });
  }

  // localStorage에도 동일하게 (CSR 보험)
  await page.evaluate(({ key, val }) => {
    try {
      localStorage.setItem(key, val);
      localStorage.setItem("dosigongzon_onboarded",                   "true");
      localStorage.setItem("dosigongzon_cookie_consent",              "accepted");
      localStorage.setItem("dosigongzon_pwa_banner_dismissed_at",     String(Date.now()));
      localStorage.setItem("dosigongzon_play_store_banner_dismissed_at", String(Date.now()));
    } catch {}
  }, { key: LS_KEY, val: raw });
}

// 팝업·배너 자동 닫기 (클릭 + 강제 숨김 병행)
async function dismiss(page) {
  await new Promise(r => setTimeout(r, 800));
  // 쿠키 동의 버튼 클릭 시도
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const agree = btns.find(b => b.textContent?.includes("동의하고 계속"));
      if (agree) agree.click();
    });
    await new Promise(r => setTimeout(r, 500));
  } catch {}
  // 나머지 배너 강제 숨김
  await page.evaluate(() => {
    document.querySelectorAll("*").forEach(el => {
      const t = el.textContent || "";
      if (t.includes("쿠키 사용에 대해") || t.includes("앱처럼 쓰세요") || t.includes("홈 화면에 추가")) {
        // 실제 배너 컨테이너만 (자식이 적은 것)
        if (el.children.length <= 6 && !el.matches("body,html,main,div#__next")) {
          el.style.display = "none";
        }
      }
    });
  });
  await new Promise(r => setTimeout(r, 300));
}

// /welcome 페이지에서 건너뛰기 클릭 → 홈으로 이동
async function skipWelcome(page) {
  const url = page.url();
  if (!url.includes("/welcome")) return;
  console.log("  /welcome 감지 → 건너뛰기 클릭");
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button,a"));
      const skip = btns.find(b => b.textContent?.includes("건너뛰기"));
      if (skip) skip.click();
    });
    await new Promise(r => setTimeout(r, 2000));
  } catch {}
}

// 페이지 이동 → 스크린샷 (쿠키는 이미 세팅됨)
async function shot(page, session, url, filename, { scrollY = 0, extraWait = 3000 } = {}) {
  // 1) 이동 (쿠키는 브라우저에 이미 있음)
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, extraWait));

  // 2) /welcome 처리 + 진단
  await skipWelcome(page);
  const info = await page.evaluate(() => ({
    url:     location.href,
    bodyLen: document.body?.innerHTML?.length || 0,
  }));
  console.log(`  [${filename}] url=${info.url.replace("https://dosigongzon.com","")}, bodyLen=${info.bodyLen}`);

  // 3) 팝업 제거
  await dismiss(page);

  // 4) 스크롤
  if (scrollY) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await new Promise(r => setTimeout(r, 700));
  }

  // 5) 촬영
  await page.screenshot({ path: path.join(OUT, filename), clip: { x:0, y:0, width:W, height:H } });
  console.log(`📸 ${filename}`);
}

// ── 메인 ──────────────────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox", "--disable-setuid-sandbox",
      "--lang=ko-KR,ko",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  console.log("🔐 세션 토큰 획득 중...");
  const { access_token, refresh_token, expires_at, existingCookies } = await getTokens(browser);
  const session = buildSession(access_token, refresh_token, expires_at);
  console.log(`   user.email: ${session.user.email}`);

  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
  // iPhone UA 제거 — 흰 화면 유발. 기본 Chromium UA 사용.

  // 이미 취득한 쿠키 이식
  if (existingCookies?.length) {
    const dCookies = existingCookies.filter(c => c.domain?.includes("dosigongzon") || c.domain?.includes("supabase"));
    if (dCookies.length) await page.setCookie(...dCookies);
  }

  // 도메인 방문 후 세션 주입
  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 40000 });
  await setCookies(page, session);
  // /welcome 이면 건너뛰기
  await skipWelcome(page);
  // 쿠키 동의 처리
  await dismiss(page);

  // ── 10장 촬영 ─────────────────────────────────────────────────
  await shot(page, session, "/",           "01_home.png",              { extraWait: 3500 });
  await shot(page, session, "/map",        "02_map.png",               { extraWait: 5500 }); // 카카오맵 로딩
  await shot(page, session, "/community",  "03_community.png",         { extraWait: 3000 });
  await shot(page, session, "/mypage",     "04_mypage.png",            { extraWait: 3000 });
  await shot(page, session, "/protection", "05_protection.png",        { extraWait: 2500 });
  await shot(page, session, "/",           "06_home_scroll.png",       { extraWait: 3000, scrollY: 600 });
  await shot(page, session, "/community",  "07_community_scroll.png",  { extraWait: 3000, scrollY: 200 });
  await shot(page, session, "/mypage",     "08_mypage_scroll.png",     { extraWait: 3000, scrollY: 350 });
  await shot(page, session, "/protection", "09_protection_scroll.png", { extraWait: 2500, scrollY: 300 });
  await shot(page, session, "/map",        "10_map_scroll.png",        { extraWait: 5500, scrollY: 100 });

  await browser.close();
  console.log(`\n✅ 완료! → ${OUT}`);
})();
