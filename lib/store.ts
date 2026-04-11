// ══════════════════════════════════════════
// 도시공존 — localStorage CRUD 스토어
// ══════════════════════════════════════════

import type { Post, Comment, PostCategory } from "./types";

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

// ── 초기 샘플 데이터 ──
const SEED_POSTS: Post[] = [
  {
    id: "seed-1",
    category: "emergency",
    title: "강남역 근처 다친 고양이 발견",
    content: "오른쪽 앞다리를 절뚝거리고 있어요. 역삼동 GS25 앞 골목입니다. 도움이 필요합니다.",
    authorId: "admin",
    authorName: "도시공존",
    region: "역삼동",
    images: [],
    isPinned: false,
    viewCount: 42,
    likeCount: 15,
    commentCount: 8,
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "seed-2",
    category: "foster",
    title: "마포구 새끼 고양이 3마리 임시보호 구합니다",
    content: "아파트 주차장에서 발견된 생후 약 3주 된 아기 고양이들입니다. 엄마가 보이지 않아 임시보호가 시급합니다.",
    authorId: "user-1",
    authorName: "캣맘서울",
    region: "합정동",
    images: [],
    isPinned: false,
    viewCount: 156,
    likeCount: 23,
    commentCount: 12,
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "seed-3",
    category: "adoption",
    title: "건강한 성묘 입양 보내드립니다 (중성화 완료)",
    content: "2살 된 코숏 수컷입니다. 중성화, 예방접종 모두 완료. 사람을 잘 따르고 성격이 온순합니다.",
    authorId: "user-2",
    authorName: "고양이사랑",
    region: "역삼동",
    images: [],
    isPinned: false,
    viewCount: 89,
    likeCount: 31,
    commentCount: 7,
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "seed-4",
    category: "market",
    title: "사용감 적은 캣타워 무료나눔합니다",
    content: "이사 가면서 정리해요. 155cm 4단 캣타워, 최근에 소독 + 천갈이 완료. 직거래만 가능해요 (용산구).",
    authorId: "user-3",
    authorName: "정리중입니다",
    region: "이태원동",
    images: [],
    isPinned: false,
    viewCount: 67,
    likeCount: 45,
    commentCount: 3,
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: "seed-5",
    category: "emergency",
    title: "서초구 방배동 턱시도 고양이 실종",
    content: "4월 1일부터 보이지 않습니다. 목에 파란색 목걸이를 하고 있어요. 목격하신 분 연락 부탁드려요.",
    authorId: "user-4",
    authorName: "방배냥이",
    region: "방배동",
    images: [],
    isPinned: false,
    viewCount: 234,
    likeCount: 8,
    commentCount: 15,
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
  },
  {
    id: "seed-6",
    category: "free",
    title: "오늘 만난 이어팁 고양이 너무 귀여워요",
    content: "출근길에 매일 보는 치즈태비인데 오늘따라 다가와서 손 냄새를 맡더라고요 🥹",
    authorId: "user-5",
    authorName: "출근냥덕",
    region: "합정동",
    images: [],
    isPinned: false,
    viewCount: 312,
    likeCount: 87,
    commentCount: 21,
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
];

// 카테고리 구조 변경 시 키 버전 업 (기존 localStorage 무효화)
const POSTS_KEY = "dosigongzon_posts_v2";
const COMMENTS_KEY = "dosigongzon_comments";

// ── Posts CRUD ──

export function getPosts(): Post[] {
  const posts = get<Post[]>(POSTS_KEY, []);
  if (posts.length === 0) {
    set(POSTS_KEY, SEED_POSTS);
    return SEED_POSTS;
  }
  return posts;
}

export function getPostsByCategory(category: PostCategory): Post[] {
  return getPosts().filter((p) => p.category === category);
}

export function getPostsByRegion(region: string): Post[] {
  return getPosts().filter((p) => p.region === region);
}

// ── Post Votes (커뮤니티 글 좋아요/싫어요, localStorage) ──
const POST_VOTES_KEY = "dosigongzon_post_votes";

export type PostVote = 1 | -1;

export function getMyPostVotes(): Record<string, PostVote> {
  return get<Record<string, PostVote>>(POST_VOTES_KEY, {});
}

/**
 * 포스트 투표 토글.
 * - 현재 투표 없음 → next로 설정 (+1)
 * - 같은 투표 다시 누름 → 취소 (-1)
 * - 반대 투표 누름 → 전환 (-1 + +1)
 * 반환: 갱신된 포스트
 */
export function votePost(postId: string, next: PostVote): Post | undefined {
  const votes = getMyPostVotes();
  const prev = votes[postId] ?? 0;
  const posts = getPosts();
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx < 0) return undefined;

  const post = { ...posts[idx] };
  // dislikeCount가 없는 기존 타입을 보존하기 위해 any 캐스팅은 지양.
  // 대신 likeCount만 사용하고 dislike는 별도 저장소에 보관.
  const dislikes = getDislikeCounts();
  const prevDislike = dislikes[postId] ?? 0;

  // 이전 투표 되돌리기
  if (prev === 1) post.likeCount = Math.max(0, post.likeCount - 1);
  if (prev === -1) dislikes[postId] = Math.max(0, prevDislike - 1);

  // 새 투표 적용 (같은 걸 다시 누르면 취소)
  const newVote: PostVote | 0 = prev === next ? 0 : next;
  if (newVote === 1) post.likeCount += 1;
  if (newVote === -1) dislikes[postId] = (dislikes[postId] ?? 0) + 1;

  // 저장
  posts[idx] = post;
  set(POSTS_KEY, posts);
  setDislikeCounts(dislikes);
  if (newVote === 0) delete votes[postId];
  else votes[postId] = newVote;
  set(POST_VOTES_KEY, votes);

  return post;
}

