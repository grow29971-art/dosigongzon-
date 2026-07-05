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

// 랜덤 카드 생성 (Gemini 폴백 or 사진 없을 때)
function makeRandomCard(catName: string) {
  const adjs = ["철학자", "용감한", "탐험가", "신비로운", "잠꾸러기", "장난꾸러기", "사색가", "꿈꾸는", "방랑자", "지혜로운", "영리한", "당찬", "순한", "도도한", "느긋한", "용맹한", "온화한", "자유로운", "포근한", "예민한"];
  const traitPool = ["애교쟁이", "독립적", "수다쟁이", "조용함", "장난꾸러기", "겁쟁이", "용감함", "사교적", "내성적", "호기심 많음", "식탐", "잠꾸러기", "활발함", "도도함", "온순함", "영리함", "고집스러움", "느긋함", "충성스러움", "변덕스러움", "겁이 없음", "예민함", "포근함", "사냥꾼 기질", "경계심 강함"];
  const flavors = ["골목의 철학자, 오늘도 세상을 관찰한다", "밥만 있으면 세상이 내 것", "내 페이스대로 살아갈 뿐", "이 동네의 진짜 주인은 나야", "경계는 잠깐, 츄르는 영원히", "낮에는 잠, 밤에는 탐험", "나만의 길을 걷는 자유로운 영혼", "두 눈에 별빛을 담고 태어난 아이", "골목대장의 위엄이 느껴지는가", "먹고 자고 버티는 것이 삶", "세상 모든 종이봉투는 내 것", "햇볕 한 줌이면 충분해", "마음을 열기까지 시간이 필요할 뿐", "이 동네 소문은 나한테 물어봐", "눈빛만으로 모든 걸 말한다", "차갑지만 누구보다 따뜻한 아이", "모든 상자는 내 집이 된다", "비가 와도 내 자리는 내가 지킨다"];

  const r = Math.random();
  const rarity = r < 0.55 ? "common" : r < 0.80 ? "uncommon" : r < 0.93 ? "rare" : "legendary";
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const shuffled = [...traitPool].sort(() => Math.random() - 0.5).slice(0, 3);

  return {
    card_rarity: rarity,
    card_name: `${pick(adjs)} ${catName}`,
    card_traits: shuffled,
    card_stats: {
      cuteness:       20 + Math.floor(Math.random() * 81),
      wildness:       20 + Math.floor(Math.random() * 81),
      sociability:    15 + Math.floor(Math.random() * 76),
      mysteriousness: 20 + Math.floor(Math.random() * 81),
    },
    card_flavor: pick(flavors),
    card_generated_at: new Date().toISOString(),
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
          const card = {
            card_rarity: parsed.rarity ?? "common",
            card_name: parsed.card_name ?? `신비로운 ${catName}`,
            card_traits: Array.isArray(parsed.traits) ? parsed.traits.slice(0, 4) : [],
            card_stats: parsed.stats ?? null,
            card_flavor: parsed.flavor ?? null,
            card_generated_at: new Date().toISOString(),
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
