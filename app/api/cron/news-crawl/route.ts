// 길고양이 뉴스 자동 수집 (Google News RSS)
// Vercel Cron: 매일 09:00 KST 자동 실행
// 수동 호출: GET/POST /api/cron/news-crawl (CRON_SECRET 필요)

import { createClient } from "@supabase/supabase-js";
import { crawlAll } from "@/lib/news-crawler";
import { reportError } from "@/lib/error-report";

export const maxDuration = 300;

// 자동수집 항목 보존 기간(일). 이 기간 지난 auto_imported=true 글은 매 실행마다 정리.
const RETENTION_DAYS = 30;

async function handle(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const items = await crawlAll();
    console.log(`[news-crawl] fetched ${items.length} items`);

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      const { error } = await supabase.from("news").insert({
        badge_type: item.badge_type,
        title: item.title,
        description: item.description,
        // 언론사 썸네일은 저작권 이슈로 저장/표시하지 않음 (2026-07-12) — 제목+아웃링크만
        image_url: null,
        external_url: item.source_url,
        external_label: item.source_name
          ? `${item.source_name}에서 보기`
          : "원문 보기",
        source_url: item.source_url,
        source_name: item.source_name,
        auto_imported: true,
        pinned: false,
        date_label: null,
        dday: null,
        event_date: null,
        body: null,
      });

      if (error) {
        // 23505 = unique_violation (source_url 이미 있음 → 정상 스킵)
        if (error.code === "23505") {
          skipped++;
        } else {
          console.warn("[news-crawl] insert error:", error.code, error.message);
        }
      } else {
        inserted++;
      }
    }

    // 오래된 자동수집 항목 정리
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { count: deleted, error: deleteErr } = await supabase
      .from("news")
      .delete({ count: "exact" })
      .eq("auto_imported", true)
      .eq("pinned", false)
      .lt("created_at", cutoff);

    if (deleteErr) {
      console.warn("[news-crawl] cleanup error:", deleteErr.message);
    }

    console.log(
      `[news-crawl] inserted=${inserted} skipped=${skipped} deleted=${deleted ?? 0}`,
    );

    return Response.json({
      ok: true,
      fetched: items.length,
      inserted,
      skipped,
      deleted: deleted ?? 0,
    });
  } catch (err) {
    reportError("cron/news-crawl", err);
    return Response.json(
      {
        error: "크롤링 실패",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
