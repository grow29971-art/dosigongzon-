// 고양이 사진 스타일 변환 — Pollinations.ai (영구 무료, 가입·토큰 X)
//
// 모델: FLUX (default). 가장 단순한 무료 image generation 서비스.
// API: GET https://image.pollinations.ai/prompt/{prompt}?width=...&height=...&model=flux
// 응답: binary PNG
//
// 제약:
// - text-to-image (원본 사진 그대로 변환 X)
// - 무료 tier rate limit 있지만 도시공존 베타 트래픽엔 충분
// - 외부 서비스 의존 (장애 시 변환 불가)

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    prompt: "studio ghibli anime style cute cat illustration, soft pastel colors, hand-drawn, warm lighting, fluffy fur, big sparkling eyes, detailed art",
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    prompt: "watercolor painting of a cute cat, soft brush strokes, warm color palette, paper texture, traditional art illustration, gentle bleeding edges",
  },
  {
    id: "embroidery",
    name: "실뜨기·자수",
    emoji: "🧵",
    description: "수공예 자수·실뜨기 텍스처",
    prompt: "cute cat made of colorful embroidery threads, cross stitch pattern, woolen yarn texture, handmade craft, soft fabric background, detailed embroidery art",
  },
  {
    id: "sticker",
    name: "캐릭터 스티커",
    emoji: "✨",
    description: "둥글둥글 귀여운 캐릭터 스티커",
    prompt: "cute kawaii cat character sticker, simple cartoon style, big eyes, rounded shape, vibrant solid colors, white background, vector art, chibi style",
  },
];

export function findStyleDef(id: string): StyleDef | null {
  return STYLE_DEFS.find((s) => s.id === id) ?? null;
}

export interface TransformResult {
  ok: boolean;
  outputDataUrl?: string;
  error?: string;
}

/**
 * 한국어/자유 텍스트 prompt → 영어 image generation prompt로 Gemini 번역·강화.
 * Gemini 미설정 시 원본 그대로 반환 (silent fallback).
 */
async function enhancePromptWithGemini(userPrompt: string): Promise<string> {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) return userPrompt;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text:
                "You are an image generation prompt engineer. Translate the user's Korean/free-form request into a concise English prompt for FLUX text-to-image. Focus on a single cute cat as the main subject. Add helpful style/lighting/quality keywords. No explanation, output ONLY the english prompt in one line.\n\nUser: " +
                userPrompt.slice(0, 500),
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return userPrompt;
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const out = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return out && out.length > 5 ? out : userPrompt;
  } catch {
    return userPrompt;
  }
}

/**
 * Pollinations.ai 호출 — text-to-image, 가입·토큰 불필요.
 * style: 미리 정의된 4 스타일 중 하나 또는 "custom" (사용자 직접 프롬프트)
 * customPrompt: style="custom"일 때 사용자 한국어 자유 입력. Gemini로 영어 변환.
 */
export async function transformCatImage(opts: {
  imageUrl: string;
  style: CatStyle | "custom";
  customPrompt?: string;
}): Promise<TransformResult> {
  let finalPrompt: string;
  if (opts.style === "custom") {
    const raw = (opts.customPrompt ?? "").trim();
    if (!raw) return { ok: false, error: "프롬프트를 입력해주세요." };
    if (raw.length > 500) return { ok: false, error: "프롬프트는 500자 이내로 작성해주세요." };
    finalPrompt = await enhancePromptWithGemini(raw);
  } else {
    const def = findStyleDef(opts.style);
    if (!def) return { ok: false, error: "스타일을 찾을 수 없어요." };
    finalPrompt = def.prompt;
  }

  // seed로 매번 다른 결과 생성 (cache hit 방지)
  const seed = Math.floor(Math.random() * 1_000_000);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}` +
    `?width=768&height=768&model=flux&nologo=true&enhance=true&seed=${seed}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(90_000), // 첫 호출 cold start 대비 90초
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      return { ok: false, error: `Pollinations 호출 실패: ${res.status} ${errTxt.slice(0, 200)}` };
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) {
      return { ok: false, error: `응답이 너무 작아요(${buf.byteLength}b). 잠시 후 다시 시도해주세요.` };
    }
    const base64 = Buffer.from(new Uint8Array(buf)).toString("base64");
    return { ok: true, outputDataUrl: `data:image/png;base64,${base64}` };
  } catch (e) {
    const baseMsg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && "cause" in e ? String((e as Error & { cause?: unknown }).cause).slice(0, 200) : "";
    const fullMsg = cause ? `${baseMsg} — ${cause}` : baseMsg;
    console.error("[cat-style-transform] fetch error:", fullMsg, e);
    return { ok: false, error: `[Pollinations] ${fullMsg}` };
  }
}
