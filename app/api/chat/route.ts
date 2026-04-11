import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

// ── 유저당 레이트리밋 (인메모리, 인스턴스별) ──
// 분산 환경에선 Redis 권장. 지금은 단일 서버 MVP 기준.
const RATE_LIMIT = 10; // 윈도우당 최대 호출
const RATE_WINDOW_MS = 60_000; // 1분
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

/* ═══ 오프라인 폴백 답변 (API 전체 실패 시) ═══
 * {name} 플레이스홀더는 요청의 userName(또는 기본 "집사님")으로 치환됨.
 */
const OFFLINE_RESPONSES: { keywords: string[]; answer: string }[] = [
  { keywords: ["밥", "사료", "먹이", "급여", "음식", "먹"], answer: "길고양이에게는 고양이 전용 사료를 주는 것이 가장 좋아요. 사람 음식은 염분과 양념이 많아 건강에 해로울 수 있습니다. 급여 시간을 일정하게 유지하면 고양이들이 안정감을 느낀답니다. {name}, 따뜻한 마음에 응원을 보내요!" },
  { keywords: ["추위", "겨울", "온도", "보온", "숨숨집", "쉼터", "따뜻"], answer: "숨숨집은 스티로폼 박스 안에 짚이나 담요를 깔아주면 좋아요. 입구는 고양이 한 마리가 들어갈 정도로 작게 만들어야 바람과 천적을 막을 수 있습니다. 적정 내부 온도는 15~20도예요. {name}의 따뜻한 돌봄이 길냥이에게 큰 힘이 됩니다!" },
  { keywords: ["아파", "다쳐", "다친", "부상", "피", "출혈", "병원", "치료"], answer: "다친 길고양이를 발견하셨군요. 맨손으로 만지지 마시고 두꺼운 수건이나 장갑을 사용해주세요. 가까운 24시 동물병원으로 이송하시고, 구조 비용은 동물보호센터(1577-0954)에 문의하시면 지원받을 수 있어요. {name} 덕분에 한 생명이 살 수 있어요!" },
  { keywords: ["TNR", "중성화", "수술", "이어팁", "번식"], answer: "TNR(포획-중성화-방사)은 길고양이 개체 수를 인도적으로 관리하는 가장 효과적인 방법이에요. 구청 동물보호 담당부서에 신청하면 무료로 진행할 수 있습니다. 이어팁이 있으면 이미 중성화된 고양이예요. {name}의 관심이 공존의 시작입니다!" },
  { keywords: ["새끼", "아기", "냥줍", "어린"], answer: "새끼 고양이를 발견하셨나요? 먼저 2~3시간 거리를 두고 관찰해주세요. 어미가 돌아올 수 있어요. 어미가 오지 않으면 체온 유지가 가장 급해요. 수건으로 감싸고 동물병원으로 데려가주세요. {name}, 작은 생명을 지켜주셔서 감사해요!" },
  { keywords: ["학대", "때리", "괴롭", "파손", "훼손"], answer: "동물학대를 목격하셨다면 즉시 112에 신고해주세요. 동물보호법 제8조에 따라 3년 이하 징역 또는 3,000만원 이하 벌금에 처할 수 있어요. 현장 증거를 확보하시면 큰 도움이 됩니다. {name}의 용기가 동물을 지킵니다!" },
  { keywords: ["물", "물통", "수분"], answer: "길고양이에게 깨끗한 물을 제공해주시는 거군요! 매일 신선한 물로 교체해주시고, 겨울에는 깊은 그릇을 사용하거나 하루 2회 이상 교체해주세요. {name}의 세심한 배려가 큰 힘이 됩니다!" },
];

const OFFLINE_FALLBACK = "좋은 질문이에요! 지금 AI 집사가 잠시 쉬고 있어서 자세한 답변이 어렵지만, 도시공존 앱의 보호지침 메뉴에서 관련 가이드를 확인해보시거나 동물보호콜센터(1577-0954)에 문의해보세요. 병원 탭에서 근처 협력병원도 찾아보실 수 있어요! {name}, 항상 응원합니다!";

