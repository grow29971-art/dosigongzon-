// 고양이 사진 스타일 변환 — Hugging Face Inference API (완전 무료 tier)
// 4가지 스타일: anime / watercolor / embroidery / sticker
//
// 활성 조건:
//  - HUGGINGFACE_API_TOKEN 환경변수 (Read 권한이면 충분)
//
// 무료 tier 제약:
//  - cold start: 모델이 sleep 상태면 첫 호출 시 ~20~40초 대기. 다음 호출은 빠름.
//  - rate limit: 시간당 약 100~300 회 (변동)
//  - 카드 등록 불필요
//
// 모델: stabilityai/stable-diffusion-xl-base-1.0 (text-to-image)
//  - HF 무료 tier에서 가장 안정. img2img 모델은 free tier에서 거의 sleep 상태라 비실용.
//  - 본인 cat 사진은 prompt 힌트로 사용 — 원본 그대로 변환은 아니지만 "이 스타일의 고양이 그림" 생성.
// 사용자가 원본 사진을 보면서 비슷한 분위기 스타일 생성. 정확한 reproduction은 X.

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  negativePrompt: string;
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    prompt: "studio ghibli anime style cute cat, soft pastel colors, hand-drawn illustration, warm lighting, fluffy fur, big sparkling eyes, detailed",
    negativePrompt: "realistic, photograph, 3d, low quality, distorted, ugly, deformed, text, watermark",
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    prompt: "watercolor painting of a cute cat, soft brush strokes, warm color palette, paper texture, traditional art, gentle bleeding edges, detailed",
    negativePrompt: "photograph, realistic, 3d, sharp edges, digital, low quality, text, watermark",
  },
  {
    id: "embroidery",
    name: "실뜨기·자수",
    emoji: "🧵",
    description: "수공예 자수·실뜨기 텍스처",
    prompt: "cute cat embroidered with colorful threads, cross stitch pattern, woolen yarn texture, handmade craft, soft fabric background, detailed embroidery",
    negativePrompt: "photograph, realistic, 3d, smooth, digital art, anime, low quality, text, watermark",
  },
  {
    id: "sticker",
    name: "캐릭터 스티커",
    emoji: "✨",
    description: "둥글둥글 귀여운 캐릭터 스티커",
    prompt: "cute kawaii cat character sticker, simple cartoon style, big eyes, rounded shape, vibrant solid colors, white background, vector art, chibi",
    negativePrompt: "realistic, photograph, 3d, complex background, dark, scary, low quality, text, watermark, signature",
  },
];

export function findStyleDef(id: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === id) ?? null;
}

const DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

export interface TransformResult {
  ok: boolean;
  outputDataUrl?: string; // base64 data URL
  error?: string;
}

/**
 * Hugging Face Inference API 호출.
 * text-to-image — prompt만 보내고 binary PNG 받음.
 * sourceImageUrl은 향후 img2img 모델 통합 시 사용 예정(현재는 무시).
 */
export async function transformCatImage(opts: {
  imageUrl: string; // 미사용(향후 img2img 확장용)
  style: CatStyle;
}): Promise<TransformResult> {
  const token = (process.env.HUGGINGFACE_API_TOKEN ?? "").trim();
  if (!token) {
    return { ok: false, error: "HUGGINGFACE_API_TOKEN 환경변수가 설정되지 않았어요." };
  }
  const model = (process.env.HUGGINGFACE_MODEL ?? "").trim() || DEFAULT_MODEL;

  const def = findStyleDef(opts.style);
  if (!def) return { ok: false, error: "스타일을 찾을 수 없어요." };

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: def.prompt,
        parameters: {
          negative_prompt: def.negativePrompt,
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
        options: {
          wait_for_model: true, // cold start 시 자동 대기 (서버 sleep 깨우기)
        },
      }),
      signal: AbortSignal.timeout(90_000), // cold start 대비 90초
    });

    if (!res.ok) {
      // HF는 cold start 또는 일시적 503 시 JSON으로 응답
      const ctype = res.headers.get("content-type") ?? "";
      if (ctype.includes("application/json")) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; estimated_time?: number };
        const detail = err.error ?? "";
        const wait = err.estimated_time ? ` (${Math.ceil(err.estimated_time)}초 대기)` : "";
        return { ok: false, error: `HF 응답: ${detail}${wait} — 잠시 후 다시 시도해주세요.` };
      }
      const errTxt = await res.text().catch(() => "");
      return { ok: false, error: `Hugging Face 호출 실패: ${res.status} ${errTxt.slice(0, 200)}` };
    }

    // 정상 응답 — binary PNG
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) {
      // 비정상적으로 작은 응답 — 에러 본문일 가능성
      return { ok: false, error: `응답이 너무 작아요(${buf.byteLength}b). 잠시 후 다시 시도해주세요.` };
    }
    const base64 = Buffer.from(new Uint8Array(buf)).toString("base64");
    return { ok: true, outputDataUrl: `data:image/png;base64,${base64}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}
