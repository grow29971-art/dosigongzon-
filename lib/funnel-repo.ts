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
  | "cat_detail_view_anon" // 비로그인이 고양이 상세에 도달 (pick 바로 앞단)
  | "onboarding_pick" // pick 단계에서 실제 아이 선택
  | "signup_view" // pick 다음 /signup 화면 도달 (2026-08-09 추가 — 아래 주석)
  | "signup_home" // 가입 후 홈 첫 도달 (pending_care 보유 상태)
  | "first_feed" // 핸드오프 CTA로 첫 밥 기록 성공
  | "petition_expand" // 커뮤니티 상단 청원 바를 펼침
  | "petition_click"; // 청원 카드 클릭(국회 사이트 이동)

// signup_view 를 넣은 이유 (2026-08-09):
// 최초의 onboarding_pick 이 발생했는데(01:24:28) 그 사람은 가입하지 않았다.
// pick 과 signup_home 사이가 완전히 암흑이라 "가입 화면에 가긴 했는가"조차 몰랐다.
// pick 은 있는데 signup_view 가 없으면 이동 자체 실패(인앱브라우저 차단 등),
// 둘 다 있는데 signup_home 이 없으면 가입 폼에서 이탈이다.

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* 폴백 */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── 유입 출처 (first-touch) ──
// 인스타 광고비가 뭘 사는지, 당근을 추가하면 그게 움직였는지 가르기 위한 최소 계측.
// first-touch 를 쓰는 이유: 가입은 방문 당일이 아니라 며칠 뒤에도 일어난다.
// 한 번 잡히면 덮어쓰지 않는다.
const SOURCE_KEY = "dosigongzon_utm_source";

// referrer 호스트 → 짧은 토큰. 목록에 없으면 호스트를 그대로 정규화해서 쓴다.
const REFERRER_MAP: [RegExp, string][] = [
  [/instagram\.com|l\.instagram|ig\.me/i, "instagram"],
  [/facebook\.com|fb\.me|fb\.com/i, "facebook"],
  [/daangn\.com|karrot/i, "daangn"],
  [/(^|\.)naver\.com/i, "naver"],
  [/(^|\.)google\./i, "google"],
  [/(^|\.)daum\.net|kakao/i, "kakao"],
  [/(^|\.)youtube\.com|youtu\.be/i, "youtube"],
  [/threads\.net/i, "threads"],
  [/(^|\.)x\.com|twitter\.com/i, "x"],
];

function normalizeSource(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 32);
}

/**
 * 최초 진입 시 1회 호출 — utm_source(또는 ref/utm_medium 없이 source만) 우선,
 * 없으면 referrer 호스트에서 유추해 저장한다. 이미 값이 있으면 아무것도 안 한다.
 * SourceCapture 컴포넌트가 앱 최상단에서 부른다.
 */
export function captureSource(): void {
  try {
    if (localStorage.getItem(SOURCE_KEY)) return; // first-touch 유지

    const params = new URLSearchParams(window.location.search);
    const explicit = params.get("utm_source") ?? params.get("ref");
    if (explicit) {
      const v = normalizeSource(explicit);
      if (v) { localStorage.setItem(SOURCE_KEY, v); return; }
    }

    const ref = document.referrer;
    if (!ref) { localStorage.setItem(SOURCE_KEY, "direct"); return; }

    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return; // 내부 이동 — 판단 보류

    for (const [re, token] of REFERRER_MAP) {
      if (re.test(host)) { localStorage.setItem(SOURCE_KEY, token); return; }
    }
    const v = normalizeSource(host.replace(/^www\./, ""));
    if (v) localStorage.setItem(SOURCE_KEY, v);
  } catch {
    /* localStorage·URL 파싱 차단 환경 — 출처 없이 계측만 계속한다 */
  }
}

function getSource(): string | null {
  try {
    return localStorage.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
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
const GUARD_PREFIX = "dosigongzon_funnel_v2_";

/** 이 기기가 해당 스텝을 이미 전송했는지 (가드 존재 여부) — 후속 스텝의 발화 조건 판정용 */
export function hasLoggedFunnelStep(step: FunnelStep): boolean {
  try {
    return !!localStorage.getItem(GUARD_PREFIX + step);
  } catch {
    return false;
  }
}

export function logFunnelEvent(step: FunnelStep, catId?: string | null): void {
  const guardKey = GUARD_PREFIX + step;
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
        body: JSON.stringify({ anonId: getAnonId(), step, catId: catId ?? null, source: getSource() }),
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
