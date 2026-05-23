// 고양이 사진 스타일 변환 — Cloudflare Workers AI (무료 tier)
// 4가지 스타일: anime / watercolor / embroidery / sticker
//
// 활성 조건:
//  - CLOUDFLARE_ACCOUNT_ID 환경변수
//  - CLOUDFLARE_API_TOKEN 환경변수 (Workers AI 권한 포함)
//
// 모델: @cf/runwayml/stable-diffusion-v1-5-img2img (img2img 지원, 무료 tier에서 가장 안정)
// 무료 한도: 일 10,000 neurons (~수십 회 분량). 카드 등록 불필요.
// 비용: 한도 내 무료. 초과 시 카드 등록 필요(neuron당 약 $0.011/1000 neurons).
//
// 응답: 원본 이미지를 fetch → bytes → Cloudflare img2img → binary PNG 응답.
//        base64 data URL로 변환해 클라이언트에 전달(임시 표시).

export type CatStyle = "anime" | "watercolor" | "embroidery" | "sticker";

export interface StyleDef {
  id: CatStyle;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  strength: number; // img2img strength (0=원본 유지, 1=완전 새 생성). 고양이 형태 유지 위해 0.5~0.7.
}

export const STYLE_DEFS: StyleDef[] = [
  {
    id: "anime",
    name: "애니메 그림체",
    emoji: "🌸",
    description: "지브리 톤 일본 애니메 스타일",
    prompt: "studio ghibli anime style cute cat illustration, soft pastel colors, hand-drawn, warm lighting, detailed fluffy fur, big eyes",
    negativePrompt: "realistic, photograph, 3d, low quality, distorted, ugly, deformed, text, watermark",
    strength: 0.6,
  },
  {
    id: "watercolor",
    name: "수채화",
    emoji: "🎨",
    description: "부드러운 붓터치 수채화 일러스트",
    prompt: "watercolor painting of a cute cat, soft brush strokes, warm color palette, paper texture, traditional art illustration, gentle bleeding edges",
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

const DEFAULT_MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

export interface TransformResult {
  ok: boolean;
  outputDataUrl?: string; // base64 data URL — 클라이언트에서 직접 표시·다운로드
  error?: string;
}

/**
 * Cloudflare Workers AI img2img 호출.
 * 입력: 공개 접근 가능한 원본 이미지 URL.
 * 출력: 변환된 PNG의 base64 data URL.
 */
export async function transformCatImage(opts: {
  imageUrl: string;
  style: CatStyle;
}): Promise<TransformResult> {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN ?? "").trim();
  if (!accountId) {
    return { ok: false, error: "CLOUDFLARE_ACCOUNT_ID 환경변수가 설정되지 않았어요." };
  }
  if (!apiToken) {
    return { ok: false, error: "CLOUDFLARE_API_TOKEN 환경변수가 설정되지 않았어요." };
  }
  const model = (process.env.CLOUDFLARE_AI_MODEL ?? "").trim() || DEFAULT_MODEL;

  const def = findStyleDef(opts.style);
  if (!def) return { ok: false, error: "스타일을 찾을 수 없어요." };

  // 1) 원본 이미지 fetch → bytes
  let imageBytes: number[];
  try {
    const imgRes = await fetch(opts.imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!imgRes.ok) {
      return { ok: false, error: `원본 이미지 다운로드 실패: ${imgRes.status}` };
    }
    const buf = await imgRes.arrayBuffer();
    // 너무 큰 파일 차단 (~5MB 이상)
    if (buf.byteLength > 5 * 1024 * 1024) {
      return { ok: false, error: "원본 이미지가 5MB를 초과해요. 더 작은 사진을 사용해주세요." };
    }
    imageBytes = Array.from(new Uint8Array(buf));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `원본 fetch 실패: ${e.message}` : "원본 fetch 실패" };
  }

  // 2) Cloudflare Workers AI 호출
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: def.prompt,
        negative_prompt: def.negativePrompt,
        image: imageBytes,
        strength: def.strength,
        num_steps: 20,
        guidance: 7.5,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, error: `Cloudflare AI 호출 실패: ${res.status} ${err.slice(0, 200)}` };
    }

    // 응답이 binary PNG일 수도, JSON일 수도 있음(모델별 차이).
    const contentType = res.headers.get("content-type") ?? "";
    let pngBuffer: ArrayBuffer;
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as { result?: { image?: string }; errors?: unknown };
      const b64 = json.result?.image;
      if (!b64) {
        return { ok: false, error: `Cloudflare 응답 비어있음: ${JSON.stringify(json).slice(0, 200)}` };
      }
      // JSON 응답의 image는 base64 문자열
      const binStr = atob(b64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      pngBuffer = bytes.buffer;
    } else {
      pngBuffer = await res.arrayBuffer();
    }

    // 3) base64 data URL 변환
    const base64 = Buffer.from(new Uint8Array(pngBuffer)).toString("base64");
    return { ok: true, outputDataUrl: `data:image/png;base64,${base64}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}
