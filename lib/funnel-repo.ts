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
  | "first_feed"; // 핸드오프 CTA로 첫 밥 기록 성공

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
// v2 (2026-07-22 회의): 가드를 인서트 "성공 후"에만 설정 — v1은 실패해도 가드가 남아
// 그 기기가 영구 침묵했다(RLS 미적용 기간의 방문 기기 전원이 이 상태). 키도 v2로 올려
// v1 가드에 물린 기기들이 다시 전송을 시도하게 한다.
export function logFunnelEvent(step: FunnelStep, catId?: string | null): void {
  const guardKey = `dosigongzon_funnel_v2_${step}`;
  try {
    if (localStorage.getItem(guardKey)) return;
  } catch { /* localStorage 차단 — DB unique가 중복을 막으므로 계속 진행 */ }

  (async () => {
    try {
      // 서버 라우트 경유 (2026-07-22: 프로덕션 anon RLS가 원인 불명으로 거부 지속 →
      // /api/funnel(service role + 검증 + 레이트리밋)로 우회. RLS 의존 제거.)
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const { data } = await createClient().auth.getSession();
        if (data.session?.access_token) {
          headers["Authorization"] = `Bearer ${data.session.access_token}`;
        }
      } catch { /* 비로그인 — anon 계측 */ }
      const res = await fetch("/api/funnel", {
        method: "POST",
        headers,
        body: JSON.stringify({ anonId: getAnonId(), step, catId: catId ?? null }),
        keepalive: true,
      });
      if (res.ok) {
        try { localStorage.setItem(guardKey, "1"); } catch { /* 무시 */ }
      }
    } catch {
      /* 네트워크 실패 — 가드를 안 남겼으므로 다음 방문에 재시도된다 */
    }
  })();
}
