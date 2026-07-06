import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { generateBattleStats } from "@/lib/battle-config";
import { TITLES, TRAITS, FLAVORS } from "@/lib/battle-card-titles";
import { calculateCatGrade, type CatFeatures } from "@/lib/cat-grade";

export const maxDuration = 30;

// 등급(rarity)과 카드 이름/플레이버는 더 이상 여기서 정하지 않는다 — AI는 "실제로 보이는 것"만
// 있는 그대로 보고하고, 등급은 lib/cat-grade.ts의 calculateCatGrade()가 룰 테이블로 산정한다.
// 이름/플레이버는 그렇게 정해진 등급에 맞춰 lib/battle-card-titles.ts에서 고른다 (아래 route 참고).
const PROMPT = `이 고양이 사진을 분석해서 CatchCat 카드에 쓸 정보를 추출해주세요.

다음 JSON만 반환 (마크다운 없이):
{
  "features": {
    "colors": ["실제 관찰되는 털색 배열 (예: black, white, orange, cream, gray 등)"],
    "pattern": "solid|tabby|tuxedo|bicolor|van|colorpoint|torbie|tortoiseshell|calico 중 실제 관찰되는 값 하나",
    "traits": ["odd_eye(양쪽 눈 색이 다름) 등 눈에 보이는 특이 형질만, 없으면 빈 배열"],
    "sex": "male|female|unknown (사진으로 확실치 않으면 반드시 unknown)",
    "confidence": "이 features 판단에 대한 본인의 확신도 0.0~1.0 (애매하면 낮게)"
  },
  "traits": ["기술1", "기술2", "기술3"],
  "stats": { "cuteness": 0-100, "wildness": 0-100, "sociability": 0-100, "mysteriousness": 0-100 },
  "is_real_cat": true
}

traits(기술) 예시 — 포켓몬 기술처럼 속성+동작 조합, 성격 형용사(애교쟁이, 겁쟁이 등) 절대 금지:
"화염 발톱", "빙결 숨결", "전격 질주", "맹독 이빨", "그림자 도약", "폭풍 발톱", "달빛 베기", "섬광 일격", "용암 발톱", "뇌전 일격"

고양이가 아닌 사진이면 is_real_cat을 false로.
stats는 외모와 분위기에서 추정. 합이 100일 필요 없음.
features는 "실제로 보이는" 색/무늬/형질만 있는 그대로 적을 것 — 등급을 의식해서 꾸미거나
추측하지 말고, 안 보이면 unknown/빈 배열로 둘 것. rarity나 이름은 절대 만들지 말 것.`;


const RARITY_ORDER = ["common", "uncommon", "rare", "legendary"] as const;
type Rarity = typeof RARITY_ORDER[number];

// 포획 게임에서 "완벽 포획" 성공 시 한 단계 업그레이드될 확률
const PERFECT_CATCH_UPGRADE_CHANCE = 0.20;