const OFFLINE_EXTRAS: { keywords: string[]; answer: string }[] = [
  { keywords: ["쉼터", "온열", "온도", "IoT", "모니터링"], answer: "도시공존 앱 홈 화면에서 무선 온열 쉼터의 온도, 습도, 배터리 상태를 실시간으로 확인하실 수 있어요. 쉼터 내부 적정 온도는 15~20도 사이가 좋습니다. {name}의 쉼터가 길냥이들에게 큰 힘이 됩니다!" },
  { keywords: ["앱", "기능", "도시공존", "뭐해", "뭘 할 수"], answer: "도시공존 앱에서는 길고양이 지도, 돌봄 기록, 동네 기반 커뮤니티, 구조동물 치료 도움병원, 보호지침(냥줍/응급/포획/법률 가이드), 그리고 저 AI 집사까지 이용하실 수 있어요! {name}과 함께 공존의 길을 걸어가요!" },
];

function addressTerm(name: string | undefined | null): string {
  const n = (name ?? "").trim();
  if (!n) return "집사님";
  // "이미 '님'이 붙어있으면 그대로, 아니면 붙여줌"
  if (n.endsWith("님")) return n;
  return `${n}님`;
}

function substituteName(template: string, name: string): string {
  return template.replaceAll("{name}", name);
}

function getOfflineResponse(question: string, name: string): string {
  const q = question.toLowerCase();
  for (const r of OFFLINE_RESPONSES) {
    if (r.keywords.some((kw) => q.includes(kw))) {
      return substituteName(r.answer, name);
    }
  }
  for (const r of OFFLINE_EXTRAS) {
    if (r.keywords.some((kw) => q.includes(kw))) {
      return substituteName(r.answer, name);
    }
  }
  return substituteName(OFFLINE_FALLBACK, name);
}

function buildSystemPrompt(name: string): string {
  return `너는 '도시공존' 앱의 AI 집사야. 길고양이 보호와 도시 공존을 전문으로 하는 따뜻한 조력자야.

[너의 성격]
- 따뜻하고 친절하며 전문적인 말투 사용
- 어려운 용어는 쉽게 풀어서 설명
- 사용자 호칭은 반드시 "${name}" 으로만 부를 것. 다른 이름(예: "성우님")을 절대 사용하지 말 것.
- 답변 끝에 ${name}을 응원하는 짧은 한 줄 멘트 추가

[도시공존 서비스에 대한 지식]
- 길고양이 지도: 동네 고양이 위치와 돌봄 기록 공유
- 구조동물 치료 도움병원: 길고양이 치료를 지원하는 병원 목록
- 동네 커뮤니티: 긴급/임보/입양/중고마켓/자유게시판 카테고리
- 보호지침: 냥줍 가이드, 응급 구조, 포획 가이드, 법률 가이드(동물보호법)
- TNR: 포획-중성화-방사 사업. 구청 동물보호 담당부서에서 무료 진행 가능

[답변 규칙]
- 핵심만 담아 3~6문장으로 간결하지만 끊기지 않게 완결된 문장으로 답변
- 길고양이와 무관한 질문에도 친절하게 응대하되, 길고양이 관련 정보로 자연스럽게 유도
- 위급한 상황(학대, 부상)에는 즉시 신고 번호 안내 (경찰 112, 동물보호콜센터 1577-0954)`;
}

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
  addressName: string,
): Promise<{ text: string; model: string }> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { maxOutputTokens: 2048 },
  });

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: buildSystemPrompt(addressName) }] },
      {
        role: "model",
        parts: [
          {
            text: `네, 도시공존 AI 집사로서 ${addressName}을 도와드리겠습니다! 길고양이 돌봄에 대해 무엇이든 물어보세요.`,
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
  // 인증 체크: 로그인 유저만 — API 크레딧 보호
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  // 레이트리밋
  const rl = checkRateLimit(user.id);
  if (!rl.ok) {
    return Response.json(
      { error: `잠시 후 다시 시도해주세요. (${rl.retryAfter}초)` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("[chat] GOOGLE_GENERATIVE_AI_API_KEY 미설정");
    return Response.json(
      { error: "AI 서비스가 준비되지 않았어요." },
      { status: 500 },
    );
  }

  try {
    const { message, history, userName } = (await request.json()) as {
      message: string;
      history?: { role: string; text: string }[];
      userName?: string | null;
    };

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "메시지가 비어있습니다." },
        { status: 400 },
      );
    }

    const addressName = addressTerm(userName);

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
        const result = await tryChat(
          genAI,
          modelName,
          message,
          chatHistory,
          addressName,
        );
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
    const offlineReply = getOfflineResponse(message, addressName);
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
        },
        { status: 429 },
      );
    }

    return Response.json(
      { error: "AI 응답 중 문제가 발생했습니다." },
      { status: 500 },
    );
  }
}
