// 고양이 사진 스타일 변환 — Replicate API 연동
// 4가지 스타일: anime / watercolor / embroidery / sticker
//
// 활성 조건: REPLICATE_API_TOKEN 환경변수 설정
// 미설정 시 호출하면 명시적 에러 반환 — silent fail 안 함(운영자가 누락 즉시 감지).
//
// 비용: 약 $0.01~0.04/회 (스타일별, Replicate price 변동 가능)
// rate limit은 호출 전 별도 enforce (DB 카운터 or rate-limit-repo)

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  // 프롬프트 — 모델·튜닝 후 조정. img2img 시 strength도 함께 조정.
  prompt: string;
  negativePrompt: string;
  // img2img strength (0=원본 유지, 1=완전 새로 생성). 고양이 형태 유지 위해 0.55~0.75 권장.
  strength: number;
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    prompt: "studio ghibli anime style cute cat illustration, soft pastel colors, anime drawing, hand-drawn, warm lighting, detailed eyes, fluffy fur",
    negativePrompt: "realistic, photograph, 3d, low quality, distorted, ugly, deformed, text, watermark",
    strength: 0.65,
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    prompt: "watercolor painting of a cute cat, soft brush strokes, warm color palette, paper texture, gentle bleeding edges, traditional art, illustration",
    negativePrompt: "photograph, realistic, 3d, sharp edges, digital, low quality, text, watermark",
    strength: 0.7,
  },
  {
    id: "embroidery",
    name: "실뜨기·자수",
    emoji: "🧵",
    description: "수공예 자수·실뜨기 텍스처",
    prompt: "cute cat embroidered with colorful threads, cross stitch, woolen yarn texture, handmade craft, soft fabric background, detailed embroidery pattern, top view",
    negativePrompt: "photograph, realistic, 3d, smooth, digital art, anime, low quality, text, watermark",
    strength: 0.75,
  },
  {
    id: "sticker",
    name: "캐릭터 스티커",
    emoji: "✨",
    description: "둥글둥글 귀여운 캐릭터 스티커",
    prompt: "cute kawaii cat character sticker, simple cartoon style, big eyes, rounded shape, vibrant solid colors, white background, vector art, chibi proportions",
    negativePrompt: "realistic, photograph, 3d, complex background, dark, scary, low quality, text, watermark, signature",
    strength: 0.7,
  },
];

export function findStyleDef(id: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === id) ?? null;
}

// Replicate SDXL img2img — 모델 버전 ID는 운영 환경에서 가장 안정된 것으로 고정.
// stability-ai/sdxl 또는 변환 특화 모델로 변경 가능.
// 이 값은 환경변수로 빼서 운영 중 모델 교체 가능하게 함.
const DEFAULT_MODEL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
// ↑ stability-ai/sdxl 의 한 안정 버전. 운영 시점에 latest로 교체 권장.

export interface TransformResult {
  ok: boolean;
  outputUrl?: string;
  error?: string;
  predictionId?: string;
}

/**
 * Replicate 변환 호출 (비동기 polling).
 * 입력: 원본 이미지 URL(공개 접근 가능해야 함 — Supabase Storage public 버킷 OK)
 * 출력: 변환된 이미지 URL(Replicate CDN)
 *
 * 호출 흐름: prediction 생성 → 완료까지 polling → output URL 반환
 * 시간: 보통 15~40초. timeout 60초.
 */
export async function transformCatImage(opts: {
  imageUrl: string;
  style: CatStyle;
  width?: number;
  height?: number;
}): Promise<TransformResult> {
  const token = (process.env.REPLICATE_API_TOKEN ?? "").trim();
  if (!token) {
    return { ok: false, error: "REPLICATE_API_TOKEN 환경변수가 설정되지 않았어요." };
  }
  const modelVersion = (process.env.REPLICATE_MODEL_VERSION ?? "").trim() || DEFAULT_MODEL_VERSION;

  const def = findStyleDef(opts.style);
  if (!def) {
    return { ok: false, error: "스타일을 찾을 수 없어요." };
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
          prompt: def.prompt,
          negative_prompt: def.negativePrompt,
          prompt_strength: def.strength,
          width: opts.width ?? 768,
          height: opts.height ?? 768,
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
    const created = (await createRes.json()) as { id: string; status: string; urls?: { get?: string } };
    const predictionId = created.id;
    const pollUrl = created.urls?.get ?? `https://api.replicate.com/v1/predictions/${predictionId}`;

    // 2) polling — 최대 60초 (2초 간격 × 30회)
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
