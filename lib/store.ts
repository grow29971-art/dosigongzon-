// ══════════════════════════════════════════
// 도시공존 — localStorage 전용 스토어
// 커뮤니티 글/댓글은 Supabase(posts-repo/posts-server)로 이관됨.
// 여기엔 localStorage 전용 상태만 남긴다: ① 글 투표 dedup ② 사용자 동네 선호.
// (이관 후 미사용이 된 posts/comments seed·CRUD, 중복 formatRelativeTime은 제거 —
//  formatRelativeTime/getPostById 등은 전부 posts-repo 것을 사용한다.)
// ══════════════════════════════════════════

// ── 헬퍼 ──
function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota 초과 무시 */ }
}

// ── Post Votes (커뮤니티 글 좋아요/싫어요 dedup, localStorage) ──
// 카운트 증감은 DB RPC로 처리하고, "내가 어떤 글에 어떻게 투표했는지"만 여기 저장.
const POST_VOTES_KEY = "dosigongzon_post_votes";

export type PostVote = 1 | -1;

export function getMyPostVotes(): Record<string, PostVote> {
  return get<Record<string, PostVote>>(POST_VOTES_KEY, {});
}

/** 유저 투표 상태만 localStorage에 저장 (카운트 증감은 DB RPC로 별도 처리) */
export function setMyPostVote(postId: string, vote: PostVote | 0): void {
  const votes = getMyPostVotes();
  if (vote === 0) delete votes[postId];
  else votes[postId] = vote;
  set(POST_VOTES_KEY, votes);
}

// ── 사용자 동네 저장/불러오기 ──
const REGION_KEY = "dosigongzon_region";

export function getUserRegion(): string {
  return get<string>(REGION_KEY, "");
}

export function setUserRegion(region: string) {
  set(REGION_KEY, region);
}
