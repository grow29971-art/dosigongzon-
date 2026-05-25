// 고양이 사진 스타일 변환 — Replicate img2img
// 4 스타일: anime / watercolor / embroidery / sticker
//
// 활성 조건: REPLICATE_API_TOKEN 환경변수
// 비용: 약 $0.005~0.02/회 (모델별). 가입 시 $5 무료 크레딧 제공(카드 X).
// 무료 크레딧으로 약 250~1000회 변환 가능.

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  strength: number; // 0=원본 유지, 1=완전 새 생성. 고양이 형태 유지 위해 0.55~0.75.
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    prompt: "studio ghibli anime style cute cat illustration, soft pastel colors, hand-drawn, warm lighting, fluffy fur, detailed",
    negativePrompt: "realistic, photograph, 3d, low quality, distorted, ugly, deformed, text, watermark",
    strength: 0.6,
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    prompt: "watercolor painting of a cute cat, soft brush strokes, warm color palette, paper texture, traditional art, gentle bleeding edges",
    negativePrompt: "photograph, realistic, 3d, sharp edges, digital, low quality, text, watermark",
    strength: 0.65,
  },
  {
    id: "embroidery",
    name: "실뜨기·자수",
    emoji: "🧵",
    description: "수공예 자수·실뜨기 텍스처",
    prompt: "cute cat embroidered with colorful threads, cross stitch pattern, woolen yarn texture, handmade craft, soft fabric background, detailed embroidery",
    negativePrompt: "photograph, realistic, 3d, smooth, digital art, anime, low quality, text, watermark",
    strength: 0.7,
  },
  {
    id: "sticker",
    name: "캐릭터 스티커",
    emoji: "✨",
    description: "둥글둥글 귀여운 캐릭터 스티커",
    prompt: "cute kawaii cat character sticker, simple cartoon style, big eyes, rounded shape, vibrant solid colors, white background, vector art, chibi proportions",
    negativePrompt: "realistic, photograph, 3d, complex background, dark, scary, low quality, text, watermark, signature",
    strength: 0.65,
  },
];

export function findStyleDef(id: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === id) ?? null;
}

// SDXL img2img — 검증된 모델. 운영 중 최신 버전으로 교체 가능 (REPLICATE_MODEL_VERSION).
const DEFAULT_MODEL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

export interface TransformResult {
  ok: boolean;
  outputUrl?: string;
  error?: string;
  predictionId?: string;
}

/**
 * Replicate img2img 호출 (비동기 polling).
 * customPrompt가 있으면 4 스타일 무시하고 사용자 자유 입력 prompt 사용.
 */
export async function transformCatImage(opts: {
  imageUrl: string;
  style: CatStyle | "custom";
  customPrompt?: string;
}): Promise<TransformResult> {
  const token = (process.env.REPLICATE_API_TOKEN ?? "").trim();
  if (!token) {
    return { ok: false, error: "REPLICATE_API_TOKEN 환경변수가 설정되지 않았어요." };
  }
  const modelVersion = (process.env.REPLICATE_MODEL_VERSION ?? "").trim() || DEFAULT_MODEL_VERSION;

  // prompt 결정
  let finalPrompt: string;
  let negative = "low quality, distorted, ugly, deformed, text, watermark";
  let strength = 0.6;
  if (opts.style === "custom") {
    const raw = (opts.customPrompt ?? "").trim();
    if (!raw) return { ok: false, error: "프롬프트를 입력해주세요." };
    if (raw.length > 500) return { ok: false, error: "프롬프트는 500자 이내로 작성해주세요." };
    finalPrompt = raw;
  } else {
    const def = findStyleDef(opts.style);
    if (!def) return { ok: false, error: "스타일을 찾을 수 없어요." };
    finalPrompt = def.prompt;
    negative = def.negativePrompt;
    strength = def.strength;
  }

  try {
    // 1) prediction 생성
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          image: opts.imageUrl,
          prompt: finalPrompt,
          negative_prompt: negative,
          prompt_strength: strength,
          width: 768,
          height: 768,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "");
      return { ok: false, error: `Replicate 호출 실패: ${createRes.status} ${err.slice(0, 200)}` };
    }
    const created = (await createRes.json()) as {
      id: string;
      status: string;
      urls?: { get?: string };
    };
    const predictionId = created.id;
    const pollUrl = created.urls?.get ?? `https://api.replicate.com/v1/predictions/${predictionId}`;

    // 2) polling — 최대 60초
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!pollRes.ok) continue;
      const poll = (await pollRes.json()) as {
        status: string;
        output?: string | string[];
        error?: string;
      };
      if (poll.status === "succeeded") {
        const outputUrl = Array.isArray(poll.output) ? poll.output[0] : poll.output;
        if (!outputUrl) {
          return { ok: false, error: "변환 결과가 비어있어요.", predictionId };
        }
        return { ok: true, outputUrl, predictionId };
      }
      if (poll.status === "failed" || poll.status === "canceled") {
        return { ok: false, error: poll.error ?? "변환 실패", predictionId };
      }
    }
    return { ok: false, error: "변환 시간이 초과됐어요(60초). 잠시 후 다시 시도해주세요.", predictionId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}
