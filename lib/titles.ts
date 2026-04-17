// ══════════════════════════════════════════
// 도시공존 — 타이틀(업적) 시스템
// 기존 활동 요약(MyActivitySummary) 기반 순수 함수.
// 해제 조건이 바뀌면 자동으로 반영 — 별도 DB 테이블 없음.
// ══════════════════════════════════════════

import type { MyActivitySummary } from "@/lib/cats-repo";

export type TitleCategory = "register" | "record" | "alert" | "popular";

export interface TitleDef {
  id: string;
  name: string;
  emoji: string;
  category: TitleCategory;
  description: string;
  // 잠금 해제 체크
  unlocked: (s: MyActivitySummary) => boolean;
  // 진행률 표시용 (0~1)
  progress: (s: MyActivitySummary) => number;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export const TITLES: TitleDef[] = [
  // ── 등록 (catCount) ──
  {
    id: "first_cat",
    name: "첫 발걸음",
    emoji: "🌱",
    category: "register",
    description: "첫 번째 고양이를 등록했어요",
    unlocked: (s) => s.catCount >= 1,
    progress: (s) => clamp01(s.catCount / 1),
  },
  {
    id: "diligent_caretaker",
    name: "부지런한 집사",
    emoji: "🐾",
    category: "register",
    description: "5마리의 고양이를 지도에 남겼어요",
    unlocked: (s) => s.catCount >= 5,
    progress: (s) => clamp01(s.catCount / 5),
  },
  {
    id: "village_eye",
    name: "마을의 눈",
    emoji: "🏡",
    category: "register",
    description: "20마리 이상 등록한 동네 길잡이",
    unlocked: (s) => s.catCount >= 20,
    progress: (s) => clamp01(s.catCount / 20),
  },

  // ── 기록 (commentCount) ──
  {
    id: "first_note",
    name: "첫 기록",
    emoji: "✍️",
    category: "record",
    description: "첫 번째 돌봄 기록을 남겼어요",
    unlocked: (s) => s.commentCount >= 1,
    progress: (s) => clamp01(s.commentCount / 1),
  },
  {
    id: "steady_writer",
    name: "꾸준한 기록가",
    emoji: "📓",
    category: "record",
    description: "10개의 돌봄 기록을 남겼어요",
    unlocked: (s) => s.commentCount >= 10,
    progress: (s) => clamp01(s.commentCount / 10),
  },
  {
    id: "story_collector",
    name: "이야기 수집가",
    emoji: "📚",
    category: "record",
    description: "50개 이상의 기록을 남긴 성실한 기록자",
    unlocked: (s) => s.commentCount >= 50,
    progress: (s) => clamp01(s.commentCount / 50),
  },

  // ── 경보 (alertCount) ──
  {
    id: "awake_eye",
    name: "깨어있는 눈",
    emoji: "🚨",
    category: "alert",
    description: "첫 학대 경보를 기록했어요",
    unlocked: (s) => s.alertCount >= 1,
    progress: (s) => clamp01(s.alertCount / 1),
  },
  {
    id: "guardian",
    name: "수호자",
    emoji: "🛡️",
    category: "alert",
    description: "5건의 경보로 동네를 지켰어요",
    unlocked: (s) => s.alertCount >= 5,
    progress: (s) => clamp01(s.alertCount / 5),
  },
  {
    id: "hero",
    name: "영웅",
    emoji: "⚔️",
    category: "alert",
    description: "15건 이상의 경보를 남긴 진정한 수호자",
    unlocked: (s) => s.alertCount >= 15,
    progress: (s) => clamp01(s.alertCount / 15),
  },

  // ── 공감 (likesReceived) ──
  {
    id: "loved",
    name: "인기쟁이",
    emoji: "💗",
    category: "popular",
    description: "10개의 좋아요를 받았어요",
    unlocked: (s) => s.likesReceived >= 10,
    progress: (s) => clamp01(s.likesReceived / 10),
  },
  {
    id: "village_star",
    name: "동네 스타",
    emoji: "⭐",
    category: "popular",
    description: "50개 이상의 공감을 받은 이웃",
    unlocked: (s) => s.likesReceived >= 50,
    progress: (s) => clamp01(s.likesReceived / 50),
  },
  {
    id: "legend",
    name: "전설",
    emoji: "👑",
    category: "popular",
    description: "200개 이상의 좋아요를 받은 전설",
    unlocked: (s) => s.likesReceived >= 200,
    progress: (s) => clamp01(s.likesReceived / 200),
  },
];

export const CATEGORY_LABELS: Record<TitleCategory, string> = {
  register: "등록",
  record: "기록",
  alert: "경보",
  popular: "공감",
};

export const CATEGORY_COLORS: Record<TitleCategory, string> = {
  register: "#6B8E6F",
  record: "#4A7BA8",
  alert: "#D85555",
  popular: "#C9A961",
};

export interface TitleStatus extends TitleDef {
  isUnlocked: boolean;
  progressValue: number;
}

export function getTitleStatuses(summary: MyActivitySummary): TitleStatus[] {
  return TITLES.map((t) => ({
    ...t,
    isUnlocked: t.unlocked(summary),
    progressValue: t.progress(summary),
  }));
}

export function countUnlocked(summary: MyActivitySummary): number {
  return TITLES.filter((t) => t.unlocked(summary)).length;
}

// ── 관리자 부여 특별 타이틀 ──
export interface AdminTitle {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

export const ADMIN_TITLES: AdminTitle[] = [
  { id: "official_volunteer", name: "공식 봉사자", emoji: "💛", color: "#C9A961", description: "공식 인증된 길고양이 봉사 활동가" },
  { id: "tnr_expert", name: "TNR 전문가", emoji: "✂️", color: "#8B65B8", description: "TNR 활동에 적극 기여한 시민" },
  { id: "rescue_hero", name: "구조 영웅", emoji: "🦸", color: "#D85555", description: "위기 상황에서 고양이를 구조한 시민" },
  { id: "community_leader", name: "커뮤니티 리더", emoji: "🌟", color: "#E88D5A", description: "커뮤니티를 이끄는 모범 회원" },
  { id: "veterinary_partner", name: "수의 파트너", emoji: "🏥", color: "#48A59E", description: "수의학 지식을 나누는 협력자" },
  { id: "early_supporter", name: "초기 서포터", emoji: "🌱", color: "#6B8E6F", description: "서비스 초기부터 함께한 서포터" },
  { id: "content_creator", name: "콘텐츠 크리에이터", emoji: "📸", color: "#4A7BA8", description: "우수한 돌봄 콘텐츠를 생산하는 회원" },
  { id: "donor", name: "후원자", emoji: "💝", color: "#E86B8C", description: "길고양이 돌봄을 후원하는 회원" },
];

export function findAdminTitle(id: string | null | undefined): AdminTitle | null {
  if (!id) return null;
  return ADMIN_TITLES.find((t) => t.id === id) ?? null;
}

// ── 장착 관련 ──
// equipped_title은 Supabase auth user_metadata에 저장됨.
// 여기서는 id → TitleDef 조회 헬퍼만 제공.
export function findTitleById(id: string | null | undefined): TitleDef | null {
  if (!id) return null;
  return TITLES.find((t) => t.id === id) ?? null;
}

