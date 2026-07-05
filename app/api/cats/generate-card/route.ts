import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const PROMPT = `이 고양이 사진을 분석해서 포켓몬 카드 스타일의 CatchCat 캐릭터 카드를 만들어주세요.

다음 JSON만 반환 (마크다운 없이):
{
  "rarity": "common|uncommon|rare|legendary",
  "card_name": "칭호+고양이이름 형식 (예: '골목의 제왕 나비', '달빛 사냥꾼 순이', '전설 그 자체 고구마'). 단순 형용사(영리한, 용감한) 절대 금지. 포켓몬처럼 강렬하고 개성있는 칭호로.",
  "traits": ["성격1", "성격2", "성격3"],
  "stats": { "cuteness": 0-100, "wildness": 0-100, "sociability": 0-100, "mysteriousness": 0-100 },
  "flavor": "캐릭터를 표현하는 인상적인 한 줄 (20자 이내, 밋밋하면 안 됨)",
  "is_real_cat": true
}

칭호 예시 (등급별로 강도 다르게):
- common: "골목 터줏대감", "낮잠 제국의 황제", "박스 수호신", "간식 탐정", "지붕 위의 방랑자"
- uncommon: "달빛 사냥꾼", "골목의 영주", "새벽의 파수꾼", "어둠 속의 관찰자", "그림자를 걷는 자"
- rare: "번개 눈빛의 소유자", "강철 발톱의 기사", "골목의 전설", "달을 삼킨 사냥꾼", "운명을 뛰어넘은 존재"
- legendary: "세상을 본 자", "천년을 걷는 존재", "신화가 된 고양이", "별을 삼킨 황제", "전설 그 자체"

희귀도 기준:
- common: 줄무늬·단색 일반 고양이
- uncommon: 흑백, 이색 눈, 특이한 점박이
- rare: 드문 색상(크림·연회색·은회색), 독특한 무늬
- legendary: 순백, 삼색(칼리코), 불꽃색, 아주 특별한 외모

고양이가 아닌 사진이면 is_real_cat을 false로.
stats는 외모와 분위기에서 추정. 합이 100일 필요 없음.`;

// 등급별 칭호 풀 (포켓몬스터 스타일)
const TITLES = {
  common: [
    "골목의 터줏대감", "낮잠 제국의 황제", "박스 수호신", "간식 탐정",
    "지붕 위의 방랑자", "새벽 골목 순찰대", "그늘의 주민", "밥그릇 지킴이",
    "종이봉투 파괴자", "무릎 위의 지배자", "창가의 감시자", "햇살 수집가",
    "하품의 달인", "캣타워의 왕", "골목 입구의 터줏대감", "먼지 속의 철학자",
    "쓰레기통 옆 귀족", "담벼락 위의 사색가", "츄르를 기다리는 자",
  ],
  uncommon: [
    "달빛 사냥꾼", "골목의 왕", "별빛 아래의 철학자", "새벽의 파수꾼",
    "어둠 속의 관찰자", "발소리 없는 사냥꾼", "도도한 귀족", "그림자를 걷는 자",
    "비 오는 날의 현자", "골목의 영주", "눈빛만으로 지배하는 자",
    "폭풍 전 고요의 수호자", "황혼의 사냥꾼", "심야의 탐험가",
    "도시를 헤매는 방랑 기사", "별빛을 먹고 자란 아이",
  ],
  rare: [
    "번개 눈빛의 소유자", "강철 발톱의 기사", "폭풍을 부르는 자",
    "전설적 간식 헌터", "시간을 멈추는 눈빛", "어둠의 귀족",
    "골목의 전설", "달을 삼킨 사냥꾼", "고독한 제왕",
    "벼락을 품은 야수", "밤을 지배하는 자", "운명을 뛰어넘은 존재",
    "두 세계를 걷는 자", "별자리를 꿰뚫는 눈빛",
  ],
  legendary: [
    "세상을 본 자", "천년을 걷는 존재", "신화가 된 고양이",
    "시대를 초월한 전설", "별을 삼킨 황제", "전설 그 자체",
    "우주를 품은 눈빛", "신들도 경배하는", "불멸의 지배자",
    "모든 골목의 신", "세상 끝을 본 자", "현실을 구부리는 존재",
  ],
};

const TRAITS = ["애교 폭발", "독립 정신", "수다쟁이", "과묵한 신사", "장난의 신", "겁쟁이 귀족", "무모한 용감함", "사교계의 꽃", "고독한 내성파", "끝없는 호기심", "식탐 장인", "수면 전문가", "에너지 폭발", "도도한 카리스마", "온순한 바보", "천재적 직감", "강철 고집", "달팽이 템포", "충성스러운 전사", "예측 불가 변덕", "무적의 멘탈", "초예민 안테나", "포근한 솜사탕", "타고난 사냥꾼", "경계심 레이더"];

const FLAVORS = {
  common: [
    "밥만 있으면 세상이 내 것", "내 페이스대로 살아갈 뿐",
    "경계는 잠깐, 츄르는 영원히", "먹고 자고 버티는 것이 삶",
    "세상 모든 종이봉투는 내 것", "햇볕 한 줌이면 충분해",
    "비가 와도 내 자리는 내가 지킨다", "하루 22시간 수면이 목표",
  ],
  uncommon: [
    "이 동네의 진짜 주인은 나야", "낮에는 잠, 밤에는 탐험",
    "이 동네 소문은 나한테 물어봐", "눈빛만으로 모든 걸 말한다",
    "차갑지만 누구보다 따뜻한 아이", "모든 상자는 내 집이 된다",
    "어둠 속에서도 내 길을 안다",
  ],
  rare: [
    "두 눈에 별빛을 담고 태어난 아이", "골목대장의 위엄이 느껴지는가",
    "나만의 길을 걷는 자유로운 영혼", "마음을 열기까지 시간이 필요할 뿐",
    "전설은 스스로 만드는 것이다", "밤하늘의 별도 내 앞에선 고개를 숙인다",
  ],
  legendary: [
    "나는 전설이다. 증명할 필요 없다", "우주가 내 탄생을 기억한다",
    "신화는 언제나 이런 눈빛에서 시작된다", "골목에서 태어났으나 세상을 지배한다",
    "천 년을 살아도 부족할 존재",
  ],
};

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
