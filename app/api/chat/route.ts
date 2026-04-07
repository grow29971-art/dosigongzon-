import { GoogleGenerativeAI } from "@google/generative-ai";

/* ═══ 오프라인 폴백 답변 (API 전체 실패 시) ═══ */
const OFFLINE_RESPONSES: { keywords: string[]; answer: string }[] = [
  { keywords: ["밥", "사료", "먹이", "급여", "음식", "먹"], answer: "길고양이에게는 고양이 전용 사료를 주는 것이 가장 좋아요. 사람 음식은 염분과 양념이 많아 건강에 해로울 수 있습니다. 급여 시간을 일정하게 유지하면 고양이들이 안정감을 느낀답니다. 성우님, 따뜻한 마음에 응원을 보내요!" },
  { keywords: ["추위", "겨울", "온도", "보온", "숨숨집", "쉼터", "따뜻"], answer: "숨숨집은 스티로폼 박스 안에 짚이나 담요를 깔아주면 좋아요. 입구는 고양이 한 마리가 들어갈 정도로 작게 만들어야 바람과 천적을 막을 수 있습니다. 적정 내부 온도는 15~20도예요. 성우님의 따뜻한 돌봄이 길냥이에게 큰 힘이 됩니다!" },
  { keywords: ["아파", "다쳐", "다친", "부상", "피", "출혈", "병원", "치료"], answer: "다친 길고양이를 발견하셨군요. 맨손으로 만지지 마시고 두꺼운 수건이나 장갑을 사용해주세요. 가까운 24시 동물병원으로 이송하시고, 구조 비용은 동물보호센터(1577-0954)에 문의하시면 지원받을 수 있어요. 성우님 덕분에 한 생명이 살 수 있어요!" },
  { keywords: ["TNR", "중성화", "수술", "이어팁", "번식"], answer: "TNR(포획-중성화-방사)은 길고양이 개체 수를 인도적으로 관리하는 가장 효과적인 방법이에요. 구청 동물보호 담당부서에 신청하면 무료로 진행할 수 있습니다. 이어팁이 있으면 이미 중성화된 고양이예요. 성우님의 관심이 공존의 시작입니다!" },
  { keywords: ["새끼", "아기", "냥줍", "어린"], answer: "새끼 고양이를 발견하셨나요? 먼저 2~3시간 거리를 두고 관찰해주세요. 어미가 돌아올 수 있어요. 어미가 오지 않으면 체온 유지가 가장 급해요. 수건으로 감싸고 동물병원으로 데려가주세요. 성우님, 작은 생명을 지켜주셔서 감사해요!" },
  { keywords: ["학대", "때리", "괴롭", "파손", "훼손"], answer: "동물학대를 목격하셨다면 즉시 112에 신고해주세요. 동물보호법 제8조에 따라 3년 이하 징역 또는 3,000만원 이하 벌금에 처할 수 있어요. 현장 증거를 확보하시면 큰 도움이 됩니다. 성우님의 용기가 동물을 지킵니다!" },
  { keywords: ["물", "물통", "수분"], answer: "길고양이에게 깨끗한 물을 제공해주시는 거군요! 매일 신선한 물로 교체해주시고, 겨울에는 깊은 그릇을 사용하거나 하루 2회 이상 교체해주세요. 성우님의 세심한 배려가 큰 힘이 됩니다!" },
];

const OFFLINE_FALLBACK = "좋은 질문이에요! 지금 AI 집사가 잠시 쉬고 있어서 자세한 답변이 어렵지만, 보호지침 메뉴에서 관련 가이드를 확인해보시거나 동물보호콜센터(1577-0954)에 문의해보세요. 성우님, 항상 응원합니다!";

function getOfflineResponse(question: string): string {
  const q = question.toLowerCase();
  for (const r of OFFLINE_RESPONSES) {
    if (r.keywords.some((kw) => q.includes(kw))) return r.answer;
  }
  return OFFLINE_FALLBACK;
}

const SYSTEM_PROMPT = `너는 길고양이 보호와 공존을 돕는 '도시공존' 서비스의 AI 전문가 집사야.
따뜻하고 친절한 말투를 사용하고, 고양이 건강이나 돌봄에 대해 전문적이지만 이해하기 쉽게 설명해 줘.
답변 끝에는 항상 성우님을 응원하는 한 줄 멘트를 덧붙여줘.
반드시 500자 이내로, 핵심만 담아 2~4문장으로 간결하게 답변해.`;

// 우선순위대로 시도할 모델 목록 (폭넓게 폴백)
const MODEL_CANDIDATES = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
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
        console.log(`[AI 집사] 시도: ${modelName}`);
        const result = await tryChat(genAI, modelName, message, chatHistory);
        console.log(`[AI 집사] 성공: ${modelName}`);
        return Response.json({ reply: result.text, model: result.model });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${modelName}] ${msg}`);
        console.log(`[AI 집사] 실패: ${modelName} → ${msg.slice(0, 80)}`);

        // 404/429/503 등 재시도 가능한 에러면 다음 모델로 폴백
        const canRetry =
          msg.includes("404") ||
          msg.includes("not found") ||
          msg.includes("NOT_FOUND") ||
          msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("503") ||
          msg.includes("Service Unavailable") ||
          msg.includes("500") ||
          msg.includes("overloaded");
        if (!canRetry) throw err;
      }
    }

    // 모든 모델이 실패 → 오프라인 키워드 매칭으로 답변
    console.log("[AI 집사] 모든 모델 실패, 오프라인 폴백 사용");
    const offlineReply = getOfflineResponse(message);
    return Response.json({ reply: offlineReply, model: "offline" });
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