// ── Post Dislike 카운트 (타입 확장 없이 별도 저장) ──
const POST_DISLIKES_KEY = "dosigongzon_post_dislikes";

export function getDislikeCounts(): Record<string, number> {
  return get<Record<string, number>>(POST_DISLIKES_KEY, {});
}

function setDislikeCounts(counts: Record<string, number>) {
  set(POST_DISLIKES_KEY, counts);
}

export function getPostDislike(postId: string): number {
  return getDislikeCounts()[postId] ?? 0;
}

// 사용자 동네 저장/불러오기
const REGION_KEY = "dosigongzon_region";

export function getUserRegion(): string {
  return get<string>(REGION_KEY, "");
}

export function setUserRegion(region: string) {
  set(REGION_KEY, region);
}

export function getPostById(id: string): Post | undefined {
  return getPosts().find((p) => p.id === id);
}

export function addPost(post: Omit<Post, "id" | "viewCount" | "likeCount" | "commentCount" | "createdAt">): Post {
  const newPost: Post = {
    ...post,
    id: Date.now().toString(),
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
  };
  const posts = getPosts();
  set(POSTS_KEY, [newPost, ...posts]);
  return newPost;
}

export function deletePost(id: string) {
  const posts = getPosts().filter((p) => p.id !== id);
  set(POSTS_KEY, posts);
}

// ── Comments CRUD ──

export function getComments(postId: string): Comment[] {
  return get<Comment[]>(COMMENTS_KEY, []).filter((c) => c.postId === postId);
}

export function addComment(comment: Omit<Comment, "id" | "createdAt">): Comment {
  const newComment: Comment = {
    ...comment,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  const all = get<Comment[]>(COMMENTS_KEY, []);
  set(COMMENTS_KEY, [...all, newComment]);

  // 게시글의 commentCount 증가
  const posts = getPosts();
  const updated = posts.map((p) =>
    p.id === comment.postId ? { ...p, commentCount: p.commentCount + 1 } : p
  );
  set(POSTS_KEY, updated);

  return newComment;
}

// ── 유틸 ──

export function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