function upgradeRarity(rarity: string): Rarity {
  const idx = RARITY_ORDER.indexOf(rarity as Rarity);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return (rarity as Rarity) ?? "common";
  return Math.random() < PERFECT_CATCH_UPGRADE_CHANCE ? RARITY_ORDER[idx + 1] : (rarity as Rarity);
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// 실제 형질 기반 등급 산정. 사진이 있는 경로(is_real_cat)에서는 이 결과가 그대로
// card_rarity(=화면에 보이는 등급, 전투 스탯의 근거)의 소스가 된다 — "판정 보류"만
// card_rarity에는 못 쓰는 임시값이라 common으로 내려서 쓰고, grade 컬럼엔 pending 그대로 남긴다.
// features가 없는 경로(랜덤 폴백)는 실제 관찰값이 없다는 뜻이므로 confidence 0 → "판정 보류"가 정직한 결과.
function gradeFieldsFor(features: Partial<CatFeatures> | null | undefined) {
  const gradeResult = calculateCatGrade(features);
  return {
    gradeResult,
    fields: {
      grade: gradeResult.rarityKey,
      grade_reason: gradeResult.reason,
      grade_score: gradeResult.score,
      features: features ?? null,
      ai_confidence: features?.confidence ?? null,
      graded_at: new Date().toISOString(),
    },
  };
}

// 랜덤 카드 생성 (Gemini 폴백 or 사진 없을 때)
function makeRandomCard(catName: string, perfectCatch: boolean) {
  const r = Math.random();
  // 완벽 포획이면 높은 등급 쪽으로 살짝 기울어진 분포 사용 (레어/레전드는 낮게 유지)
  const rarity = perfectCatch
    ? (r < 0.55 ? "common" : r < 0.85 ? "uncommon" : r < 0.97 ? "rare" : "legendary")
    : (r < 0.78 ? "common" : r < 0.965 ? "uncommon" : r < 0.995 ? "rare" : "legendary");
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
  const { cat_id, image_base64, mime_type, photo_url, perfect_catch } = body;
  const perfectCatch = perfect_catch === true;
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

  // 완벽 포획 성공 횟수 집계 (타이틀 연동) — 진짜 새 카드 생성일 때만 1회 카운트
  if (perfectCatch) {
    const svc = serviceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc.from("profiles").select("perfect_catch_count").eq("id", user.id).maybeSingle();
    await svc.from("profiles").update({ perfect_catch_count: (profile?.perfect_catch_count ?? 0) + 1 }).eq("id", user.id);
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
          // 실제 형질 기반 등급 산정 — 이제 이 결과가 card_rarity의 진짜 소스다.
          // "판정 보류"는 화면에 보여줄 확정 등급이 아니므로 common으로 내려서 쓰고,
          // grade 컬럼 쪽엔 원래 결과(pending) 그대로 남겨서 나중에 재판정 여지를 남긴다.
          const { gradeResult, fields: gradeFields } = gradeFieldsFor(parsed.features);
          const baseRarity: Rarity = gradeResult.rarityKey === "pending" ? "common" : gradeResult.rarityKey;
          // 완벽 포획 보너스 — 산정된 등급 위에 확률적으로 한 단계 업그레이드 (별개의 게임 보상 메커니즘)
          const finalRarity = perfectCatch ? upgradeRarity(baseRarity) : baseRarity;

          const card = {
            card_rarity: finalRarity,
            card_name: `${pick(TITLES[finalRarity])} ${catName}`,
            card_traits: Array.isArray(parsed.traits) ? parsed.traits.slice(0, 4) : [],
            card_stats: parsed.stats ?? null,
            card_flavor: pick(FLAVORS[finalRarity]),
            card_generated_at: new Date().toISOString(),
            ...generateBattleStats(finalRarity),
          };
          await supabase.from("cats").update(card).eq("id", cat_id).eq("caretaker_id", user.id);

          // grade_* 컬럼은 별도 update — 마이그레이션 미적용으로 실패해도 위 카드 생성엔 영향 없음
          const { error: gradeErr } = await supabase.from("cats").update(gradeFields).eq("id", cat_id).eq("caretaker_id", user.id);
          if (gradeErr) console.warn("[generate-card] grade 컬럼 저장 실패 (마이그레이션 미적용 가능성):", gradeErr.message);

          return NextResponse.json({ card, grade: gradeResult });
        }
        // is_real_cat false → 랜덤 카드로 폴백
      } catch (err) {
        console.warn("[generate-card] Gemini 실패, 랜덤 카드 생성:", err);
      }
    }
  }

  // 랜덤 카드 폴백 (사진 없음 / Gemini 실패 / API 키 없음)
  const card = makeRandomCard(catName, perfectCatch);
  await supabase.from("cats").update(card).eq("id", cat_id).eq("caretaker_id", user.id);

  // 실제 관찰된 features가 없는 경로 — confidence 0으로 정직하게 "판정 보류" 처리
  const { gradeResult, fields: gradeFields } = gradeFieldsFor(null);
  const { error: gradeErr } = await supabase.from("cats").update(gradeFields).eq("id", cat_id).eq("caretaker_id", user.id);
  if (gradeErr) console.warn("[generate-card] grade 컬럼 저장 실패 (마이그레이션 미적용 가능성):", gradeErr.message);

  return NextResponse.json({ card, grade: gradeResult });
}
