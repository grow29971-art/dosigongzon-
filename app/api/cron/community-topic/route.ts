// 운영 페르소나 커뮤니티 이야깃거리 — Vercel Cron 월·수·금 09:30 KST (00:30 UTC)
// 배경: 커뮤니티 글이 끊기면(최근 7일 0건 관측) 신규 유저가 "죽은 앱"으로 인식.
// 페르소나(lib/community-personas.ts)가 돌아가며 자유게시판에 가벼운 주제를 올려 마중물 역할.
// 2026-09-16: "AI 집사 나비" 단일 명의 → 닉네임 풀에서 매번 랜덤(최근 것 피함), 말투는 닉네임 해시로 고정. 글에는 반드시 "운영" 배지(author_title=staff).
// Gemini 실패/미설정 시 페르소나별 큐레이션 폴백. 최근 40시간 내 봇 글 있으면 스킵(중복 방지).

import { createServiceClient } from "@/lib/supabase/service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LEGACY_BOT_NAMES, STAFF_TITLE_ID, personaFor, pickRandomNickname, type Persona } from "@/lib/community-personas";

/** 봇 글 = 운영 배지 또는 구 명의 (닉네임은 풀에서 매번 랜덤이라 이름으로 판정하지 않는다) */
const BOT_OR = `author_title.eq.${STAFF_TITLE_ID},author_name.in.(${LEGACY_BOT_NAMES.map((n) => `"${n}"`).join(",")})`;

export const maxDuration = 60;

const MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

function seasonLabel(): string {
  const m = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric" }).format(new Date()),
  );
  if (m <= 2 || m === 12) return "한겨울(혹한·쉼터·동파)";
  if (m <= 5) return "봄(아깽이 시즌·환절기)";
  if (m <= 8) return "한여름(폭염·장마·사료 변질)";
  return "가을(환절기·겨울 준비)";
}

async function generateTopic(
  persona: Persona,
  recentTitles: string[],
): Promise<{ title: string; content: string; source: string }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey) {
    const prompt = [
      "당신은 길고양이 돌봄 앱 '도시공존' 커뮤니티의 운영 계정으로 글을 씁니다.",
      `닉네임 "${persona.nickname}", 말투와 관심사: ${persona.voice}`,
      "자유게시판에 올릴 가벼운 이야깃거리 글 1개를 작성하세요.",
      `계절 맥락: ${seasonLabel()}.`,
      recentTitles.length > 0 ? `최근에 올린 제목(중복 금지): ${recentTitles.join(" / ")}` : "",
      "조건: 제목 30자 이내, 본문 150~350자(줄바꿈 1~2회), 질문형으로 끝나 댓글 참여를 유도할 것.",
      "특정 지역·개인·급식소 위치 언급 금지. 의료 조언 금지. 자신을 AI라고 밝히지도, 사람이라고 주장하지도 말 것.",
      '출력은 JSON 하나만: {"title":"...","content":"..."}',
    ]
      .filter(Boolean)
      .join("\n");
    const genAI = new GoogleGenerativeAI(apiKey);
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        const text = res.response.text().replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(text) as { title?: string; content?: string };
        const title = (parsed.title ?? "").trim();
        const content = (parsed.content ?? "").trim();
        if (title.length >= 5 && title.length <= 50 && content.length >= 50 && content.length <= 600) {
          return { title, content, source: modelName };
        }
      } catch {
        // 다음 모델 → 최종 폴백
      }
    }
  }
  const unused = persona.fallbackPosts.filter((t) => !recentTitles.includes(t.title));
  const pool = unused.length > 0 ? unused : persona.fallbackPosts;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { ...pick, source: "fallback" };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const supabase = createServiceClient();

  // 중복 가드 — 최근 40시간 내 봇(페르소나·구 명의) 글이 있으면 스킵
  const since = new Date(Date.now() - 40 * 3600 * 1000).toISOString();
  const { data: recentBot } = await supabase
    .from("posts")
    .select("id")
    .or(BOT_OR)
    .gte("created_at", since)
    .limit(1);
  if (recentBot && recentBot.length > 0) {
    return Response.json({ ok: true, skipped: "최근 봇 글 존재" });
  }

  // 유저 글이 최근 24시간 내 3건 이상이면 스킵 — 살아있는 커뮤니티엔 마중물 불필요
  const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: recentUserPosts } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .or(`author_title.is.null,author_title.neq.${STAFF_TITLE_ID}`)
    .not("author_name", "in", `(${LEGACY_BOT_NAMES.map((n) => `"${n}"`).join(",")})`)
    .gte("created_at", day);
  if ((recentUserPosts ?? 0) >= 3) {
    return Response.json({ ok: true, skipped: "커뮤니티 활성 상태" });
  }

  // 작성자: admins 첫 계정 (FK 충족용 — 표시 이름은 페르소나, 배지는 운영)
  const { data: admins } = await supabase.from("admins").select("user_id").limit(1);
  if (!admins || admins.length === 0) {
    return Response.json({ ok: false, error: "admins 없음" }, { status: 500 });
  }

  // 닉네임: 풀에서 랜덤, 최근 봇 글 8개의 닉네임은 피한다. 말투는 닉네임 해시로 고정(personaFor)
  const { data: lastBotPosts } = await supabase
    .from("posts")
    .select("author_name, title")
    .or(BOT_OR)
    .order("created_at", { ascending: false })
    .limit(8);
  const recentNames = ((lastBotPosts ?? []) as { author_name: string | null }[]).map((p) => p.author_name ?? "");
  const persona = personaFor(pickRandomNickname(recentNames));
  const recentTitles = ((lastBotPosts ?? []) as { title: string }[]).map((p) => p.title);

  const topic = await generateTopic(persona, recentTitles);

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      category: "free",
      title: topic.title,
      content: topic.content,
      author_id: (admins[0] as { user_id: string }).user_id,
      author_name: persona.nickname,
      author_avatar_url: null,
      author_title: STAFF_TITLE_ID,
      region: null,
      images: [],
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({
    ok: true,
    postId: (post as { id: string }).id,
    nickname: persona.nickname,
    voice: persona.id,
    source: topic.source,
    title: topic.title,
  });
}

// Vercel Cron은 GET으로 호출
export const GET = POST;
