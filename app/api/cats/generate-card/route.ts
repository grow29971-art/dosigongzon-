import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { generateBattleStats } from "@/lib/battle-config";
import { TITLES, TRAITS, FLAVORS } from "@/lib/battle-card-titles";

export const maxDuration = 30;

const PROMPT = `이 고양이 사진을 분석해서 포켓몬 카드 스타일의 CatchCat 캐릭터 카드를 만들어주세요.

다음 JSON만 반환 (마크다운 없이):
{
  "rarity": "common|uncommon|rare|legendary",
  "card_name": "칭호+고양이이름 형식 (예: '골목의 제왕 나비', '달빛 사냥꾼 순이', '전설 그 자체 고구마'). 단순 형용사(영리한, 용감한) 절대 금지. 포켓몬처럼 강렬하고 개성있는 칭호로.",
  "traits": ["기술1", "기술2", "기술3"],
  "stats": { "cuteness": 0-100, "wildness": 0-100, "sociability": 0-100, "mysteriousness": 0-100 },
  "flavor": "캐릭터를 표현하는 인상적인 한 줄 (20자 이내, 밋밋하면 안 됨)",
  "is_real_cat": true
}

칭호 예시 (등급별로 강도 다르게):
- common: "골목 터줏대감", "낮잠 제국의 황제", "박스 수호신", "간식 탐정", "지붕 위의 방랑자"
- uncommon: "달빛 사냥꾼", "골목의 영주", "새벽의 파수꾼", "어둠 속의 관찰자", "그림자를 걷는 자"
- rare: "번개 눈빛의 소유자", "강철 발톱의 기사", "골목의 전설", "달을 삼킨 사냥꾼", "운명을 뛰어넘은 존재"
- legendary: "세상을 본 자", "천년을 걷는 존재", "신화가 된 고양이", "별을 삼킨 황제", "전설 그 자체"

traits(기술) 예시 — 포켓몬 기술처럼 속성+동작 조합, 성격 형용사(애교쟁이, 겁쟁이 등) 절대 금지:
"화염 발톱", "빙결 숨결", "전격 질주", "맹독 이빨", "그림자 도약", "폭풍 발톱", "달빛 베기", "섬광 일격", "용암 발톱", "뇌전 일격"

희귀도 기준:
- common: 줄무늬·단색 일반 고양이
- uncommon: 흑백, 이색 눈, 특이한 점박이
- rare: 드문 색상(크림·연회색·은회색), 독특한 무늬
- legendary: 순백, 삼색(칼리코), 불꽃색, 아주 특별한 외모

고양이가 아닌 사진이면 is_real_cat을 false로.
stats는 외모와 분위기에서 추정. 합이 100일 필요 없음.`;


// 랜덤 카드 생성 (Gemini 폴백 or 사진 없을 때)
function makeRandomCard(catName: string) {
  const r = Math.random();
  const rarity = r < 0.70 ? "common" : r < 0.94 ? "uncommon" : r < 0.99 ? "rare" : "legendary";
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const shuffled = [...TRAITS].sort(() => Math.random() - 0.5).slice(0, 3);

  return {
    card_rarity: rarity,
    card_name: `${pick(TITLES[rarity])} ${catName}`,
    card_traits: shuffled,
    card_stats: {
      cuteness:       20 + Math.floor(Math.random() * 81),
      wildness:       20 + Math.floor(Math.random() * 81),
      sociability:    15 + Math.floor(Math.random() * 76),
      mysteriousness: 20 + Math.floor(Math.random() * 81),
    },
    card_flavor: pick(FLAVORS[rarity]),
    card_generated_at: new Date().toISOString(),
    ...generateBattleStats(rarity),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { cat_id, image_base64, mime_type, photo_url } = body;
  if (!cat_id) return NextResponse.json({ error: "missing cat_id" }, { status: 400 });

  // 이미 생성된 카드면 반환
  const { data: existing } = await supabase
    .from("cats")
    .select("card_rarity,card_name,card_traits,card_stats,card_flavor,card_generated_at,name")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();

  if (existing?.card_generated_at) {
    return NextResponse.json({ card: existing });
  }

  const catName = existing?.name ?? "고양이";

  // Gemini 시도 (이미지 있을 때만)
  if (image_base64 || photo_url) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (apiKey) {
      try {
        let imgB64: string;
        let mimeType: string;

        if (image_base64) {
          imgB64 = image_base64;
          mimeType = mime_type ?? "image/jpeg";
        } else {
          const imgRes = await fetch(photo_url);
          if (!imgRes.ok) throw new Error("image fetch failed");
          imgB64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
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

        if (parsed.is_real_cat) {
          const geminiRarity = parsed.rarity ?? "common";
          const card = {
            card_rarity: geminiRarity,
            card_name: parsed.card_name ?? `신비로운 ${catName}`,
            card_traits: Array.isArray(parsed.traits) ? parsed.traits.slice(0, 4) : [],
            card_stats: parsed.stats ?? null,
            card_flavor: parsed.flavor ?? null,
            card_generated_at: new Date().toISOString(),
            ...generateBattleStats(geminiRarity),
          };
          await supabase.from("cats").update(card).eq("id", cat_id).eq("caretaker_id", user.id);
          return NextResponse.json({ card });
        }
        // is_real_cat false → 랜덤 카드로 폴백
      } catch (err) {
        console.warn("[generate-card] Gemini 실패, 랜덤 카드 생성:", err);
      }
    }
  }

  // 랜덤 카드 폴백 (사진 없음 / Gemini 실패 / API 키 없음)
  const card = makeRandomCard(catName);
  await supabase.from("cats").update(card).eq("id", cat_id).eq("caretaker_id", user.id);
  return NextResponse.json({ card });
}
