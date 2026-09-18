// ══════════════════════════════════════════
// 도시공존 — 커뮤니티 운영 페르소나 봇 공용 로직 (서버 전용, 2026-09-16)
// 소비자: (1) Vercel 크론 community-topic / community-comment
//         (2) 데스크톱 exe「도시공존 커뮤니티봇」→ /api/bot/community/*
// 규칙(docs/business-rules.md 커뮤니티 절):
//  - 페르소나 글·댓글은 반드시 author_title = STAFF_TITLE_ID("운영" 배지).
//  - 닉네임은 풀에서 매번 랜덤. 봇 글에 달린 이용자 댓글에 봇이 답할 때는 그 글의 작성자 닉네임 그대로(일관성).
//  - 글은 자유게시판(free)만. 댓글 대상도 free 유저 글만 — 긴급·돌봄 부탁·임보·입양·중고마켓 제외.
//  - 하루 상한: 글 POSTS_PER_DAY_CAP, 댓글 COMMENTS_PER_DAY_CAP, 답글 REPLIES_PER_DAY_CAP (exe 가 아무리 눌러도 서버가 막는다).
//  - 글쓴이·댓글쓴이 푸시는 {title, body, url} 계약(docs/contracts.md 4절).
// ══════════════════════════════════════════

import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { LEGACY_BOT_NAMES, LEGACY_PERSONA_IDS, STAFF_TITLE_ID, isBotAuthor, isValidBotNickname, personaFor, type Persona } from "@/lib/community-personas";

// 2026-09-18 원탁회의: 9/16~18 봇 글 22건 → 조회 합계 19(중앙값 0)·유저 댓글 0, 봇 댓글 22건은 전부 봇 글에.
// 유저 글 월 1건 게시판에서 봇 글 15/일은 유일한 유저 글을 밀어내고 "운영이 혼자 떠드는 곳"으로 읽힌다.
// 봇의 역할을 "글 생산"에서 "유저 글 첫 반응"으로 되돌림 — 글·댓글 상한 감량, 봇↔봇 댓글 중단.
// (exe 가 아무리 눌러도 여기서 막는다. exe 쪽 간격 env는 사장님 손)
export const POSTS_PER_DAY_CAP = 2;
export const COMMENTS_PER_DAY_CAP = 10;
export const REPLIES_PER_DAY_CAP = 30;
/** 봇 글 하나에 다른 닉네임의 봇 댓글(최상위) — 0 = 봇끼리 대화 금지(9/18). 유저가 봇 글에 단 댓글의 답글(reply)은 별도 */
export const OWN_POST_COMMENTS_CAP = 0;
/** 이용자 글 하나에 봇 댓글(최상위, 서로 다른 닉네임)은 이만큼까지 */
export const USER_POST_COMMENTS_CAP = 2;
/** 댓글 대상 카테고리 — 긴급(도움을 기다리는 글에 봇 공감은 오해를 부름)·중고마켓(거래)은 제외 */
export const COMMENT_CATEGORIES = ["free", "sitter", "foster", "adoption"] as const;

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

/** 요청 본문의 nickname(신) 또는 personaId(구) → 페르소나. 둘 다 없거나 이상하면 undefined */
export function resolvePersona(body: { nickname?: unknown; personaId?: unknown }): Persona | undefined {
  const nick = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (nick && isValidBotNickname(nick)) return personaFor(nick);
  const legacy = typeof body.personaId === "string" ? LEGACY_PERSONA_IDS[body.personaId] : undefined;
  return legacy ? personaFor(legacy) : undefined;
}

async function adminAuthorId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("admins").select("user_id").limit(1);
  const row = (data ?? [])[0] as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

/** PostgREST or 필터: 운영 배지이거나 구 봇 명의 */
const BOT_OR = `author_title.eq.${STAFF_TITLE_ID},author_name.in.(${LEGACY_BOT_NAMES.map((n) => `"${n}"`).join(",")})`;

// ── 통계·상한 ────────────────────────────────────────────────

