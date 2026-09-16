// ══════════════════════════════════════════
// 도시공존 — 커뮤니티 운영 페르소나 봇 공용 로직 (서버 전용, 2026-09-16)
// 소비자: (1) Vercel 크론 community-topic / community-comment
//         (2) 데스크톱 exe「도시공존 커뮤니티봇」→ /api/bot/community/*
// 규칙(docs/business-rules.md 커뮤니티 절):
//  - 페르소나 글·댓글은 반드시 author_title = STAFF_TITLE_ID("운영" 배지).
//  - 글은 자유게시판(free)만. 댓글 대상도 free 유저 글만 — 긴급·돌봄 부탁·임보·입양·중고마켓 제외.
//  - 하루 상한: 글 POSTS_PER_DAY_CAP, 댓글 COMMENTS_PER_DAY_CAP (exe 가 아무리 눌러도 서버가 막는다).
//  - 글쓴이 푸시는 {title, body, url} 계약(docs/contracts.md 4절).
// ══════════════════════════════════════════

import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { ALL_BOT_NAMES, PERSONAS, STAFF_TITLE_ID, type Persona } from "@/lib/community-personas";

export const POSTS_PER_DAY_CAP = 3;
export const COMMENTS_PER_DAY_CAP = 10;

export const POST_TITLE_MIN = 5;
export const POST_TITLE_MAX = 50;
export const POST_CONTENT_MIN = 50;
export const POST_CONTENT_MAX = 1000;
export const COMMENT_MIN = 10;
export const COMMENT_MAX = 300;

