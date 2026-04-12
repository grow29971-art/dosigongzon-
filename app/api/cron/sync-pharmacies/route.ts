// 전국 동물약국 데이터 자동 동기화 (LOCALDATA 공공데이터 API)
// Vercel Cron: 매일 03:00 KST 자동 실행
// 수동 호출: POST /api/cron/sync-pharmacies (admin만)

import { createClient } from "@supabase/supabase-js";

const LOCALDATA_API_URL =
  "http://www.localdata.go.kr/platform/rest/02_03_02_P/openDataApi";

interface LocalDataRow {
  rowNum: string;
  opnSfTeamCode: string;
  bplcNm: string; // 사업장명
  rdnWhlAddr: string; // 도로명주소
  siteWhlAddr: string; // 지번주소
  siteTel: string; // 전화번호
  trdStateNm: string; // 영업상태 (영업/폐업 등)
  dtlStateNm: string; // 상세상태
  x: string; // 경도
  y: string; // 위도
}

interface LocalDataResponse {
  result: {
    header: { paging: { totalCount: string; pageIndex: string; pageSize: string } };
    body: { rows: { row: LocalDataRow[] } };
  };
}

export async function POST(request: Request) {
  // Admin 체크 (Cron 호출 시에는 CRON_SECRET으로 인증)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LOCALDATA_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "LOCALDATA_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  // Service role client (RLS 우회)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let totalInserted = 0;
    let totalUpdated = 0;
    let page = 1;
    const pageSize = 500;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(LOCALDATA_API_URL);
      url.searchParams.set("authKey", apiKey);
      url.searchParams.set("resultType", "json");
      url.searchParams.set("pageIndex", String(page));
      url.searchParams.set("pageSize", String(pageSize));

      console.log(`[sync-pharmacies] Fetching page ${page}...`);

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`[sync-pharmacies] API error: ${res.status}`);
        break;
      }

      const data = (await res.json()) as LocalDataResponse;
      const rows = data?.result?.body?.rows?.row ?? [];
      const totalCount = parseInt(
        data?.result?.header?.paging?.totalCount ?? "0",
      );

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      // 영업중인 약국만 필터
      const activeRows = rows.filter(
        (r) => r.trdStateNm === "영업/정상" || r.trdStateNm === "영업",
      );

      // Upsert to rescue_hospitals
      for (const row of activeRows) {
        const address = row.rdnWhlAddr || row.siteWhlAddr || "";
        if (!row.bplcNm || !address) continue;

        // 시/도, 구/시/군 추출
        const parts = address.match(
          /^(.*?(?:특별시|광역시|특별자치시|특별자치도|도))\s*(.*?(?:구|시|군))/,
        );
        const city = parts ? parts[1].trim() : "";
        const district = parts ? parts[2].trim() : "";

        const lat = row.y ? parseFloat(row.y) : null;
        const lng = row.x ? parseFloat(row.x) : null;

        const { error } = await supabase.from("rescue_hospitals").upsert(
          {
            name: row.bplcNm.trim(),
            city,
            district,
            address: address.trim(),
            phone: (row.siteTel || "").trim() || null,
            tags: ["동물약국"],
            lat: lat && !isNaN(lat) ? lat : null,
            lng: lng && !isNaN(lng) ? lng : null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "name,address",
            ignoreDuplicates: false,
          },
        );

        if (error) {
          // Unique constraint 없으면 insert로 폴백
          const { error: insertErr } = await supabase
            .from("rescue_hospitals")
            .insert({
              name: row.bplcNm.trim(),
              city,
              district,
              address: address.trim(),
              phone: (row.siteTel || "").trim() || null,
              tags: ["동물약국"],
              lat: lat && !isNaN(lat) ? lat : null,
              lng: lng && !isNaN(lng) ? lng : null,
            });

          if (!insertErr) totalInserted++;
        } else {
          totalUpdated++;
        }
      }

      console.log(
        `[sync-pharmacies] Page ${page}: ${activeRows.length} active / ${rows.length} total`,
      );

      hasMore = page * pageSize < totalCount;
      page++;

      // Rate limit: 200ms between requests
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(
      `[sync-pharmacies] Done! Inserted: ${totalInserted}, Updated: ${totalUpdated}`,
    );

    return Response.json({
      success: true,
      inserted: totalInserted,
      updated: totalUpdated,
      pages: page - 1,
    });
  } catch (err) {
    console.error("[sync-pharmacies] Error:", err);
    return Response.json(
      {
        error: "동기화 실패",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

// Vercel Cron은 GET으로 호출
export async function GET(request: Request) {
  // Cron 인증
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // POST 핸들러로 위임
  return POST(request);
}
