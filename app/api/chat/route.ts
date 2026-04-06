import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `너는 길고양이 보호와 공존을 돕는 '도시공존' 서비스의 AI 전문가 집사야.
따뜻하고 친절한 말투를 사용하고, 고양이 건강이나 돌봄에 대해 전문적이지만 이해하기 쉽게 설명해 줘.
답변 끝에는 항상 성우님을 응원하는 한 줄 멘트를 덧붙여줘.
반드시 500자 이내로, 핵심만 담아 2~4문장으로 간결하게 답변해.`;

// 우선순위대로 시도할 모델 목록 (가볍고 무료 티어 친화적인 순서)
const MODEL_CANDIDATES = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

async function tryChat(
  genAI: GoogleGenerativeAI,
  modelName: string,
  message: string,
  chatHistory: { role: string; parts: { text: string }[] }[],
): Promise<{ text: string; model: string }> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { maxOutputTokens: 300 },
  });

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      {
        role: "model",
        parts: [
          {
            text: "네, 도시공존 AI 집사로서 성우님을 도와드리겠습니다! 길고양이 돌봄에 대해 무엇이든 물어보세요.",
          },
        ],
      },
      ...chatHistory,
    ],
  });

  const result = await chat.sendMessage(message);
  return { text: result.response.text(), model: modelName };
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "환경변수(API KEY)가 설정되지 않았습니다.",
        debug:
          "process.env.GOOGLE_GENERATIVE_AI_API_KEY is undefined. .env.local 파일을 확인하고 서버를 재시작하세요.",
      },
      { status: 500 },
    );
  }

  try {
    const { message, history } = (await request.json()) as {
      message: string;
      history?: { role: string; text: string }[];
    };

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "메시지가 비어있습니다." },
        { status: 400 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 대화 히스토리 구성
    const chatHistory = (history ?? []).map((h) => ({
      role: h.role === "ai" ? ("model" as const) : ("user" as const),
      parts: [{ text: h.text }],
    }));

    // 모델 자동 폴백: 순서대로 시도
    const errors: string[] = [];

    for (const modelName of MODEL_CANDIDATES) {
      try {
        const result = await tryChat(genAI, modelName, message, chatHistory);
        return Response.json({ reply: result.text, model: result.model });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${modelName}] ${msg}`);

        // 404(모델 없음)면 다음 모델로, 그 외 에러는 즉시 throw
        const is404 =
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("NOT_FOUND");
        if (!is404) throw err;
      }
    }

    // 모든 모델이 404인 경우
    return Response.json(
      {
        error: "사용 가능한 AI 모델을 찾지 못했습니다.",
        debug: errors.join(" | "),
      },
      { status: 500 },
    );
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("Gemini API error:", rawMessage);

    const isQuota =
      rawMessage.includes("429") ||
      rawMessage.includes("quota") ||
      rawMessage.includes("RESOURCE_EXHAUSTED");

    if (isQuota) {
      return Response.json(
        {
          error:
            "현재 이용자가 많아 AI 집사가 잠시 쉬고 있어요. 1분 뒤에 다시 물어봐 주세요! 😿",
          debug: rawMessage,
        },
        { status: 429 },
      );
    }

    return Response.json(
      {
        error: "AI 응답 중 문제가 발생했습니다.",
        debug: rawMessage,
      },
      { status: 500 },
    );
  }
}
