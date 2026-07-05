import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const PROMPT = `이 고양이 사진을 분석해서 CatchCat 스타일의 캐릭터 카드를 생성해주세요.

다음 JSON만 반환 (마크다운 없이):
{
  "rarity": "common|uncommon|rare|legendary",
  "card_name": "한국어 별명 (예: 철학자 나비, 용감한 순이, 탐험가 고구마)",
  "traits": ["성격1", "성격2", "성격3"],
  "stats": { "cuteness": 0-100, "wildness": 0-100, "sociability": 0-100, "mysteriousness": 0-100 },
  "flavor": "캐릭터를 표현하는 짧은 한 줄 (20자 이내)",
  "is_real_cat": true
}

희귀도 기준:
- common: 줄무늬·단색 일반 고양이
- uncommon: 흑백, 이색 눈, 특이한 점박이
- rare: 드문 색상(크림·연회색·은회색), 독특한 무늬
- legendary: 순백, 삼색(칼리코), 불꽃색, 아주 특별한 외모

고양이가 아닌 사진이면 is_real_cat을 false로.
stats는 외모와 분위기에서 추정. 모두 합이 정확히 100일 필요 없음.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { cat_id, image_base64, mime_type, photo_url } = body;
  if (!cat_id) return NextResponse.json({ error: "missing cat_id" }, { status: 400 });
  if (!image_base64 && !photo_url) return NextResponse.json({ error: "missing image" }, { status: 400 });

  // 이미 생성된 카드면 반환
  const { data: existing } = await supabase
    .from("cats")
    .select("card_rarity,card_name,card_traits,card_stats,card_flavor,card_generated_at")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();

  if (existing?.card_generated_at) {
    return NextResponse.json({ card: existing });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no api key" }, { status: 500 });

  try {
    let imgB64: string;
    let mimeType: string;

    if (image_base64) {
      // 클라이언트에서 직접 base64로 전송 (권장)
      imgB64 = image_base64;
      mimeType = mime_type ?? "image/jpeg";
    } else {
      // 폴백: URL에서 fetch
      const imgRes = await fetch(photo_url);
      if (!imgRes.ok) throw new Error("image fetch failed");
      const imgBuf = await imgRes.arrayBuffer();
      imgB64 = Buffer.from(imgBuf).toString("base64");
      mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      PROMPT,
      { inlineData: { data: imgB64, mimeType } },
    ]);

    const raw = result.response.text().trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    if (!parsed.is_real_cat) {
      return NextResponse.json({ error: "not_a_cat" }, { status: 422 });
    }

    const card = {
      card_rarity: parsed.rarity ?? "common",
      card_name: parsed.card_name ?? null,
      card_traits: Array.isArray(parsed.traits) ? parsed.traits.slice(0, 4) : [],
      card_stats: parsed.stats ?? null,
      card_flavor: parsed.flavor ?? null,
      card_generated_at: new Date().toISOString(),
    };

    await supabase.from("cats").update(card).eq("id", cat_id).eq("caretaker_id", user.id);

    return NextResponse.json({ card });
  } catch (err) {
    console.error("[generate-card] 실패:", err);
    return NextResponse.json({ error: "generation_failed", detail: String(err) }, { status: 500 });
  }
}
