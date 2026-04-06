export async function GET() {
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
      return Response.json({ error: data }, { status: res.status });
    }

    // generateContent를 지원하는 모델만 필터
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
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
