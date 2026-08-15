// 홈 청원 카드 실렌더 검증 (2026-08-15)
// 매직링크 방문만으로 앱이 스스로 세션 쿠키를 세팅한다(@supabase/ssr) — 수동 쿠키 주입 불필요.
// 게이트 억제 localStorage 키만 심고 홈에서 카드 DOM + 스크린샷 확인.
import puppeteer from "puppeteer";
import fs from "fs";

const SUPABASE_URL = "https://sozxbnvgsougkliibnxl.supabase.co";
const BASE_URL = "https://dosigongzon.com";
const USER_EMAIL = "grow29971@gmail.com";
const OUT_PNG = "C:\\Users\\grow2\\city\\scripts\\petition-card.png";

const env = fs.readFileSync("C:\\Users\\grow2\\city\\.env.local", "utf8");
const SERVICE_ROLE = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n]+)"?/)?.[1]?.trim();
if (!SERVICE_ROLE) { console.error("서비스롤 키 없음"); process.exit(1); }

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
  body: JSON.stringify({ type: "magiclink", email: USER_EMAIL, options: { redirect_to: BASE_URL } }),
});
const d = await res.json();
if (!d.action_link) { console.error("매직링크 실패:", JSON.stringify(d).slice(0, 200)); process.exit(1); }
console.log("매직링크 발급 OK");

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });

// 게이트 억제 키 선점
await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.evaluate(() => {
  localStorage.setItem("dosigongzon_onboarded", "true");
  localStorage.setItem("dosigongzon_cookie_consent", "accepted");
  localStorage.setItem("dosigongzon_welcome_seen", "true");
  localStorage.setItem("dosigongzon_pwa_banner_dismissed_at", String(Date.now()));
  localStorage.setItem("dosigongzon_play_store_banner_dismissed_at", String(Date.now()));
});

// 매직링크 방문 → URL 해시에서 토큰 획득
await page.goto(d.action_link, { waitUntil: "networkidle2", timeout: 40000 });
await new Promise((r) => setTimeout(r, 3000));
const tok = await page.evaluate(() => {
  const p = new URLSearchParams(window.location.hash.replace("#", ""));
  const at = p.get("access_token");
  if (!at) return null;
  return { access_token: at, refresh_token: p.get("refresh_token"), expires_at: parseInt(p.get("expires_at") || "0") };
});
if (!tok) { console.error("해시 토큰 없음:", page.url().slice(0, 120)); process.exit(1); }
console.log("토큰 획득 OK");

// @supabase/ssr 0.10 쿠키 포맷으로 세션 주입: "base64-" + base64url(JSON), 3180자 청크(name.0, name.1…)
function decodeJWT(t) {
  const b64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
}
const payload = decodeJWT(tok.access_token);
const session = {
  access_token: tok.access_token, token_type: "bearer", expires_in: 3600,
  expires_at: tok.expires_at || Math.floor(Date.now() / 1000) + 3600,
  refresh_token: tok.refresh_token,
  user: {
    id: payload.sub, aud: payload.aud || "authenticated", role: payload.role || "authenticated",
    email: payload.email || "", email_confirmed_at: new Date(0).toISOString(), phone: "",
    app_metadata: payload.app_metadata || {}, user_metadata: payload.user_metadata || {},
    is_anonymous: false, created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString(),
  },
};
const LS_KEY = "sb-sozxbnvgsougkliibnxl-auth-token";
const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const CHUNK = 3180;
const base = { domain: "dosigongzon.com", path: "/", secure: true, sameSite: "Lax", expires: session.expires_at };
if (encoded.length <= CHUNK) {
  await page.setCookie({ name: LS_KEY, value: encoded, ...base });
} else {
  for (let i = 0; i * CHUNK < encoded.length; i++) {
    await page.setCookie({ name: `${LS_KEY}.${i}`, value: encoded.slice(i * CHUNK, (i + 1) * CHUNK), ...base });
  }
}
console.log("세션 쿠키 주입 완료 (길이", encoded.length, ")");

// 홈 진입 (풀 리로드로 서버 렌더 확인)
await page.goto(BASE_URL + "/", { waitUntil: "networkidle2", timeout: 40000 });
await new Promise((r) => setTimeout(r, 8000)); // dynamic ssr:false 마운트 + /api/petitions fetch 대기
console.log("홈 URL:", page.url());

// 공지/이벤트 모달 닫기 (최대 3회)
for (let i = 0; i < 3; i++) {
  const closed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const target = btns.find((b) => /확인했어요|닫기|알겠어요|괜찮아요/.test(b.textContent || "")) ||
      btns.find((b) => b.getAttribute("aria-label") === "닫기");
    if (target) { target.click(); return true; }
    return false;
  });
  if (!closed) break;
  await new Promise((r) => setTimeout(r, 1200));
}

const found = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((el) => el.textContent.includes("진행 중인 청원"));
  const authed = document.body.innerText.includes("내 아이들") || document.body.innerText.includes("브리핑");
  if (!h2) return { rendered: false, authed, url: location.href };
  const card = h2.closest("div.mb-5");
  const rows = card ? [...card.querySelectorAll("a")].map((a) => ({ t: a.innerText.replace(/\n/g, " | ").slice(0, 90), href: a.href.slice(0, 75) })) : [];
  h2.scrollIntoView({ block: "start" });
  window.scrollBy(0, -60);
  return { rendered: true, authed, rows };
});
await new Promise((r) => setTimeout(r, 1500));
console.log("결과:", JSON.stringify(found, null, 1));
await page.screenshot({ path: OUT_PNG });
console.log("스크린샷:", OUT_PNG);
await browser.close();
process.exit(found.rendered ? 0 : 2);
