// 여정 A(신규 7일) — 가입 후 8일 안 유저에게 쪽지(+동의자 푸시)로 단계 안내. daily-dispatch가 매일 09:00 KST 호출.
// 단계·문구·대조군 판정은 lib/journey.ts(순수). 발송 기록은 journey_sends(box/supabase_journey_sends_20260930.sql).
// 원칙: 첫 돌봄 기록을 남긴 유저는 종료 / 하루 1통 / 단계당 1회(unique) / 대조군 10%는 기록만 남기고 미발송.
// 선점(claim) 후 발송: 행을 먼저 넣고 넣어진 것만 보낸다 → 재실행·동시 실행에도 중복 발송 없음(최대 1회).
// DM 발신자는 broadcast-dm 관례대로 운영자(admins 첫 행) — 도배 트리거가 admin 발신을 면제한다.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { toKstDate } from "@/lib/kst";
import { JOURNEY_NAME, journeyMessage, planJourney, type JourneyStep } from "@/lib/journey";

export const maxDuration = 300;

const WINDOW_DAYS = 8;
// ponytail: 8일 창 가입자를 한 번에 읽는다(현재 하루 수 명~수십 명). 하루 수천 명이 되면 페이지 처리·청크 in().
const MAX_USERS = 1000;

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type Send = { user_id: string; journey: string; step: string; channel: "dm" | "push" | "none"; holdout: boolean };

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: false, error: "서버 설정 미완료" }, { status: 500 });
  }
  const pushReady = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (pushReady) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
  }

  const db = createServiceClient();
  const now = new Date();
  const since = new Date(+now - WINDOW_DAYS * 864e5).toISOString();
  const kstMidnight = new Date(`${toKstDate(now)}T00:00:00+09:00`).toISOString();

  const { data: profs, error: pErr } = await db
    .from("profiles")
    .select("id, nickname, created_at, marketing_push_enabled, admin_title")
    .gte("created_at", since)
    .limit(MAX_USERS);
  if (pErr) return Response.json({ ok: false, error: "프로필 조회 실패" }, { status: 500 });
  const users = ((profs ?? []) as {
    id: string; nickname: string | null; created_at: string;
    marketing_push_enabled: boolean | null; admin_title: string | null;
  }[]);
  if (users.length === 0) return Response.json({ ok: true, sent: 0, reason: "no candidates" });
  const ids = users.map((u) => u.id);

  // 이력 조회 — 테이블이 아직 없으면(SQL 미실행) 아무것도 하지 않고 ok
  const { data: hist, error: hErr } = await db
    .from("journey_sends")
    .select("user_id, step, channel, sent_at")
    .eq("journey", JOURNEY_NAME)
    .in("user_id", ids);
  if (hErr) {
    if (hErr.code === "42P01" || hErr.code === "PGRST205") {
      return Response.json({ ok: true, sent: 0, reason: "journey_sends 테이블 없음(SQL 미실행)" });
    }
    return Response.json({ ok: false, error: "이력 조회 실패" }, { status: 500 });
  }
  const doneBy = new Map<string, Set<string>>();
  const sentToday = new Set<string>();
  for (const h of (hist ?? []) as { user_id: string; step: string; channel: string; sent_at: string }[]) {
    (doneBy.get(h.user_id) ?? doneBy.set(h.user_id, new Set()).get(h.user_id)!).add(h.step);
    if (h.channel !== "none" && h.sent_at >= kstMidnight) sentToday.add(h.user_id);
  }

  const [logsRes, catsRes, adminsRes] = await Promise.all([
    db.from("care_logs").select("author_id").in("author_id", ids),
    db.from("cats").select("id, caretaker_id, created_at").in("caretaker_id", ids).order("created_at", { ascending: true }),
    db.from("admins").select("user_id").order("user_id", { ascending: true }),
  ]);
  if (logsRes.error || catsRes.error || adminsRes.error) {
    return Response.json({ ok: false, error: "조회 실패" }, { status: 500 });
  }
  const activated = new Set(((logsRes.data ?? []) as { author_id: string }[]).map((r) => r.author_id));
  const firstCat = new Map<string, string>();
  for (const c of (catsRes.data ?? []) as { id: string; caretaker_id: string | null }[]) {
    if (c.caretaker_id && !firstCat.has(c.caretaker_id)) firstCat.set(c.caretaker_id, c.id);
  }
  const adminIds = ((adminsRes.data ?? []) as { user_id: string }[]).map((a) => a.user_id);
  if (adminIds.length === 0) return Response.json({ ok: false, error: "운영자 없음" }, { status: 500 });
  const adminSet = new Set(adminIds);
  const senderId = adminIds[0];
  const { data: senderProf } = await db.from("profiles").select("nickname, avatar_url").eq("id", senderId).maybeSingle();
  const sender = senderProf as { nickname?: string | null; avatar_url?: string | null } | null;

  // 계획 수립
  const bulk: Send[] = []; // 대조군·건너뜀 기록(발송 없음)
  const treated: { u: (typeof users)[number]; step: JourneyStep }[] = [];
  let skippedUsers = 0;
  for (const u of users) {
    if (adminSet.has(u.id) || u.admin_title === "staff" || activated.has(u.id)) { skippedUsers++; continue; }
    const p = planJourney({ userId: u.id, createdAt: u.created_at, now, done: doneBy.get(u.id) });
    if (!p.send) continue;
    if (sentToday.has(u.id)) continue; // 하루 1통 — 기록 없이 다음 실행으로
    const row = (step: string, holdout: boolean): Send => ({ user_id: u.id, journey: JOURNEY_NAME, step, channel: "none", holdout });
    for (const s of p.skipped) bulk.push(row(s, p.holdout));
    if (p.holdout) bulk.push(row(p.send, true));
    else treated.push({ u, step: p.send });
  }
  if (bulk.length) {
    const { error } = await db.from("journey_sends").upsert(bulk, { onConflict: "user_id,journey,step", ignoreDuplicates: true });
    if (error) return Response.json({ ok: false, error: "기록 실패" }, { status: 500 });
  }

  // 푸시 구독(동의자만)
  const pushIds = pushReady ? treated.filter((t) => t.u.marketing_push_enabled).map((t) => t.u.id) : [];
  const subsBy = new Map<string, Sub[]>();
  if (pushIds.length) {
    const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", pushIds);
    for (const s of (subs ?? []) as Sub[]) (subsBy.get(s.user_id) ?? subsBy.set(s.user_id, []).get(s.user_id)!).push(s);
  }

  let dm = 0, push = 0, failed = 0, dup = 0;
  for (const { u, step } of treated) {
    const subs = subsBy.get(u.id) ?? [];
    const claim: Send = { user_id: u.id, journey: JOURNEY_NAME, step, channel: subs.length ? "push" : "dm", holdout: false };
    const { data: got, error: cErr } = await db
      .from("journey_sends")
      .upsert(claim, { onConflict: "user_id,journey,step", ignoreDuplicates: true })
      .select("id");
    if (cErr) { failed++; continue; }
    if (!got || got.length === 0) { dup++; continue; } // 동시 실행이 이미 선점

    const msg = journeyMessage(step, { hasCat: firstCat.has(u.id), catId: firstCat.get(u.id) });
    const { error: dErr } = await db.from("direct_messages").insert({
      sender_id: senderId,
      sender_name: sender?.nickname ?? "도시공존 운영자",
      sender_avatar_url: sender?.avatar_url ?? null,
      receiver_id: u.id,
      receiver_name: u.nickname ?? "회원",
      body: `${msg.title}\n${msg.body}\nhttps://dosigongzon.com${msg.url}`,
    });
    if (dErr) {
      failed++;
      console.error("[journey] DM 실패:", dErr.message);
      await db.from("journey_sends").delete().eq("id", (got[0] as { id: string }).id); // 다음 실행에서 재시도
      continue;
    }
    dm++;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: msg.title, body: msg.body, url: msg.url }),
        );
        push++;
        await new Promise((r) => setTimeout(r, 80));
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 410 || code === 404) await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }

  const body = { ok: failed === 0, candidates: users.length, skippedUsers, recorded: bulk.length, dm, push, dup, failed };
  return Response.json(body, { status: failed === 0 ? 200 : 500 });
}

export const GET = POST;
