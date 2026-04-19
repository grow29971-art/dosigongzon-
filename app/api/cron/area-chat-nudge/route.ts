// 지역 채팅 유도 푸시 — Vercel Cron 매주 금 20:00 KST (11:00 UTC)
// 활동 지역 설정한 유저 중, 그 구의 최근 7일 채팅이 활발한데 본인은 참여 안 한 사람에게 개인화 푸시

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SEOUL_GUS } from "@/lib/seoul-regions";

/** 유저의 활동 지역 이름을 실제 구 이름으로 매핑. "연남동" → "마포구". */
function regionNameToGu(regionName: string): string | null {
  // 1) 직접 구 이름 포함
  const direct = SEOUL_GUS.find((g) => regionName.includes(g.name));
  if (direct) return direct.name;
  // 2) 동 이름 매칭 → 해당 구 반환
  for (const g of SEOUL_GUS) {
    if (g.dongs.some((d) => regionName.includes(d))) return g.name;
  }
  return null;
}

export const maxDuration = 300;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. 활동 지역이 설정된 유저(프라이머리) 모두 조회
  const { data: regions } = await supabase
    .from("user_activity_regions")
    .select("user_id, name, is_primary")
    .eq("is_primary", true);

  if (!regions || regions.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no primary regions" });
  }

  // 2. 구별로 최근 7일 메시지 수 집계 (한 번에)
  const { data: msgs } = await supabase
    .from("area_chats")
    .select("area, author_id, created_at")
    .gte("created_at", weekAgo);

  const areaTotal = new Map<string, number>();
  const areaUserMsgs = new Map<string, Set<string>>(); // area → {author_id들}
  for (const m of (msgs ?? []) as { area: string; author_id: string | null; created_at: string }[]) {
    areaTotal.set(m.area, (areaTotal.get(m.area) ?? 0) + 1);
    if (m.author_id) {
      if (!areaUserMsgs.has(m.area)) areaUserMsgs.set(m.area, new Set());
      areaUserMsgs.get(m.area)!.add(m.author_id);
    }
  }

  // 3. 푸시 구독 맵 — user_id별 subscription 여러개
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  const subsByUser = new Map<string, Array<{ id: string; endpoint: string; p256dh: string; auth: string }>>();
  for (const s of (subs ?? []) as Array<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push(s);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const perAreaStats: Record<string, number> = {};

  // 4. 대상 유저 추리기 + 푸시 발송
  for (const r of regions as { user_id: string; name: string; is_primary: boolean }[]) {
    // 유저 지역명 → 구 단위로 정규화 (area_chats.area와 형식 맞추기)
    const area = regionNameToGu(r.name) ?? r.name;
    const total = areaTotal.get(area) ?? 0;

    // 메시지 3개 이하면 "활발함" 기준 미달 → 스킵
    if (total < 3) { skipped++; continue; }
    // 이미 본인이 참여 중이면 스킵
    if (areaUserMsgs.get(area)?.has(r.user_id)) { skipped++; continue; }

    const userSubs = subsByUser.get(r.user_id);
    if (!userSubs || userSubs.length === 0) { skipped++; continue; }

    const title = `💬 ${area} 이웃들이 대화 중이에요`;
    const body = `이번 주 ${total}개의 이야기가 오갔어요. 잠깐 들러주세요!`;
    const url = "/map";

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url }),
        );
        sent++;
        perAreaStats[area] = (perAreaStats[area] ?? 0) + 1;
        await new Promise((res) => setTimeout(res, 80));
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return Response.json({
    ok: true,
    primaryRegionUsers: regions.length,
    sent,
    skipped,
    failed,
    perAreaStats,
  });
}

export const GET = POST;
