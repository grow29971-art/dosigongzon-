// 고양이 사진 스타일 변환 API
// 사용자 인증 + 일일 quota + Replicate 호출
//
// 출시 직후 운영비 통제 — 사용자당 일 3회.
// admin은 무제한(테스트·시연용).

import { createClient } from "@supabase/supabase-js";
import { transformCatImage, type CatStyle } from "@/lib/cat-style-transform";

export const maxDuration = 90;

const DAILY_QUOTA = 3;

// 어드민·소셜 가입자 보호 — 변환 1건당 약 $0.01~0.04, 무제한이면 광고비 폭주
function todayStartUtcIso(): string {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  kstNow.setHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseServiceKey);

  // 인증
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await service.auth.getUser(token);
  if (!user) return Response.json({ error: "인증 실패" }, { status: 401 });

  // 정지 유저 차단
  const { data: profile } = await service
    .from("profiles")
    .select("suspended")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { suspended?: boolean } | null)?.suspended) {
    return Response.json({ error: "정지된 계정입니다." }, { status: 403 });
  }

  // admin 여부 — quota 면제
  const { data: adminRow } = await service
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  // 입력
  let body: { imageUrl?: unknown; style?: unknown; customPrompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const styleRaw = typeof body.style === "string" ? body.style : "";
  const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt : undefined;
  const validStyles = ["anime", "watercolor", "embroidery", "sticker", "custom"] as const;
  type StyleInput = (typeof validStyles)[number];
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    return Response.json({ error: "이미지 URL이 필요해요." }, { status: 400 });
  }
  if (!validStyles.includes(styleRaw as StyleInput)) {
    return Response.json({ error: "스타일이 올바르지 않아요." }, { status: 400 });
  }
  const style = styleRaw as StyleInput;

  // 일일 quota 검사 (admin 면제)
  if (!isAdmin) {
    const { count } = await service
      .from("cat_style_transforms")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStartUtcIso());
    if ((count ?? 0) >= DAILY_QUOTA) {
      return Response.json(
        { error: `오늘 변환 한도(${DAILY_QUOTA}회)를 모두 사용했어요. 내일 다시 시도해주세요.` },
        { status: 429 },
      );
    }
  }

  // Replicate img2img 호출
  const result = await transformCatImage({ imageUrl, style, customPrompt });
  if (!result.ok) {
    return Response.json({ error: result.error ?? "변환 실패" }, { status: 502 });
  }

  // 사용 기록 — quota 카운터·비용 추적
  await service.from("cat_style_transforms").insert({
    user_id: user.id,
    style,
    source_url: imageUrl,
    output_url: result.outputUrl,
    prediction_id: result.predictionId,
  });

  return Response.json({
    ok: true,
    outputUrl: result.outputUrl,
    style,
  });
}
