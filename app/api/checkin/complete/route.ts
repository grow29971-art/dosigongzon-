import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { kstToday } from "@/lib/kst";

const TASK_CARE_TYPE: Record<string, { care_type: string; memo: string }> = {
  water: { care_type: "water", memo: "일일 출석체크 — 물 갈아줬어요" },
  feed: { care_type: "feed", memo: "일일 출석체크 — 밥 줬어요" },
  clean: { care_type: "other", memo: "일일 출석체크 — 화장실/집 청소했어요" },
  health: { care_type: "health", memo: "일일 출석체크 — 건강 상태 확인했어요" },
};
const CHECKIN_COINS = 25; // 2026-07-20 50→25 하향 — 코인 경제 전체 조정(shop-config 주석 참고)
const CHECKIN_CARD_EXP = 50;

import { cardLevelFromExp as computeLevel } from "@/lib/card-level";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { tasks } = await req.json();
  const taskKeys: string[] = Array.isArray(tasks) ? tasks.filter((t) => TASK_CARE_TYPE[t]) : [];
  if (taskKeys.length === 0) return NextResponse.json({ error: "no_tasks" }, { status: 400 });

  const today = kstToday();
  const { data: profile } = await supabase
    .from("profiles").select("coins,last_checkin_date,rep_card_cat_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  if ((profile as { last_checkin_date?: string | null }).last_checkin_date === today) {
    return NextResponse.json({ error: "already_checked_in" }, { status: 400 });
  }

  const svc = createServiceClient();

  // 원자적 선점 — 동시 요청 중 하나만 통과 (레이스로 코인 중복 수령 차단).
  // last_checkin_date를 조건부로 먼저 today로 바꾸고, 행을 못 바꾼 요청은 already 처리.
  const { data: claimedRows } = await svc
    .from("profiles")
    .update({ last_checkin_date: today })
    .eq("id", user.id)
    .or(`last_checkin_date.is.null,last_checkin_date.neq.${today}`)
    .select("id");
  if (!claimedRows || claimedRows.length === 0) {
    return NextResponse.json({ error: "already_checked_in" }, { status: 400 });
  }

  // 카드 경험치를 받을 대상 카드 — 대표 카드가 있으면 그걸로, 없으면 가장 최근 카드
  const repCardId = (profile as { rep_card_cat_id?: string | null }).rep_card_cat_id;
  let targetCatId: string | null = repCardId ?? null;
  if (!targetCatId) {
    const { data: recentCat } = await svc
      .from("cats").select("id").eq("caretaker_id", user.id).not("card_generated_at", "is", null)
      .order("card_generated_at", { ascending: false }).limit(1).maybeSingle();
    targetCatId = (recentCat as { id: string } | null)?.id ?? null;
  }

  let cardLeveledUp = false;
  let cardNewLevel: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs: PromiseLike<any>[] = [];

  // 체크한 항목마다 실제 돌봄일지 기록 생성 — 계정 레벨 점수·연속 돌봄 스트릭에도 자연히 반영됨.
  // author_name/avatar는 다른 곳(createCareLog)과 동일하게 가입 당시 스냅샷 규칙을 따름.
  if (targetCatId) {
    const meta = user.user_metadata ?? {};
    const authorName = meta.nickname ?? meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "익명";
    const authorAvatar = meta.avatar_url ?? null;
    for (const key of taskKeys) {
      const t = TASK_CARE_TYPE[key];
      jobs.push(svc.from("care_logs").insert({
        cat_id: targetCatId, author_id: user.id, author_name: authorName, author_avatar_url: authorAvatar,
        care_type: t.care_type, memo: t.memo,
      }));
    }

    const { data: cat } = await svc.from("cats").select("card_exp,card_level").eq("id", targetCatId).maybeSingle();
    if (cat) {
      const newExp = (cat.card_exp ?? 0) + CHECKIN_CARD_EXP;
      const newLevel = computeLevel(newExp);
      cardLeveledUp = newLevel > (cat.card_level ?? 1);
      cardNewLevel = newLevel;
      jobs.push(svc.from("cats").update({ card_exp: newExp, card_level: newLevel }).eq("id", targetCatId));
    }
  }

  // 코인은 DB에서 원자 증감(increment_coins) — 배틀 보상·상점 구매 등 다른 경로와
  // 동시에 코인이 바뀌어도 갱신 소실 없음. RPC 미실행 환경에선 기존 방식으로 폴백.
  let coinsTotal = (profile.coins ?? 0) + CHECKIN_COINS;
  const { data: rpcCoins, error: rpcErr } = await svc.rpc("increment_coins", {
    p_user_id: user.id, p_amount: CHECKIN_COINS,
  });
  if (rpcErr) {
    console.warn("[checkin] ⚠️ increment_coins RPC 미배포/오류 — 비원자 폴백. 마이그레이션 확인 필요.");
    jobs.push(svc.from("profiles").update({ coins: coinsTotal }).eq("id", user.id));
  } else if (typeof rpcCoins === "number") {
    coinsTotal = rpcCoins;
  }

  // 주간 출석 이력 기록 — 주간 포인트 마일스톤 집계용 (테이블 없으면 조용히 무시)
  jobs.push(
    svc.from("checkin_days").upsert({ user_id: user.id, day: today }, { onConflict: "user_id,day", ignoreDuplicates: true })
      .then((r) => { if (r.error && !r.error.message.includes("checkin_days")) console.error("[checkin] checkin_days:", r.error); return r; }),
  );

  await Promise.all(jobs);

  return NextResponse.json({
    ok: true,
    coins_gained: CHECKIN_COINS,
    coins_total: coinsTotal,
    card_exp_gained: targetCatId ? CHECKIN_CARD_EXP : 0,
    card_leveled_up: cardLeveledUp,
    card_new_level: cardNewLevel,
  });
}
