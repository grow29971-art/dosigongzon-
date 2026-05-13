// 진단: signup 페이지의 Turnstile widget 동작 확인.
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
const consoleLogs = [];
page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (e) => errors.push("PAGE ERROR: " + e.message));
page.on("requestfailed", (req) => {
  if (req.url().includes("turnstile") || req.url().includes("cloudflare")) {
    errors.push("FAILED: " + req.url() + " — " + req.failure()?.errorText);
  }
});

await page.goto("https://dosigongzon.com/signup", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 5000)); // turnstile 로드 대기

const result = await page.evaluate(() => ({
  turnstile: !!window.turnstile,
  iframes: Array.from(document.querySelectorAll("iframe")).map((f) => f.src),
  bodyContainsTurnstile: document.body.innerHTML.includes("turnstile"),
  containerHtml: (() => {
    const containers = Array.from(document.querySelectorAll("div.flex.justify-center.my-2"));
    return containers.map((c) => c.innerHTML.slice(0, 300));
  })(),
}));

console.log("=== window.turnstile exists:", result.turnstile);
console.log("=== iframes:");
for (const src of result.iframes) console.log("  ", src);
console.log("=== body contains 'turnstile':", result.bodyContainsTurnstile);
console.log("=== turnstile containers (count):", result.containerHtml.length);
for (const html of result.containerHtml) console.log("  ", html);
console.log();
console.log("=== Errors:");
for (const e of errors) console.log(" ", e);
console.log();
console.log("=== Console (last 15):");
for (const l of consoleLogs.slice(-15)) console.log(" ", l);

await browser.close();