/** 봇 exe 인증 — COMMUNITY_BOT_SECRET 이 있으면 그것, 없으면 CRON_SECRET 을 겸용(도입 초기). */
export function checkBotSecret(request: Request): boolean {
  const secret = process.env.COMMUNITY_BOT_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export function serverReady(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function findPersona(id: string | undefined | null): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}

async function adminAuthorId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("admins").select("user_id").limit(1);
  const row = (data ?? [])[0] as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

// ── 통계·상한 ────────────────────────────────────────────────

export interface BotStats {
  postsToday: number;
  commentsToday: number;
  postsCap: number;
  commentsCap: number;
  recentBotTitles: string[];
  lastBotPostAt: string | null;
  lastStaffCommentAt: string | null;
}

export async function botStats(supabase: SupabaseClient): Promise<BotStats> {
  const day = isoAgo(24 * 3600 * 1000);
  const [{ count: postsToday }, { count: commentsToday }, { data: recent }, { data: lastComment }] = await Promise.all([
    supabase.from("posts").select("*", { count: "exact", head: true }).in("author_name", ALL_BOT_NAMES).gte("created_at", day),
    supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("author_title", STAFF_TITLE_ID).gte("created_at", day),
    supabase.from("posts").select("title, created_at").in("author_name", ALL_BOT_NAMES).order("created_at", { ascending: false }).limit(10),
    supabase.from("post_comments").select("created_at").eq("author_title", STAFF_TITLE_ID).order("created_at", { ascending: false }).limit(1),
  ]);
  const recentRows = (recent ?? []) as { title: string; created_at: string }[];
  return {
    postsToday: postsToday ?? 0,
    commentsToday: commentsToday ?? 0,
    postsCap: POSTS_PER_DAY_CAP,
    commentsCap: COMMENTS_PER_DAY_CAP,
    recentBotTitles: recentRows.map((r) => r.title),
    lastBotPostAt: recentRows[0]?.created_at ?? null,
    lastStaffCommentAt: ((lastComment ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null,
  };
}

// ── 글 ───────────────────────────────────────────────────────

export interface PersonaPostInput {
  persona: Persona;
  title: string;
  content: string;
}

export type BotResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

export function validatePostText(title: string, content: string): string | null {
  if (title.length < POST_TITLE_MIN || title.length > POST_TITLE_MAX) return `제목은 ${POST_TITLE_MIN}~${POST_TITLE_MAX}자여야 해요`;
  if (content.length < POST_CONTENT_MIN || content.length > POST_CONTENT_MAX) return `본문은 ${POST_CONTENT_MIN}~${POST_CONTENT_MAX}자여야 해요`;
  if (/https?:\/\//i.test(content) || /https?:\/\//i.test(title)) return "글에 링크를 넣을 수 없어요";
  return null;
}

export async function insertPersonaPost(input: PersonaPostInput): Promise<BotResult<{ postId: string }>> {
  if (!input.persona.writesPosts) return { ok: false, error: "이 페르소나는 글을 쓰지 않아요", status: 400 };
  const title = input.title.trim();
  const content = input.content.trim();
  const invalid = validatePostText(title, content);
  if (invalid) return { ok: false, error: invalid, status: 400 };

  const supabase = createServiceClient();
  const stats = await botStats(supabase);
  if (stats.postsToday >= POSTS_PER_DAY_CAP) {
    return { ok: false, error: `오늘 운영 글 상한(${POSTS_PER_DAY_CAP}개)에 닿았어요`, status: 429 };
  }
  if (stats.recentBotTitles.includes(title)) {
    return { ok: false, error: "최근에 같은 제목의 글을 올렸어요", status: 409 };
  }
  const authorId = await adminAuthorId(supabase);
  if (!authorId) return { ok: false, error: "admins 없음", status: 500 };

  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: "free",
      title,
      content,
      author_id: authorId,
      author_name: input.persona.nickname,
      author_avatar_url: null,
      author_title: STAFF_TITLE_ID,
      region: null,
      images: [],
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message, status: 500 };
  return { ok: true, value: { postId: (data as { id: string }).id } };
}

// ── 댓글 후보 ────────────────────────────────────────────────

export interface CommentCandidate {
  id: string;
  title: string;
  content: string;
  authorName: string;
  commentCount: number;
  createdAt: string;
}

interface PostRow {
  id: string;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  comment_count: number;
  created_at: string;
}

/**
 * 댓글 달 후보: 자유게시판, 숨김·고정 아님, 봇 글 아님, minAge~7일 사이, 아직 운영 댓글이 없는 글.
 * 댓글 적은 순 → 최신 순.
 */
export async function listCommentCandidates(
  supabase: SupabaseClient,
  opts: { minAgeMs: number; limit: number },
): Promise<BotResult<CommentCandidate[]>> {
  const from = isoAgo(7 * 86400 * 1000);
  const to = isoAgo(opts.minAgeMs);
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, content, author_id, author_name, comment_count, created_at")
    .eq("category", "free")
    .eq("hidden", false)
    .eq("is_pinned", false)
    .not("author_id", "is", null)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("comment_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { ok: false, error: error.message, status: 500 };
  const userPosts = ((data ?? []) as PostRow[]).filter((p) => !ALL_BOT_NAMES.includes(p.author_name ?? ""));
  if (userPosts.length === 0) return { ok: true, value: [] };

  const { data: done } = await supabase
    .from("post_comments")
    .select("post_id")
    .eq("author_title", STAFF_TITLE_ID)
    .in("post_id", userPosts.map((p) => p.id));
  const doneSet = new Set(((done ?? []) as { post_id: string }[]).map((c) => c.post_id));
  return {
    ok: true,
    value: userPosts
      .filter((p) => !doneSet.has(p.id))
      .slice(0, opts.limit)
      .map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content.slice(0, 800),
        authorName: p.author_name ?? "익명",
        commentCount: p.comment_count,
        createdAt: p.created_at,
      })),
  };
}

// ── 댓글 ─────────────────────────────────────────────────────

export interface PersonaCommentInput {
  persona: Persona;
  postId: string;
  body: string;
}

export function validateCommentText(body: string): string | null {
  if (body.length < COMMENT_MIN || body.length > COMMENT_MAX) return `댓글은 ${COMMENT_MIN}~${COMMENT_MAX}자여야 해요`;
  if (/https?:\/\//i.test(body)) return "댓글에 링크를 넣을 수 없어요";
  return null;
}

interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function insertPersonaComment(
  input: PersonaCommentInput,
): Promise<BotResult<{ commentId: string; pushed: number; pushFailed: number }>> {
  const body = input.body.replace(/\s+/g, " ").trim();
  const invalid = validateCommentText(body);
  if (invalid) return { ok: false, error: invalid, status: 400 };

  const supabase = createServiceClient();
  const stats = await botStats(supabase);
  if (stats.commentsToday >= COMMENTS_PER_DAY_CAP) {
    return { ok: false, error: `오늘 운영 댓글 상한(${COMMENTS_PER_DAY_CAP}개)에 닿았어요`, status: 429 };
  }

  // 대상 검증 — 자유게시판·숨김 아님·유저 글·아직 운영 댓글 없음
  const { data: post } = await supabase
    .from("posts")
    .select("id, category, hidden, author_id, author_name")
    .eq("id", input.postId)
    .maybeSingle();
  const target = post as { id: string; category: string; hidden: boolean; author_id: string | null; author_name: string | null } | null;
  if (!target) return { ok: false, error: "글을 찾을 수 없어요", status: 404 };
  if (target.category !== "free") return { ok: false, error: "자유게시판 글에만 댓글을 달아요", status: 400 };
  if (target.hidden) return { ok: false, error: "숨겨진 글이에요", status: 400 };
  if (!target.author_id || ALL_BOT_NAMES.includes(target.author_name ?? "")) {
    return { ok: false, error: "운영 글에는 운영 댓글을 달지 않아요", status: 400 };
  }
  const { data: existing } = await supabase
    .from("post_comments")
    .select("id")
    .eq("post_id", target.id)
    .eq("author_title", STAFF_TITLE_ID)
    .limit(1);
  if (existing && existing.length > 0) return { ok: false, error: "이미 운영 댓글이 달린 글이에요", status: 409 };

  const authorId = await adminAuthorId(supabase);
  if (!authorId) return { ok: false, error: "admins 없음", status: 500 };

  const { data: inserted, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: target.id,
      parent_id: null,
      author_id: authorId,
      author_name: input.persona.nickname,
      author_avatar_url: null,
      author_title: STAFF_TITLE_ID,
      author_level: null,
      body,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message, status: 500 };

  const push = await pushToAuthor(supabase, {
    authorId: target.author_id,
    skipId: authorId,
    title: `${input.persona.nickname}님이 댓글을 남겼어요`,
    body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
    url: `/community/${target.id}`,
  });
  return { ok: true, value: { commentId: (inserted as { id: string }).id, ...push } };
}

/** 글쓴이 1명에게 푸시. 구독 없으면 조용히 통과, 410/404 구독은 삭제. */
async function pushToAuthor(
  supabase: SupabaseClient,
  args: { authorId: string; skipId: string; title: string; body: string; url: string },
): Promise<{ pushed: number; pushFailed: number }> {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (args.authorId === args.skipId || !vapidPublic || !vapidPrivate) return { pushed: 0, pushFailed: 0 };
  webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`, vapidPublic, vapidPrivate);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", args.authorId);
  const payload = JSON.stringify({ title: args.title, body: args.body, url: args.url });
  let pushed = 0;
  let pushFailed = 0;
  for (const sub of (subs ?? []) as PushSub[]) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      pushed++;
    } catch (err: unknown) {
      pushFailed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return { pushed, pushFailed };
}
