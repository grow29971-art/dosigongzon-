// 기존 고양이 마커 캐릭터 색 백필 (일회성 배치, 2026-08-04)
// 사진은 있는데 art_colors가 없는 고양이를 배치(기본 8마리)로 Gemini Vision에 넣어
// 실측 털색(fur_hex)·무늬색(pattern_hex)·팔레트 키(art_key)를 채운다.
// 수동 호출: POST /api/cron/backfill-cat-art (CRON_SECRET 필요) — remaining이 0이 될 때까지 반복 호출.
//
// 안전장치:
//   - SSRF: 우리 Supabase Storage public URL로 시작하는 사진만 서버가 fetch.
//     외부 URL(kakao 등)·비정상 URL은 {"none":true} 마킹 후 스킵 (재처리 루프 방지).
//   - 비용: increment_ai_call 글로벌 일일 서킷브레이커 공유 (generate-card와 동일 천장).
//   - 판독 실패/고양이 아님도 {"none":true} 마킹 — 다음 배치에서 제외.

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase/service";
import { deriveArtKey, deriveArtColors } from "@/lib/cat-art";

export const maxDuration = 60;

const BATCH = 8;
const AI_DAILY_LIMIT = 5000; // generate-card와 동일
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const PROMPT = `이 사진 속 고양이의 외형만 판독해서 JSON만 반환 (마크다운 없이):
{
  "is_cat": true,
  "colors": ["실제 관찰되는 털색 배열 (예: black, white, orange, cream, gray)"],
  "pattern": "solid|tabby|tuxedo|bicolor|van|colorpoint|torbie|tortoiseshell|calico 중 하나",
  "traits": ["odd_eye 등 보이는 특이 형질만, 없으면 빈 배열"],
  "fur_hex": "#RRGGBB — 고양이 몸통 털의 대표색 (배경/그림자 제외, 실제 픽셀 색감)",
  "pattern_hex": "#RRGGBB 또는 null — 줄무늬/패치 등 무늬 색. 무늬 없으면 null"
}
고양이가 아니면 is_cat을 false로. 안 보이는 건 추측하지 말 것.`;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!supabaseUrl || !apiKey) {
    return NextResponse.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const storagePrefix = `${supabaseUrl}/storage/v1/object/public/`;

  const svc = createServiceClient();
  const { data: targets, error: listErr } = await svc
    .from("cats")
    .select("id, photo_url")
    .not("photo_url", "is", null)
    .is("art_colors", null)
    .order("created_at", { ascending: false })
    .limit(BATCH);
  if (listErr) {
    // art_colors 컬럼 미생성 등 — 마이그레이션 먼저 실행 필요
    return NextResponse.json({ error: `조회 실패: ${listErr.message}` }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let done = 0, skipped = 0, capped = false;
  const reasons: Array<{ id: string; reason: string }> = []; // 배치별 스킵/실패 사유 (진단용)
  for (const cat of targets ?? []) {
    // 우리 Storage 사진만 서버 fetch (SSRF 가드) — 외부 URL은 스킵 마킹
    if (!cat.photo_url || !cat.photo_url.startsWith(storagePrefix)) {
      await svc.from("cats").update({ art_colors: { none: true } }).eq("id", cat.id);
      skipped++;
      reasons.push({ id: cat.id, reason: "external_url" });
      continue;
    }

    // 글로벌 일일 서킷브레이커 (fail-open: RPC 미배포면 진행)
    try {
      const { data: allowed, error } = await svc.rpc("increment_ai_call", { p_limit: AI_DAILY_LIMIT });
      if (!error && allowed === false) { capped = true; break; }
    } catch { /* fail-open */ }

    try {
      const res = await fetch(cat.photo_url);
      if (!res.ok) throw new Error(`photo fetch ${res.status}`);
      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) throw new Error("photo size");
      const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/webp";
      const b64 = Buffer.from(buf).toString("base64");

      const result = await model.generateContent([PROMPT, { inlineData: { data: b64, mimeType } }]);
      const raw = result.response.text().trim().replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);

      if (!parsed.is_cat) {
        await svc.from("cats").update({ art_colors: { none: true } }).eq("id", cat.id);
        skipped++;
        reasons.push({ id: cat.id, reason: `not_cat raw=${raw.slice(0, 120)}` });
        continue;
      }
      const artKey = deriveArtKey(parsed);
      const artColors = deriveArtColors(parsed);
      const fields: Record<string, unknown> = { art_colors: artColors ?? { none: true } };
      if (artKey) fields.art_key = artKey;
      const { error: upErr } = await svc.from("cats").update(fields).eq("id", cat.id);
      if (upErr) reasons.push({ id: cat.id, reason: `update_fail ${upErr.message}` });
      if (artColors) done++;
      else { skipped++; reasons.push({ id: cat.id, reason: `no_colors raw=${raw.slice(0, 120)}` }); }
    } catch (err) {
      // 일시 오류(네트워크·파싱)는 마킹하지 않고 다음 배치에서 재시도
      console.warn("[backfill-cat-art] 실패:", cat.id, err);
      skipped++;
      reasons.push({ id: cat.id, reason: `error ${err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160)}` });
    }
  }

  const { count: remaining } = await svc
    .from("cats")
    .select("id", { count: "exact", head: true })
    .not("photo_url", "is", null)
    .is("art_colors", null);

  return NextResponse.json({ done, skipped, capped, remaining: remaining ?? 0, reasons });
}
