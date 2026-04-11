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
  | "foster"     // 임시보호
  | "adoption"   // 입양
  | "market"     // 중고마켓
  | "free";      // 자유게시판

export const CATEGORY_MAP: Record<PostCategory, { label: string; color: string; emoji: string }> = {
  emergency: { label: "긴급",     color: "#D85555", emoji: "🚨" },
  foster:    { label: "임보",     color: "#E88D5A", emoji: "🏠" },
  adoption:  { label: "입양",     color: "#E86B8C", emoji: "💕" },
  market:    { label: "중고마켓", color: "#48A59E", emoji: "🛍️" },
  free:      { label: "자유게시판", color: "#8B65B8", emoji: "💬" },
};

// ── 게시글 ──
export interface Post {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  region?: string; // 동 단위 (예: "역삼동")
  images: string[];
  isPinned: boolean;
  viewCount: number;
  likeCount: number;
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
