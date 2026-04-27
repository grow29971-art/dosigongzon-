import puppeteer from "puppeteer";

const OUT = "C:\\Users\\acer\\Desktop";

const screens = [
  { url: "https://dosigongzon.com/", name: "raw-home" },
  { url: "https://dosigongzon.com/map", name: "raw-map" },
  { url: "https://dosigongzon.com/protection", name: "raw-protection" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  for (const s of screens) {
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });
    await page.goto(s.url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(5000);
    await page.screenshot({ path: `${OUT}\\${s.name}.png` });
    console.log(`✓ ${s.name}`);
    await page.close();
  }
  await browser.close();
})();
