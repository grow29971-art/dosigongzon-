const puppeteer = require('puppeteer');
const fs = require('fs');

const CATEGORY_IDS = [
  14613,14614,14615,14616,14617,14618,14619,14620,
  14621,14622,14623,14624,14625,14626,14627,14628,14629,14630,
  14631,14632,14633,14634,14635,14636,14637,
  14971,14972,14973,14974,14975,14976,14977,14978,
  14982,14983,14984,14985,14986,14987,14988,14989,14990,14991,14992,14993,14994,14995,14996,
  14999,15000,15001,15002,15003,15004,15005,
  15008,15009,15010,15011,15012,
  15014,15015,15016,15017,
  15020,15021,15022,15023,15024,
  15026,15027,15028,15029,15030,15031,15032,15033,15034,15035,
  15036,15037,15038,15039,15040,15041,15042,15043,15044,15045,
  15046,15047,15048,15049,15050,15051,15052,
  15058,15059,15060,15061,15062,15063,
  15077,15078,15079,
  15090,15091,15092,15093,15094,15095,15096,15097,15098,
  15108,15109,15110,15111,15112,15113,15114,15115,15116,15117,
  15132,15133,15134,15135,15136,15137,15138,15139,
  15151,15152,15153,15154,15155,15156,
  15166,15167,15168,15169,15170,
  15189,15190,
];

async function scrapeCategory(page, categoryId) {
  const results = [];
  for (let p = 1; p <= 5; p++) {
    const url = `https://anipharm.net/fboard/category/${categoryId}?page=${p}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      await page.waitForSelector('body', { timeout: 5000 });

      const items = await page.evaluate(() => {
        const pharmacies = [];
        // Try multiple selectors for the board list
        const entries = document.querySelectorAll('.bd_lst_wrp .item, .bd_lst .item, li.item, .board_list li, .fboard_list li, article');
        entries.forEach(el => {
          const titleEl = el.querySelector('.title a, h3 a, .name a, a.title');
          const text = el.innerText || el.textContent || '';
          const name = titleEl ? titleEl.textContent.trim() : '';

          // Extract address and phone from text content
          const addrMatch = text.match(/(?:주소|소재지)[:\s]*([\S ]+?)(?:\n|전화|연락|$)/);
          const phoneMatch = text.match(/(?:전화|연락|☎|📞)[:\s]*([\d\-]+)/);
          const phoneMatch2 = text.match(/(\d{2,4}-\d{3,4}-\d{4})/);

          const address = addrMatch ? addrMatch[1].trim() : '';
          const phone = phoneMatch ? phoneMatch[1].trim() : (phoneMatch2 ? phoneMatch2[1] : '');

          if (name && name.length > 1) {
            pharmacies.push({ name, address, phone });
          }
        });
        return pharmacies;
      });

      if (items.length === 0) break;
      results.push(...items);
      if (items.length < 10) break;
    } catch (e) {
      break;
    }
  }
  return results;
}

async function main() {
  console.error('Starting browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const all = [];
  const seen = new Set();
  let done = 0;

  for (const id of CATEGORY_IDS) {
    done++;
    if (done % 10 === 0) console.error(`Progress: ${done}/${CATEGORY_IDS.length}`);

    const items = await scrapeCategory(page, id);
    for (const item of items) {
      const key = item.name + '|' + item.address;
      if (!seen.has(key) && item.name) {
        seen.add(key);
        all.push(item);
      }
    }
  }

  await browser.close();

  // Generate SQL
  const esc = s => (s || '').replace(/'/g, "''");
  let sql = '-- 전국 동물약국 시드 (puppeteer 자동 생성)\n';
  sql += '-- 총 ' + all.length + '개\n';
  sql += '-- 실행: Supabase SQL Editor\n\n';
  sql += "insert into public.rescue_hospitals (name, city, district, address, phone, tags, note) values\n";

  const values = all.map(p => {
    const parts = (p.address || '').match(/^(.*?(?:특별시|광역시|특별자치시|특별자치도|도))\s*(.*?(?:구|시|군))/);
    const city = parts ? parts[1].trim() : '';
    const district = parts ? parts[2].trim() : '';
    return `  ('${esc(p.name)}', '${esc(city)}', '${esc(district)}', '${esc(p.address)}', '${esc(p.phone)}', ARRAY['동물약국'], null)`;
  });

  sql += values.join(',\n');
  sql += '\non conflict do nothing;\n';

  fs.writeFileSync('box/supabase_animal_pharmacies_nationwide.sql', sql);
  console.error('Done! Generated ' + all.length + ' pharmacies');
}

main().catch(e => { console.error(e); process.exit(1); });
