import { createClient } from "@/lib/supabase/server";

export async function GET() {
  // admin 전용 디버그 엔드포인트
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return Response.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API KEY 없음" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    const data = await res.json();

    if (!res.ok) {
      console.error("[models] upstream error:", res.status);
      return Response.json({ error: "모델 조회 실패" }, { status: res.status });
    }

    const models = (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string; displayName: string }) => ({
        name: m.name,
        displayName: m.displayName,
      }));

    return Response.json({ count: models.length, models });
  } catch (err) {
    console.error("[models] fetch failed:", err);
    return Response.json({ error: "모델 조회 실패" }, { status: 500 });
  }
}
