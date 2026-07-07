import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

// KST 날짜 문자열 "YYYY-MM-DD" — streak-reminder 등 다른 cron과 동일한 방식
function kstToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

const TASK_CARE_TYPE: Record<string, { care_type: string; note: string }> = {
  water: { care_type: "water", note: "일일 출석체크 — 물 갈아줬어요" },
  feed: { care_type: "feed", note: "일일 출석체크 — 밥 줬어요" },
  clean: { care_type: "other", note: "일일 출석체크 — 화장실/집 청소했어요" },
  health: { care_type: "health", note: "일일 출석체크 — 건강 상태 확인했어요" },
};
const CHECKIN_COINS = 50;
const CHECKIN_CARD_EXP = 50;

function computeLevel(exp: number) {
  const thresholds = [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (exp >= thresholds[i]) return i + 1;
  }
  return 1;
}

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

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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

  // 체크한 항목마다 실제 돌봄일지 기록 생성 — 계정 레벨 점수·연속 돌봄 스트릭에도 자연히 반영됨
  if (targetCatId) {
    for (const key of taskKeys) {
      const t = TASK_CARE_TYPE[key];
      jobs.push(svc.from("care_logs").insert({
        cat_id: targetCatId, author_id: user.id, care_type: t.care_type, note: t.note,
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

  const newCoins = (profile.coins ?? 0) + CHECKIN_COINS;
  jobs.push(svc.from("profiles").update({ coins: newCoins, last_checkin_date: today }).eq("id", user.id));

  await Promise.all(jobs);

  return NextResponse.json({
    ok: true,
    coins_gained: CHECKIN_COINS,
    coins_total: newCoins,
    card_exp_gained: targetCatId ? CHECKIN_CARD_EXP : 0,
    card_leveled_up: cardLeveledUp,
    card_new_level: cardNewLevel,
  });
}
