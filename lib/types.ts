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
  | "emergency"  // 긴급 제보
  | "foster"     // 임시보호
  | "adoption"   // 입양
  | "care"       // 급식소/돌봄
  | "lost"       // 실종/보호
  | "free";      // 자유게시판

export const CATEGORY_MAP: Record<PostCategory, { label: string; color: string; emoji: string }> = {
  emergency: { label: "긴급 제보", color: "#EF4444", emoji: "🚨" },
  foster:    { label: "임시보호", color: "#F97316", emoji: "🏠" },
  adoption:  { label: "입양",    color: "#EC4899", emoji: "💕" },
  care:      { label: "돌봄",    color: "#22C55E", emoji: "🌿" },
  lost:      { label: "실종/보호", color: "#3B82F6", emoji: "🔍" },
  free:      { label: "자유",    color: "#8B5CF6", emoji: "💬" },
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
