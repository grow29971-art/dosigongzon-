// ══════════════════════════════════════════
// 이메일 위클리 다이제스트 — 컨텐츠 생성 & HTML 렌더
// 서버 전용 (cron에서 호출, service_role 필요)
// ══════════════════════════════════════════

import { createClient as createServiceClient } from "@supabase/supabase-js";

const SITE_URL = "https://dosigongzon.com";

export interface DigestRecipient {
  id: string;
  email: string;
  nickname: string | null;
}

export interface DigestCatPreview {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  health_status: string;
  created_at: string;
}

export interface DigestContent {
  newCatsThisWeek: number;
  newUsersThisWeek: number;
  urgentCats: DigestCatPreview[]; // 건강 위험 고양이
  popularCats: DigestCatPreview[]; // 이번 주 좋아요 많은 고양이
  myCatCount: number; // 받는 유저의 등록 고양이 수
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** 다이제스트 수신 대상 유저 조회 (opt-in, 최근 발송 7일 이상 경과). */
export async function listDigestRecipients(): Promise<DigestRecipient[]> {
  const supabase = getServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, nickname, last_digest_sent_at")
    .eq("email_digest_enabled", true)
    .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${sevenDaysAgo}`);

  if (error || !profiles) {
    console.error("[weekly-digest] listDigestRecipients failed:", error);
    return [];
  }

  // auth.users에서 이메일 가져오기 (service_role만 가능)
  const ids = (profiles as { id: string }[]).map((p) => p.id);
  if (ids.length === 0) return [];

  // Supabase Admin: getUserById 반복 대신 Auth API의 listUsers 로 한 번에
  const { data: usersRes } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: Math.max(1000, ids.length),
  });
  const emailById = new Map<string, string>();
  for (const u of usersRes?.users ?? []) {
    if (u.email && u.id) emailById.set(u.id, u.email);
  }

  const nickById = new Map<string, string | null>(
    (profiles as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname]),
  );

  return ids
    .map((id) => {
      const email = emailById.get(id);
      if (!email) return null;
      return { id, email, nickname: nickById.get(id) ?? null };
    })
    .filter((r): r is DigestRecipient => r !== null);
}

/** 이번 주 공통 컨텐츠(수신자별 my* 필드 제외) 집계. */
export async function getDigestBaseContent(): Promise<Omit<DigestContent, "myCatCount">> {
  const supabase = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [catsRes, usersRes, urgentRes, popularRes] = await Promise.all([
    supabase
      .from("cats")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("cats")
      .select("id, name, region, photo_url, health_status, created_at")
      .eq("health_status", "danger")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("cats")
      .select("id, name, region, photo_url, health_status, created_at, like_count")
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return {
    newCatsThisWeek: catsRes.count ?? 0,
    newUsersThisWeek: usersRes.count ?? 0,
    urgentCats: (urgentRes.data ?? []) as DigestCatPreview[],
    popularCats: (popularRes.data ?? []) as DigestCatPreview[],
  };
}

export async function getMyCatCount(userId: string): Promise<number> {
  const supabase = getServiceClient();
  const { count } = await supabase
    .from("cats")
    .select("*", { count: "exact", head: true })
    .eq("caretaker_id", userId);
  return count ?? 0;
}

/** 마크업 — 기본 이메일 클라이언트 호환성 우선 (inline style + 단순 테이블 X). */
export function renderDigestHtml(
  recipient: DigestRecipient,
  content: DigestContent,
): { subject: string; html: string; text: string } {
  const displayName = recipient.nickname || recipient.email.split("@")[0];
  const subject = `🐾 도시공존 이번 주 소식 — 새 고양이 ${content.newCatsThisWeek}마리`;

  const catCard = (c: DigestCatPreview, urgent: boolean) => {
    const photo = c.photo_url || `${SITE_URL}/icons/icon-192.png`;
    const label = urgent ? "🚨 긴급" : "❤️ 인기";
    const labelBg = urgent ? "#D85555" : "#E86B8C";
    return `
      <div style="background:#fff;border-radius:14px;overflow:hidden;margin-bottom:10px;box-shadow:0 2px 10px rgba(0,0,0,0.06);">
        <a href="${SITE_URL}/cats/${c.id}?utm_source=email&utm_medium=digest" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:12px;padding:10px;">
          <img src="${photo}" width="60" height="60" style="border-radius:10px;object-fit:cover;flex-shrink:0;" alt="${c.name}" />
          <div style="flex:1;min-width:0;">
            <div style="display:inline-block;background:${labelBg};color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;margin-bottom:4px;">${label}</div>
            <div style="font-size:14px;font-weight:800;color:#2A2A28;">${c.name}</div>
            <div style="font-size:11px;color:#8B7562;margin-top:2px;">📍 ${c.region ?? "우리 동네"}</div>
          </div>
        </a>
      </div>
    `;
  };

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <!-- 헤더 -->
    <div style="background:#fff;border-radius:20px;padding:24px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,0.05);">
      <div style="font-size:11px;font-weight:800;color:#C47E5A;letter-spacing:0.15em;">WEEKLY DIGEST</div>
      <div style="font-size:24px;font-weight:900;color:#2A2A28;margin-top:6px;letter-spacing:-0.02em;">
        ${displayName} 님, <br/>이번 주 <span style="color:#C47E5A;">도시공존</span> 소식이에요
      </div>
      <div style="font-size:13px;color:#8B7562;margin-top:10px;line-height:1.6;">
        서울 전역에 <b style="color:#C47E5A;">새 고양이 ${content.newCatsThisWeek}마리</b>가 등록됐고,
        <b style="color:#E86B8C;">${content.newUsersThisWeek}명</b>의 새 이웃이 합류했어요.
        ${content.myCatCount > 0 ? `당신이 돌보는 아이 <b>${content.myCatCount}마리</b>도 기다리고 있어요.` : ""}
      </div>
    </div>

    ${content.urgentCats.length > 0 ? `
    <!-- 긴급 -->
    <div style="margin-bottom:14px;">
      <div style="font-size:15px;font-weight:800;color:#D85555;margin-bottom:10px;padding-left:4px;">
        🚨 지금 도움이 필요한 아이들
      </div>
      ${content.urgentCats.map((c) => catCard(c, true)).join("")}
    </div>
    ` : ""}

    ${content.popularCats.length > 0 ? `
    <!-- 인기 -->
    <div style="margin-bottom:14px;">
      <div style="font-size:15px;font-weight:800;color:#E86B8C;margin-bottom:10px;padding-left:4px;">
        ❤️ 이번 주 인기 고양이
      </div>
      ${content.popularCats.map((c) => catCard(c, false)).join("")}
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,#C47E5A 0%,#A8684A 100%);border-radius:18px;padding:20px;text-align:center;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:10px;">
        오늘 동네 아이들 안부 확인하러 가볼까요?
      </div>
      <a href="${SITE_URL}/map?utm_source=email&utm_medium=digest&utm_campaign=weekly"
         style="display:inline-block;background:#fff;color:#C47E5A;font-size:13px;font-weight:800;padding:12px 24px;border-radius:999px;text-decoration:none;">
        지도 바로 열기 →
      </a>
    </div>

    <!-- footer -->
    <div style="text-align:center;font-size:11px;color:#A38E7A;line-height:1.7;padding:16px;">
      <b style="color:#8B7562;">(광고)</b> 도시공존 주간 동네 소식 —
      수신 동의하신 분께만 발송되는 메일이에요 🐾<br/>
      <a href="${SITE_URL}/mypage?utm_source=email&utm_medium=digest&unsub=1#email-digest"
         style="color:#8B7562;text-decoration:underline;font-weight:700;">
        수신 거부
      </a>
      &nbsp;·&nbsp;
      <a href="${SITE_URL}/about" style="color:#A38E7A;text-decoration:underline;">도시공존 소개</a>
      <br/>
      <span style="color:#C0B3A0;font-size:10px;">
        원하지 않으시면 위 '수신 거부' 링크를 눌러 즉시 차단할 수 있어요.
      </span>
    </div>
  </div>
</body>
</html>`;

  const text = `
(광고) ${displayName} 님, 이번 주 도시공존 소식이에요.

이번 주 서울에서
- 새 고양이 ${content.newCatsThisWeek}마리 등록
- ${content.newUsersThisWeek}명의 새 이웃 합류
${content.urgentCats.length > 0 ? `- 🚨 지금 도움이 필요한 아이 ${content.urgentCats.length}마리` : ""}

지도 바로 열기: ${SITE_URL}/map?utm_source=email&utm_medium=digest

수신 거부: ${SITE_URL}/mypage#email-digest
도시공존 — 광고 없는 무료 시민 서비스
`.trim();

  return { subject, html, text };
}

/** 발송 완료 후 last_digest_sent_at 업데이트. */
export async function markDigestSent(userId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("profiles")
    .update({ last_digest_sent_at: new Date().toISOString() })
    .eq("id", userId);
}