export interface BotStats {
  postsToday: number;
  commentsToday: number;
  repliesToday: number;
  postsCap: number;
  commentsCap: number;
  repliesCap: number;
  recentBotTitles: string[];
  /** 최근 봇 글 닉네임 (exe 가 겹치지 않게 고르는 데 씀) */
  recentNicknames: string[];
  lastBotPostAt: string | null;
  lastStaffCommentAt: string | null;
}

export async function botStats(supabase: SupabaseClient): Promise<BotStats> {
  const day = isoAgo(24 * 3600 * 1000);
  const [{ count: postsToday }, { data: staffToday }, { data: recent }, { data: lastComment }] = await Promise.all([
    supabase.from("posts").select("*", { count: "exact", head: true }).or(BOT_OR).gte("created_at", day),
    supabase.from("post_comments").select("parent_id").eq("author_title", STAFF_TITLE_ID).gte("created_at", day),
    supabase.from("posts").select("title, author_name, created_at").or(BOT_OR).order("created_at", { ascending: false }).limit(12),
    supabase.from("post_comments").select("created_at").eq("author_title", STAFF_TITLE_ID).order("created_at", { ascending: false }).limit(1),
  ]);
  const recentRows = (recent ?? []) as { title: string; author_name: string | null; created_at: string }[];
  const staffRows = (staffToday ?? []) as { parent_id: string | null }[];
  return {
    postsToday: postsToday ?? 0,
    commentsToday: staffRows.filter((c) => !c.parent_id).length,
    repliesToday: staffRows.filter((c) => !!c.parent_id).length,
    postsCap: POSTS_PER_DAY_CAP,
    commentsCap: COMMENTS_PER_DAY_CAP,
    repliesCap: REPLIES_PER_DAY_CAP,
    recentBotTitles: recentRows.map((r) => r.title),
    recentNicknames: [...new Set(recentRows.map((r) => r.author_name ?? "").filter(Boolean))],
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

// ── 댓글 후보 (이용자 글) ────────────────────────────────────

export interface CommentCandidate {
  id: string;
  category: string;
  title: string;
  content: string;
  authorName: string;
  commentCount: number;
  createdAt: string;
  /** 이 글에 이미 달린 봇 최상위 댓글 수 (own 모드에서 상한 판단용) */
  staffComments?: number;
}

interface PostRow {
  id: string;
  category: string;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  author_title: string | null;
  comment_count: number;
  created_at: string;
}

/**
 * 댓글 달 후보: 자유게시판, 숨김·고정 아님, 봇 글 아님, minAge~7일 사이, 아직 운영 댓글이 없는 글.
 * 댓글 적은 순 → 최신 순.
 */
export async function listCommentCandidates(
  supabase: SupabaseClient,
  opts: { minAgeMs: number; limit: number; own?: boolean },
): Promise<BotResult<CommentCandidate[]>> {
  const from = isoAgo(7 * 86400 * 1000);
  const to = isoAgo(opts.minAgeMs);
  const { data, error } = await supabase
    .from("posts")
    .select("id, category, title, content, author_id, author_name, author_title, comment_count, created_at")
    .in("category", [...COMMENT_CATEGORIES])
    .eq("hidden", false)
    .eq("is_pinned", false)
    .not("author_id", "is", null)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("comment_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { ok: false, error: error.message, status: 500 };
  const rows = (data ?? []) as PostRow[];
  // own=true: 봇 글 중 다른 닉네임 봇 댓글(최상위)이 OWN_POST_COMMENTS_CAP 미만인 것. 아니면 이용자 글 중 운영 댓글 없는 것
  const targets = rows.filter((p) => (opts.own ? isBotAuthor(p) : !isBotAuthor(p)));
  if (targets.length === 0) return { ok: true, value: [] };

  const { data: staff } = await supabase
    .from("post_comments")
    .select("post_id, parent_id")
    .eq("author_title", STAFF_TITLE_ID)
    .in("post_id", targets.map((p) => p.id));
  const topCount = new Map<string, number>();
  for (const c of (staff ?? []) as { post_id: string; parent_id: string | null }[]) {
    if (!c.parent_id) topCount.set(c.post_id, (topCount.get(c.post_id) ?? 0) + 1);
  }
  const allowed = opts.own ? OWN_POST_COMMENTS_CAP : USER_POST_COMMENTS_CAP;
  return {
    ok: true,
    value: targets
      .filter((p) => (topCount.get(p.id) ?? 0) < allowed)
      .slice(0, opts.limit)
      .map((p) => ({
        id: p.id,
        category: p.category,
        title: p.title,
        content: p.content.slice(0, 800),
        authorName: p.author_name ?? "익명",
        commentCount: p.comment_count,
        createdAt: p.created_at,
        staffComments: topCount.get(p.id) ?? 0,
      })),
  };
}

// ── 댓글 (이용자 글에 첫 댓글) ────────────────────────────────

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

  const { data: post } = await supabase
    .from("posts")
    .select("id, category, hidden, author_id, author_name, author_title")
    .eq("id", input.postId)
    .maybeSingle();
  const target = post as { id: string; category: string; hidden: boolean; author_id: string | null; author_name: string | null; author_title: string | null } | null;
  if (!target) return { ok: false, error: "글을 찾을 수 없어요", status: 404 };
  if (!(COMMENT_CATEGORIES as readonly string[]).includes(target.category)) return { ok: false, error: "긴급·중고마켓 글에는 댓글을 달지 않아요", status: 400 };
  if (target.hidden) return { ok: false, error: "숨겨진 글이에요", status: 400 };
  if (!target.author_id) return { ok: false, error: "작성자가 없는 글이에요", status: 400 };
  const ownPost = isBotAuthor(target);
  if (ownPost && target.author_name === input.persona.nickname) {
    return { ok: false, error: "내 글에는 글쓴이와 다른 닉네임으로만 댓글을 달아요", status: 400 };
  }
  const { data: existing } = await supabase
    .from("post_comments")
    .select("id, parent_id, author_name")
    .eq("post_id", target.id)
    .eq("author_title", STAFF_TITLE_ID);
  const staffTop = ((existing ?? []) as { id: string; parent_id: string | null; author_name: string | null }[]).filter((c) => !c.parent_id);
  const cap = ownPost ? OWN_POST_COMMENTS_CAP : USER_POST_COMMENTS_CAP;
  if (staffTop.length >= cap) return { ok: false, error: `이 글에는 봇 댓글을 ${cap}개까지만 달아요`, status: 409 };
  if (staffTop.some((c) => c.author_name === input.persona.nickname)) return { ok: false, error: "같은 닉네임이 이미 이 글에 댓글을 달았어요", status: 409 };

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

  const push = await pushToUser(supabase, {
    userId: target.author_id,
    skipId: authorId,
    title: `${input.persona.nickname}님이 댓글을 남겼어요`,
    body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
    url: `/community/${target.id}`,
  });
  return { ok: true, value: { commentId: (inserted as { id: string }).id, ...push } };
}

// ── 답글 후보 (봇 글에 달린 이용자 댓글) ──────────────────────

export interface ReplyCandidate {
  commentId: string;
  postId: string;
  postTitle: string;
  /** 글 작성자 닉네임 — 답글은 반드시 이 이름으로 */
  postNickname: string;
  postExcerpt: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_title: string | null;
  body: string;
  is_secret?: boolean | null;
  created_at: string;
}

/**
 * 답글 후보: 최근 14일 봇 글에 달린 이용자 댓글(최상위, 비밀 아님) 중 아직 운영 답글이 없는 것.
 * 이용자가 봇 답글에 다시 단 대댓글(parent 가 봇 댓글)도 후보 — 그 경우 parentId 는 그 대댓글.
 */
export async function listReplyCandidates(supabase: SupabaseClient, opts: { limit: number }): Promise<BotResult<ReplyCandidate[]>> {
  const from = isoAgo(14 * 86400 * 1000);
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, title, content, author_name, author_title, hidden, created_at")
    .or(BOT_OR)
    .eq("hidden", false)
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message, status: 500 };
  const botPosts = (posts ?? []) as { id: string; title: string; content: string; author_name: string | null }[];
  if (botPosts.length === 0) return { ok: true, value: [] };
  const byPost = new Map(botPosts.map((p) => [p.id, p]));

  const { data: cmts } = await supabase
    .from("post_comments")
    .select("id, post_id, parent_id, author_id, author_name, author_title, body, is_secret, created_at")
    .in("post_id", botPosts.map((p) => p.id))
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = (cmts ?? []) as CommentRow[];
  const staffReplies = new Set(rows.filter((c) => c.author_title === STAFF_TITLE_ID && c.parent_id).map((c) => c.parent_id!));
  const out: ReplyCandidate[] = [];
  for (const c of rows) {
    if (c.author_title === STAFF_TITLE_ID || c.is_secret || !c.author_id) continue;
    if (staffReplies.has(c.id)) continue;
    const post = byPost.get(c.post_id);
    if (!post?.author_name) continue;
    out.push({
      commentId: c.id,
      postId: c.post_id,
      postTitle: post.title,
      postNickname: post.author_name,
      postExcerpt: post.content.slice(0, 300),
      authorName: c.author_name ?? "익명",
      body: c.body.slice(0, 500),
      createdAt: c.created_at,
    });
  }
  return { ok: true, value: out.slice(-opts.limit).reverse() };
}

// ── 답글 (봇 글의 작성자 닉네임으로) ──────────────────────────

export interface PersonaReplyInput {
  postId: string;
  parentId: string;
  body: string;
}

export async function insertPersonaReply(
  input: PersonaReplyInput,
): Promise<BotResult<{ commentId: string; nickname: string; pushed: number; pushFailed: number }>> {
  const body = input.body.replace(/\s+/g, " ").trim();
  const invalid = validateCommentText(body);
  if (invalid) return { ok: false, error: invalid, status: 400 };

  const supabase = createServiceClient();
  const stats = await botStats(supabase);
  if (stats.repliesToday >= REPLIES_PER_DAY_CAP) {
    return { ok: false, error: `오늘 운영 답글 상한(${REPLIES_PER_DAY_CAP}개)에 닿았어요`, status: 429 };
  }

  const { data: post } = await supabase.from("posts").select("id, hidden, author_name, author_title").eq("id", input.postId).maybeSingle();
  const target = post as { id: string; hidden: boolean; author_name: string | null; author_title: string | null } | null;
  if (!target) return { ok: false, error: "글을 찾을 수 없어요", status: 404 };
  if (target.hidden) return { ok: false, error: "숨겨진 글이에요", status: 400 };
  if (!isBotAuthor(target) || !target.author_name) return { ok: false, error: "운영 글에만 답글을 달아요 (이용자 글은 comment 로)", status: 400 };

  const { data: parent } = await supabase
    .from("post_comments")
    .select("id, post_id, parent_id, author_id, author_name, author_title, body, is_secret, created_at")
    .eq("id", input.parentId)
    .maybeSingle();
  const p = parent as CommentRow | null;
  if (!p || p.post_id !== target.id) return { ok: false, error: "그 글의 댓글이 아니에요", status: 404 };
  if (p.author_title === STAFF_TITLE_ID || !p.author_id) return { ok: false, error: "이용자 댓글에만 답해요", status: 400 };
  const { data: existing } = await supabase.from("post_comments").select("id").eq("parent_id", p.id).eq("author_title", STAFF_TITLE_ID).limit(1);
  if (existing && existing.length > 0) return { ok: false, error: "이미 답글을 단 댓글이에요", status: 409 };

  const authorId = await adminAuthorId(supabase);
  if (!authorId) return { ok: false, error: "admins 없음", status: 500 };

  // 닉네임은 요청값과 상관없이 글 작성자 닉네임으로 고정 (일관성 규칙)
  const nickname = target.author_name;
  const { data: inserted, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: target.id,
      parent_id: p.id,
      author_id: authorId,
      author_name: nickname,
      author_avatar_url: null,
      author_title: STAFF_TITLE_ID,
      author_level: null,
      body,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message, status: 500 };

  const push = await pushToUser(supabase, {
    userId: p.author_id,
    skipId: authorId,
    title: `${nickname}님이 답글을 남겼어요`,
    body: body.length > 80 ? `${body.slice(0, 80)}…` : body,
    url: `/community/${target.id}`,
  });
  return { ok: true, value: { commentId: (inserted as { id: string }).id, nickname, ...push } };
}

/** 한 명에게 푸시. 구독 없으면 조용히 통과, 410/404 구독은 삭제. */
async function pushToUser(
  supabase: SupabaseClient,
  args: { userId: string; skipId: string; title: string; body: string; url: string },
): Promise<{ pushed: number; pushFailed: number }> {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (args.userId === args.skipId || !vapidPublic || !vapidPrivate) return { pushed: 0, pushFailed: 0 };
  webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`, vapidPublic, vapidPrivate);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", args.userId);
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

// ── 반응 수치 (exe 의 자가 학습 루프용) ────────────────────────

export interface PostMetrics {
  id: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  /** 운영 댓글을 뺀 이용자 댓글 샘플 (비밀 댓글 제외, 최신 8개) */
  replies: { authorName: string; body: string; createdAt: string }[];
}

export interface CommentMetrics {
  id: string;
  postId: string;
  createdAt: string;
  /** 이 운영 댓글 뒤에 달린 이용자 댓글 수 */
  repliesAfter: number;
  /** 글쓴이가 그 뒤에 댓글을 남겼는지 */
  authorReplied: boolean;
}

export async function collectMetrics(
  supabase: SupabaseClient,
  ids: { postIds: string[]; commentIds: string[] },
): Promise<BotResult<{ posts: PostMetrics[]; comments: CommentMetrics[] }>> {
  const postIds = ids.postIds.slice(0, 50);
  const commentIds = ids.commentIds.slice(0, 50);
  const posts: PostMetrics[] = [];
  const comments: CommentMetrics[] = [];

  if (postIds.length) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, view_count, like_count, comment_count, created_at")
      .in("id", postIds);
    if (error) return { ok: false, error: error.message, status: 500 };
    const { data: cmts } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author_id, author_name, author_title, body, is_secret, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: false })
      .limit(400);
    const byPost = new Map<string, CommentRow[]>();
    for (const c of (cmts ?? []) as CommentRow[]) {
      if (c.author_title === STAFF_TITLE_ID || c.is_secret) continue;
      const list = byPost.get(c.post_id) ?? [];
      if (list.length < 8) list.push(c);
      byPost.set(c.post_id, list);
    }
    for (const p of (data ?? []) as { id: string; view_count: number; like_count: number; comment_count: number; created_at: string }[]) {
      posts.push({
        id: p.id,
        viewCount: p.view_count ?? 0,
        likeCount: p.like_count ?? 0,
        commentCount: p.comment_count ?? 0,
        createdAt: p.created_at,
        replies: (byPost.get(p.id) ?? []).map((c) => ({ authorName: c.author_name ?? "익명", body: c.body.slice(0, 200), createdAt: c.created_at })),
      });
    }
  }

  if (commentIds.length) {
    const { data: mine, error } = await supabase
      .from("post_comments")
      .select("id, post_id, parent_id, author_id, author_name, author_title, body, is_secret, created_at")
      .in("id", commentIds);
    if (error) return { ok: false, error: error.message, status: 500 };
    const mineRows = (mine ?? []) as CommentRow[];
    const targetPostIds = [...new Set(mineRows.map((c) => c.post_id))];
    if (targetPostIds.length) {
      const [{ data: later }, { data: postRows }] = await Promise.all([
        supabase
          .from("post_comments")
          .select("id, post_id, parent_id, author_id, author_name, author_title, body, is_secret, created_at")
          .in("post_id", targetPostIds)
          .order("created_at", { ascending: true })
          .limit(400),
        supabase.from("posts").select("id, author_id").in("id", targetPostIds),
      ]);
      const postAuthor = new Map(((postRows ?? []) as { id: string; author_id: string | null }[]).map((p) => [p.id, p.author_id]));
      const laterRows = ((later ?? []) as CommentRow[]).filter((c) => c.author_title !== STAFF_TITLE_ID);
      for (const c of mineRows) {
        const after = laterRows.filter((l) => l.post_id === c.post_id && l.created_at > c.created_at);
        comments.push({
          id: c.id,
          postId: c.post_id,
          createdAt: c.created_at,
          repliesAfter: after.length,
          authorReplied: after.some((l) => l.author_id && l.author_id === postAuthor.get(c.post_id)),
        });
      }
    }
  }
  return { ok: true, value: { posts, comments } };
}
