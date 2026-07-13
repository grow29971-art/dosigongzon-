// AI 집사 커뮤니티 이야깃거리 — Vercel Cron 화·금 09:30 KST (00:30 UTC)
// 배경: 커뮤니티 글이 끊기면(최근 7일 0건 관측) 신규 유저가 "죽은 앱"으로 인식.
// AI 집사가 주 2회 가벼운 대화 주제를 자유게시판에 올려 마중물 역할.
// Gemini 실패/미설정 시 큐레이션 폴백. 최근 72시간 내 봇 글 있으면 스킵(중복 방지).

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;

const BOT_NAME = "AI 집사 나비";
const MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

const FALLBACK_TOPICS: { title: string; content: string }[] = [
  {
    title: "우리 동네 고양이 이름, 어떻게 지으셨나요? 🐾",
    content:
      "치즈라서 치즈, 까매서 까망이… 다들 이름에 사연 하나쯤 있으시죠?\n여러분이 지어준 이름과 그 뒷이야기가 궁금해요. 댓글로 들려주세요! 😺",
  },
  {
    title: "한여름 급식 꿀팁 공유해요 ☀️",
    content:
      "사료가 금방 상하는 계절이에요. 저는 소량씩 자주 놓는 편인데,\n다들 여름 급식 어떻게 하고 계세요? 물그릇 위치 팁도 환영이에요!",
  },
  {
    title: "고양이가 처음으로 곁을 내준 순간 💛",
    content:
      "몇 달을 도망만 다니던 아이가 어느 날 스르륵 다가왔을 때의 그 기분…\n여러분의 '첫 곁내줌' 순간을 들려주세요. 읽기만 해도 힐링될 것 같아요.",
  },
  {
    title: "출근길에 만나는 단골 고양이 있으신가요? 🚶",
    content:
      "매일 같은 자리에서 인사하는 아이가 있다면 자랑해 주세요.\n어디쯤에서(대략적으로만!) 만나는지, 어떤 성격인지 궁금해요.",
  },
  {
    title: "장마철 쉼터 관리, 다들 어떻게 하세요? 🌧️",
    content:
      "비가 이어지면 쉼터 바닥이 눅눅해지기 쉬워요.\n저는 벽돌로 바닥을 띄우는데, 여러분만의 장마 대비법이 있다면 공유해 주세요!",
  },
  {
    title: "고양이 사진 찍는 나만의 비법 📸",
    content:
      "움직임이 빨라서 늘 흔들린 사진만 남죠…\n선명한 냥사진을 건지는 여러분만의 비법이 있나요? 최근 최애 컷도 같이 올려주세요!",
  },
  {
    title: "TNR 다녀온 아이, 회복 후 달라진 점 있나요? ✂️",
    content:
      "중성화 후에 성격이 순해졌다는 아이도 있고, 밥 먹는 양이 늘었다는 아이도 있대요.\n우리 동네 아이들은 어땠는지 경험을 나눠주세요.",
  },
  {
    title: "겨울이 오기 전에 미리 준비하는 것들 🧤",
    content:
      "아직 여름이지만, 준비성 좋은 집사님들은 벌써 겨울 쉼터 재료를 모으신다죠.\n스티로폼 박스 구하는 팁, 단열 재료 추천 받아요!",
  },
];

function seasonLabel(): string {
  const m = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", month: "numeric" }).format(new Date()),
  );
  if (m <= 2 || m === 12) return "한겨울(혹한·쉼터·동파)";
  if (m <= 5) return "봄(아깽이 시즌·환절기)";
  if (m <= 8) return "한여름(폭염·장마·사료 변질)";
  return "가을(환절기·겨울 준비)";
}

async function generateTopic(): Promise<{ title: string; content: string; source: string }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey) {
    const prompt = [
      "당신은 길고양이 돌봄 앱 '도시공존' 커뮤니티의 다정한 AI 집사입니다.",
      "자유게시판에 올릴 가벼운 이야깃거리 글 1개를 작성하세요.",
      `계절 맥락: ${seasonLabel()}.`,
      "조건: 제목 30자 이내(이모지 1개), 본문 150~350자(줄바꿈 1~2회, 이모지 1~2개),",
      "질문형으로 끝나 댓글 참여를 유도할 것. 특정 지역·개인 언급 금지.",
      '출력은 JSON 하나만: {"title":"...","content":"..."}',
    ].join("\n");
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
  const pick = FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
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
  const supabase = createClient(supabaseUrl, serviceKey);

  // 중복 가드 — 최근 72시간 내 봇 글이 있으면 스킵
  const since = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const { data: recentBot } = await supabase
    .from("posts")
    .select("id")
    .eq("author_name", BOT_NAME)
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
    .neq("author_name", BOT_NAME)
    .gte("created_at", day);
  if ((recentUserPosts ?? 0) >= 3) {
    return Response.json({ ok: true, skipped: "커뮤니티 활성 상태" });
  }

  // 작성자: admins 첫 계정 (FK 충족용 — 표시 이름은 봇 페르소나)
  const { data: admins } = await supabase.from("admins").select("user_id").limit(1);
  if (!admins || admins.length === 0) {
    return Response.json({ ok: false, error: "admins 없음" }, { status: 500 });
  }

  const topic = await generateTopic();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      category: "free",
      title: topic.title,
      content: topic.content,
      author_id: (admins[0] as { user_id: string }).user_id,
      author_name: BOT_NAME,
      author_avatar_url: null,
      author_title: "AI 집사",
      region: null,
      images: [],
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, postId: (post as { id: string }).id, source: topic.source, title: topic.title });
}

// Vercel Cron은 GET으로 호출
export const GET = POST;
