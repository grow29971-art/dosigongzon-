// 운영 페르소나 첫 댓글 — Vercel Cron 매일 20:30 KST (11:30 UTC)
// 배경: 글을 올렸는데 반응이 0이면 다시 안 온다(Day0 활성화). 반응 없는 실사용자 글에
// 운영 페르소나가 첫 댓글 1개를 남기고 글쓴이에게 푸시로 알린다.
// 규칙(2026-09-16, 9/18 개정):
//  - 하루 최대 1건. 상한은 "해당 글에 이미 운영 댓글이 있는가"로만 판단한다.
//    (구 규칙 "최근 20시간 내 운영 댓글 있으면 스킵"은 exe 봇이 봇 글에 다는 댓글까지 세어
//     9/16~17 매일 스킵됐다 — 유저 글 응답 경로가 굶던 원인. 2026-09-18 원탁회의)
//  - 대상: 자유게시판(free)만. 긴급·돌봄 부탁·임보·입양·중고마켓은 제외(실제 이해관계가 걸린 글).
//  - 봇 글·숨김 글·이미 댓글(사람이든 운영이든)이 달린 글 제외. 올라온 지 24시간~7일 사이 글만
//    — 첫 24시간은 사장님이 직접 답할 시간(새 글은 텔레그램으로 알림). 봇은 그 뒤에도 댓글 0일 때만.
//  - 댓글은 반드시 author_title=staff("운영" 배지). 사람인 척하지 않는다.
//  - 푸시는 글쓴이 1명에게만, 페이로드는 {title, body, url} 계약 준수.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { STAFF_TITLE_ID, isBotAuthor, personaFor, pickRandomNickname, type Persona } from "@/lib/community-personas";

export const maxDuration = 60;

const MODEL_CANDIDATES = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];

interface PostRow {
  id: string;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  author_title: string | null;
  comment_count: number;
  created_at: string;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function generateComment(persona: Persona, post: PostRow): Promise<{ body: string; source: string }> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey) {
    const prompt = [
      "당신은 길고양이 돌봄 앱 '도시공존' 커뮤니티의 운영 계정으로 댓글을 씁니다.",
      `닉네임 "${persona.nickname}", 말투: ${persona.voice}`,
      "아래 글에 남길 첫 댓글 1개를 작성하세요. 글쓴이가 다시 오고 싶어지도록 공감하고, 가볍게 되묻는 정도로.",
      "조건: 40~120자, 줄바꿈 없음, 질문은 최대 1개. 의료·법률 조언 금지, 지역·개인정보·급식소 위치 언급 금지,",
      "글 내용에 없는 사실을 지어내지 말 것. 자신을 AI라고 밝히지도, 사람이라고 주장하지도 말 것.",
      `글 제목: ${post.title}`,
      `글 본문: ${post.content.slice(0, 600)}`,
      '출력은 JSON 하나만: {"body":"..."}',
    ].join("\n");
    const genAI = new GoogleGenerativeAI(apiKey);
    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        const text = res.response.text().replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(text) as { body?: string };
        const body = (parsed.body ?? "").replace(/\s+/g, " ").trim();
        if (body.length >= 20 && body.length <= 160) return { body, source: modelName };
      } catch {
        // 다음 모델 → 폴백
      }
    }
  }
  const pool = persona.fallbackComments;
  return { body: pool[Math.floor(Math.random() * pool.length)], source: "fallback" };
}

async function handle(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const supabase = createServiceClient();

  // 후보: 자유게시판, 숨김 아님, 봇 글 아님, 댓글 0, 24시간~7일 사이
  const from = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const to = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: rows, error: qErr } = await supabase
    .from("posts")
    .select("id, title, content, author_id, author_name, author_title, comment_count, created_at")
    .eq("category", "free")
    .eq("hidden", false)
    .eq("is_pinned", false)
    .not("author_id", "is", null)
    .eq("comment_count", 0)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false })
    .limit(30);
  if (qErr) {
    return Response.json({ ok: false, error: qErr.message }, { status: 500 });
  }
  const userPosts = ((rows ?? []) as PostRow[]).filter((p) => !isBotAuthor(p));
  if (userPosts.length === 0) {
    return Response.json({ ok: true, skipped: "대상 글 없음" });
  }

  // 이미 페르소나 댓글이 달린 글 제외
  const { data: staffCommented } = await supabase
    .from("post_comments")
    .select("post_id")
    .eq("author_title", STAFF_TITLE_ID)
    .in("post_id", userPosts.map((p) => p.id));
  const done = new Set(((staffCommented ?? []) as { post_id: string }[]).map((c) => c.post_id));
  const target = userPosts.find((p) => !done.has(p.id));
  if (!target) {
    return Response.json({ ok: true, skipped: "전부 댓글 완료" });
  }

  const { data: admins } = await supabase.from("admins").select("user_id").limit(1);
  if (!admins || admins.length === 0) {
    return Response.json({ ok: false, error: "admins 없음" }, { status: 500 });
  }
  const adminId = (admins[0] as { user_id: string }).user_id;

  // 닉네임은 풀에서 랜덤(최근 운영 댓글 닉네임은 피함), 말투는 닉네임 해시로 고정
  const { data: recentStaffNames } = await supabase
    .from("post_comments")
    .select("author_name")
    .eq("author_title", STAFF_TITLE_ID)
    .order("created_at", { ascending: false })
    .limit(8);
  const persona = personaFor(pickRandomNickname(((recentStaffNames ?? []) as { author_name: string | null }[]).map((c) => c.author_name ?? "")));
  const comment = await generateComment(persona, target);

  const { data: inserted, error: insErr } = await supabase
    .from("post_comments")
    .insert({
      post_id: target.id,
      parent_id: null,
      author_id: adminId,
      author_name: persona.nickname,
      author_avatar_url: null,
      author_title: STAFF_TITLE_ID,
      author_level: null,
      body: comment.body,
    })
    .select("id")
    .single();
  if (insErr) {
    return Response.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  // 글쓴이에게 푸시 (구독 없으면 조용히 통과, 실패는 결과에만 기록)
  let pushed = 0;
  let pushFailed = 0;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (target.author_id && target.author_id !== adminId && vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
      vapidPublic,
      vapidPrivate,
    );
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", target.author_id);
    const preview = comment.body.length > 80 ? `${comment.body.slice(0, 80)}…` : comment.body;
    const payload = JSON.stringify({
      title: `${persona.nickname}님이 댓글을 남겼어요`,
      body: preview,
      url: `/community/${target.id}`,
    });
    for (const sub of ((subs ?? []) as PushSub[])) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        pushed++;
      } catch (err: unknown) {
        pushFailed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return Response.json({
    ok: true,
    postId: target.id,
    commentId: (inserted as { id: string }).id,
    nickname: persona.nickname,
    voice: persona.id,
    source: comment.source,
    pushed,
    pushFailed,
  });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
