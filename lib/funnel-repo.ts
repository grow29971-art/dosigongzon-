// ══════════════════════════════════════════
// 온보딩 퍼널 계측 Repository
// public.funnel_events — 기기(anon_id) 단위 스텝 이벤트.
// 목적: intro 진입 → 아이 고르기 → 가입 후 홈 도달 → 첫 밥 기록의 이탈 지점 실측.
// WAU 한 자릿수 규모라 통계가 아닌 "세션 단위 추적"이 목적 — 유료 툴 불필요.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

// 펀드투표(fund-vote-repo)와 같은 기기 식별자를 공유 — 기기당 퍼널 1회 추적
const ANON_ID_KEY = "dosigongzon_anon_id";

export type FunnelStep =
  | "onboarding_intro" // 온보딩 intro 화면 진입
  | "onboarding_pick" // pick 단계에서 실제 아이 선택
  | "signup_home" // 가입 후 홈 첫 도달 (pending_care 보유 상태)
  | "first_feed" // 핸드오프 CTA로 첫 밥 기록 성공
  | "petition_notice_view" // 청원 안내 팝업 노출 (2026-07-22 회의: 킬 조건 계측)
  | "petition_notice_click"; // 청원 안내 CTA 클릭 → 국회 사이트 이동

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* 폴백 */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

// 스텝당 기기 1회만 전송 (localStorage 1차 가드 + DB unique 2차 가드).
// 실패해도 UX에 영향 없어야 하므로 완전 fire-and-forget — 예외를 밖으로 내보내지 않는다.
export function logFunnelEvent(step: FunnelStep, catId?: string | null): void {
  try {
    const guardKey = `dosigongzon_funnel_${step}`;
    if (localStorage.getItem(guardKey)) return;
    localStorage.setItem(guardKey, "1");
  } catch { /* localStorage 차단 — DB unique가 중복을 막으므로 계속 진행 */ }

  (async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      // unique(anon_id, step) 충돌은 정상 흐름(재방문) — ignoreDuplicates로 조용히 무시
      await supabase.from("funnel_events").upsert(
        {
          anon_id: getAnonId(),
          step,
          user_id: user?.id ?? null,
          cat_id: catId ?? null,
        },
        { onConflict: "anon_id,step", ignoreDuplicates: true },
      );
    } catch {
      /* 마이그레이션 전·네트워크 실패 — 계측은 조용히 포기 */
    }
  })();
}
