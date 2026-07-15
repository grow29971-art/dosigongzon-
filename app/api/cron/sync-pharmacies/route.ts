// 전국 동물약국 데이터 자동 동기화 (LOCALDATA 공공데이터 API)
// Vercel Cron: 매일 03:00 KST 자동 실행
// 수동 호출: POST /api/cron/sync-pharmacies (admin만)

import { createClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/error-report";

// LOCALDATA가 https 지원 — MITM 변조 방지 위해 https 사용
const LOCALDATA_API_URL =
  "https://www.localdata.go.kr/platform/rest/02_03_02_P/openDataApi";

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

// 외부 공공데이터 API 일시 장애(연결 타임아웃 등) 흡수 — 2회 시도, 각 15s 타임아웃.
async function fetchLocalData(url: string, attempts = 2): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(15000) });
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function POST(request: Request) {
  // Admin 체크 (Cron 호출 시에는 CRON_SECRET으로 인증)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

      let res: Response;
      try {
        res = await fetchLocalData(url.toString());
      } catch (fetchErr) {
        // 외부 공공데이터 API 일시 불가(연결 타임아웃 등) — 비-JSON 가드와 동일하게
        // Sentry 알림 없이 조용히 스킵. 다음 날 크론에서 재시도되므로 데이터 손실 없음.
        console.warn(
          `[sync-pharmacies] 외부 API fetch 실패 (page ${page}), 이번 실행 스킵: ${
            fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
          }`,
        );
        break;
      }
      if (!res.ok) {
        console.error(`[sync-pharmacies] API error: ${res.status}`);
        break;
      }

      // LOCALDATA가 점검·에러 시 200 + HTML을 리턴하는 경우가 있어 JSON 파싱 전 가드.
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        console.warn(
          `[sync-pharmacies] Non-JSON response on page ${page} (content-type=${contentType}). 다음 실행에서 재시도.`,
        );
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

    // 0건 처리 = 외부 API가 응답 안 하거나 authKey 만료 가능성 → 조용히 넘기지 않고 관리자에게 알림.
    // (2026-07-15: 4/16 이후 데이터 정지가 silent skip으로 방치됐던 문제 대응)
    if (totalInserted === 0 && totalUpdated === 0) {
      try {
        const { data: admins } = await supabase.from("admins").select("user_id");
        const ids = ((admins ?? []) as { user_id: string }[]).map((a) => a.user_id);
        if (ids.length > 0) {
          const body =
            "⚠️ 동물약국 동기화 0건 처리\n" +
            "LOCALDATA(정부) API 응답 없음 또는 authKey 만료 의심.\n" +
            "→ localdata.go.kr 에서 authKey 유효성/갱신 확인 필요.";
          await supabase.from("direct_messages").insert(
            ids.map((id) => ({
              sender_id: id, sender_name: "도시공존 운영", sender_avatar_url: null,
              receiver_id: id, receiver_name: "운영자", body,
            })),
          );
        }
      } catch (alertErr) {
        console.error("[sync-pharmacies] 실패 알림 발송 실패:", alertErr);
      }
    }

    return Response.json({
      success: true,
      inserted: totalInserted,
      updated: totalUpdated,
      pages: page - 1,
    });
  } catch (err) {
    reportError("cron/sync-pharmacies", err);
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
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // POST 핸들러로 위임
  return POST(request);
}
