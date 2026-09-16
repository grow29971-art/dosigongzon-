// ══════════════════════════════════════════
// 도시공존 — 타입 정의
// ══════════════════════════════════════════

// ── 유저 ──
export interface User {
  id: string;
  email: string;
  nickname: string;
  region: string;
  role: "user" | "admin";
  level: number; // 1~10
  createdAt: string;
}

// ── 게시글 카테고리 ──
export type PostCategory =
  | "emergency"  // 긴급
  | "sitter"     // 돌봄 부탁 (입원·여행 시 밥자리 대타 — 2026-08-29 PMF 개편)
  | "foster"     // 임시보호
  | "adoption"   // 입양
  | "market"     // 중고마켓
  | "free";      // 자유게시판

// 2026-09-16 리디자인: 장식색 제거 — 회색 단일(긴급만 오류색)
export const CATEGORY_MAP: Record<PostCategory, { label: string; color: string; emoji: string }> = {
  emergency: { label: "긴급",     color: "#F04452", emoji: "🚨" },
  sitter:    { label: "돌봄 부탁", color: "#767676", emoji: "🤝" },
  foster:    { label: "임보",     color: "#767676", emoji: "🏠" },
  adoption:  { label: "입양",     color: "#767676", emoji: "💕" },
  market:    { label: "중고마켓", color: "#767676", emoji: "🛍️" },
  free:      { label: "자유게시판", color: "#767676", emoji: "💬" },
};

// ── 게시글 ──
export interface Post {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorTitle?: string | null;
  authorLevel?: number | null;
  region?: string;
  images: string[];
  isPinned: boolean;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  createdAt: string;
}

// ── 댓글 ──
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ── 동물병원 ──
export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  features: string[];
  city: string;
  district: string;
}

// ── 쉼터 ──
export interface Shelter {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  status: "active" | "inactive";
  lastCheckedAt: string;
  notes: string;
}
