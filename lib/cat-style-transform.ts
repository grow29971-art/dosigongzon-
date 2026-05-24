// 고양이 사진 스타일 변환 — Gemini 2.0 Flash Image Generation (진짜 img2img)
//
// 모델: gemini-2.0-flash-preview-image-generation (베타, 2025-05 시점)
//  - 이미지 + 텍스트 input → 이미지 + 텍스트 output
//  - 원본 사진을 정확히 변환 (text-to-image와 달리)
//
// 활성 조건: GEMINI_API_KEY 환경변수 (도시공존 기본 보유)
//
// 무료 tier: RPM·RPD 제한 있음. 상세는 https://ai.google.dev/pricing
// 베타 모델이라 일부 region에서 제한 가능. 모델 ID는 GEMINI_IMAGE_MODEL 환경변수로 교체 가능.

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  // Gemini가 사진을 변환할 때 사용하는 지시문 (한국어 OK — Gemini가 이해)
  instruction: string;
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    instruction:
      "Transform this cat photo into a Studio Ghibli anime illustration. Keep the cat's pose, body shape, fur color, and surroundings, but redraw everything in soft pastel anime style with hand-drawn lines, warm lighting, and big sparkling eyes. Preserve the original composition.",
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    instruction:
      "Transform this cat photo into a soft watercolor painting. Keep the cat's pose, fur pattern, and background composition, but redraw with watercolor brush strokes, paper texture, warm color palette, and gentle bleeding edges. Preserve the original scene.",
  },
  {
    id: "embroidery",
    name: "실뜨기·자수",
    emoji: "🧵",
    description: "수공예 자수·실뜨기 텍스처",
    instruction:
      "Transform this cat photo into a handcrafted embroidery artwork made of colorful threads and cross-stitch patterns. Keep the cat's pose, body shape, and major colors, but render everything as woolen yarn texture on a soft fabric background. Preserve the original composition.",
  },
  {
    id: "sticker",
    name: "캐릭터 스티커",
    emoji: "✨",
    description: "둥글둥글 귀여운 캐릭터 스티커",
    instruction:
      "Transform this cat photo into a cute kawaii sticker character. Keep the cat's recognizable features (fur color, ear shape) but redraw in simple cartoon style with rounded shape, big eyes, vibrant solid colors, and a clean white background. Chibi proportions.",
  },
];

export function findStyleDef(id: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === id) ?? null;
}

const DEFAULT_MODEL = "gemini-2.0-flash-preview-image-generation";

export interface TransformResult {
  ok: boolean;
  outputDataUrl?: string;
  error?: string;
}

/**
 * Gemini 2.0 Flash Image Generation 호출.
 * 원본 사진 + 변환 지시문 → 변환된 이미지.
 *
 * customPrompt가 있으면 style 무시하고 그것 사용 (자유 입력 모드).
 */
export async function transformCatImage(opts: {
  imageUrl: string;
  style: CatStyle | "custom";
  customPrompt?: string;
}): Promise<TransformResult> {
  // 도시공존 기존 코드와 동일 변수명 (CLAUDE.md docs는 GEMINI_API_KEY로 적혀있었지만 실제는 이것)
  const key = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) {
    return { ok: false, error: "GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았어요." };
  }
  const model = (process.env.GEMINI_IMAGE_MODEL ?? "").trim() || DEFAULT_MODEL;

  // instruction 결정
  let instruction: string;
  if (opts.style === "custom") {
    const raw = (opts.customPrompt ?? "").trim();
    if (!raw) return { ok: false, error: "프롬프트를 입력해주세요." };
    if (raw.length > 500) return { ok: false, error: "프롬프트는 500자 이내로 작성해주세요." };
    instruction = `Transform this cat photo following the user's request: "${raw}". Keep the cat as the main subject. Apply the requested style.`;
  } else {
    const def = findStyleDef(opts.style);
    if (!def) return { ok: false, error: "스타일을 찾을 수 없어요." };
    instruction = def.instruction;
  }

  // 1) 원본 이미지 fetch → base64 + mime type
  let imageBase64: string;
  let imageMime: string;
  try {
    const imgRes = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!imgRes.ok) {
      return { ok: false, error: `원본 이미지 다운로드 실패: ${imgRes.status}` };
    }
    const buf = await imgRes.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) {
      return { ok: false, error: "원본 이미지가 5MB를 초과해요. 더 작은 사진을 사용해주세요." };
    }
    imageBase64 = Buffer.from(new Uint8Array(buf)).toString("base64");
    imageMime = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!imageMime.startsWith("image/")) imageMime = "image/jpeg";
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `원본 fetch 실패: ${e.message}` : "원본 fetch 실패" };
  }

  // 2) Gemini Image Generation 호출
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: instruction },
            { inline_data: { mime_type: imageMime, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.8,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      return { ok: false, error: `Gemini 호출 실패: ${res.status} ${errTxt.slice(0, 300)}` };
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inline_data?: { mime_type?: string; data?: string };
            inlineData?: { mimeType?: string; data?: string }; // 일부 클라이언트 camelCase
          }>;
        };
      }>;
      promptFeedback?: { blockReason?: string };
    };

    const block = json.promptFeedback?.blockReason;
    if (block) {
      return { ok: false, error: `Gemini 안전 정책으로 차단됨: ${block}` };
    }

    // 응답에서 image part 추출 (snake_case와 camelCase 둘 다 대응)
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const data = p.inline_data?.data ?? p.inlineData?.data;
      const mime = p.inline_data?.mime_type ?? p.inlineData?.mimeType ?? "image/png";
      if (data) {
        return { ok: true, outputDataUrl: `data:${mime};base64,${data}` };
      }
    }
    // 이미지 없으면 텍스트 응답 확인
    const textOnly = parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 200);
    return {
      ok: false,
      error: textOnly
        ? `Gemini가 이미지 대신 텍스트로 응답: ${textOnly}`
        : "Gemini 응답에 이미지가 없어요. 다른 사진/스타일로 다시 시도해주세요.",
    };
  } catch (e) {
    const baseMsg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && "cause" in e ? String((e as Error & { cause?: unknown }).cause).slice(0, 200) : "";
    const fullMsg = cause ? `${baseMsg} — ${cause}` : baseMsg;
    console.error("[cat-style-transform] Gemini error:", fullMsg, e);
    return { ok: false, error: `[Gemini] ${fullMsg}` };
  }
}
