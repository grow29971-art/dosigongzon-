// 전국 동물약국 데이터 수집 → SQL 생성 스크립트
// 실행: node scripts/scrape-pharmacies.js > box/supabase_animal_pharmacies_nationwide.sql

const categoryIds = [
  // 서울
  14613,14614,14615,14616,14617,14618,14619,14620,
  14621,14622,14623,14624,14625,14626,14627,14628,14629,14630,
  14631,14632,14633,14634,14635,14636,14637,
  // 인천
  14971,14972,14973,14974,14975,14976,14977,14978,
  // 부산
  14982,14983,14984,14985,14986,14987,14988,14989,14990,14991,14992,14993,14994,14995,14996,
  // 대구
  14999,15000,15001,15002,15003,15004,15005,
  // 대전
  15008,15009,15010,15011,15012,
  // 울산
  15014,15015,15016,15017,
  // 광주
  15020,15021,15022,15023,15024,
  // 경기
  15026,15027,15028,15029,15030,15031,15032,15033,15034,15035,
  15036,15037,15038,15039,15040,15041,15042,15043,15044,15045,
  15046,15047,15048,15049,15050,15051,15052,
  // 강원
  15058,15059,15060,15061,15062,15063,
  // 충북
  15077,15078,15079,
  // 충남
  15090,15091,15092,15093,15094,15095,15096,15097,15098,
  // 경북
  15108,15109,15110,15111,15112,15113,15114,15115,15116,15117,
  // 경남
  15132,15133,15134,15135,15136,15137,15138,15139,
  // 전북
  15151,15152,15153,15154,15155,15156,
  // 전남
  15166,15167,15168,15169,15170,
  // 제주
  15189,15190,
];

async function fetchPage(url) {
  const res = await fetch(url);
  return await res.text();
}

function extractPharmacies(html) {
  const results = [];
  // 약국 정보는 board list에서 추출
  // 패턴: <a> 태그 안에 약국명, 그 주변에 주소/전화
  const itemRegex = /<li[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const nameRegex = /class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
  const addrRegex = /주소[^<]*<[^>]*>([^<]+)/i;
  const phoneRegex = /전화[^<]*<[^>]*>([^<]+)|(\d{2,4}-\d{3,4}-\d{4})/i;

  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const block = m[1];
    const nm = nameRegex.exec(block);
    const ad = addrRegex.exec(block);
    const ph = phoneRegex.exec(block);
    if (nm) {
      const name = nm[1].replace(/<[^>]+>/g, '').trim();
      const address = ad ? ad[1].trim() : '';
      const phone = ph ? (ph[1] || ph[2] || '').trim() : '';
      if (name && address) {
        results.push({ name, address, phone });
      }
    }
  }
  return results;
}

async function main() {
  const all = [];
  const seen = new Set();

  for (const id of categoryIds) {
    try {
      // Try up to 3 pages per category
      for (let page = 1; page <= 3; page++) {
        const url = `https://anipharm.net/fboard/category/${id}?page=${page}`;
        const html = await fetchPage(url);
        const items = extractPharmacies(html);
        if (items.length === 0) break;

        for (const item of items) {
          const key = item.name + '|' + item.address;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(item);
          }
        }

        // If less than 10 items, likely no more pages
        if (items.length < 10) break;
      }
    } catch (e) {
      // Skip failed categories
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  // Generate SQL
  const esc = s => s.replace(/'/g, "''");
  console.log('-- 전국 동물약국 시드 (자동 생성)');
  console.log('-- 총 ' + all.length + '개');
  console.log('-- 실행: Supabase SQL Editor');
  console.log('');
  console.log("insert into public.rescue_hospitals (name, city, district, address, phone, tags, note) values");

  const values = all.map(p => {
    // Extract city/district from address
    const parts = p.address.match(/^(.*?(?:시|도))\s+(.*?(?:구|시|군|읍))/);
    const city = parts ? parts[1] : '';
    const district = parts ? parts[2] : '';
    return `  ('${esc(p.name)}', '${esc(city)}', '${esc(district)}', '${esc(p.address)}', '${esc(p.phone)}', ARRAY['동물약국'], null)`;
  });

  console.log(values.join(',\n'));
  console.log('on conflict do nothing;');
}

main().catch(console.error);
