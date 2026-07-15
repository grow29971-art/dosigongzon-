// ══════════════════════════════════════════
// 다마고치 케어 API — POST /api/care { target_id, action: "feed" | "pet" | "use_item", item_key? }
// 대상: 내가 등록한 고양이(대표묘). 소유권 검증 후 service_role로 쓰기.
// 게이지는 저장하지 않는다 — lib/care.ts의 gaugeTs 역산 타임스탬프만 기록 (lazy decay).
// 마이그레이션 전(컬럼 없음 42703)엔 503 not_ready로 안전 거절.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";
import {
  fullnessAt, moodAt, gaugeTs, currentCareDay,
  FEED_LIMIT_PER_DAY, FEED_FULLNESS_GAIN, FEED_MOOD_GAIN, FEED_EXP,
  FULLNESS_DECAY_HOURS, MOOD_DECAY_HOURS, FEED_FULL_BLOCK,
} from "@/lib/care";
import { rateLimit } from "@/lib/rate-limit";

// 카드 레벨 커브 — checkin/battle과 동일 thresholds (Lv1~10)
function computeLevel(exp: number) {
  const thresholds = [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (exp >= thresholds[i]) return i + 1;
  }
  return 1;
}

interface CareCatRow {
  id: string;
  caretaker_id: string | null;
  card_exp: number | null;
  card_level: number | null;
  fed_at: string | null;
  mood_at: string | null;
  fed_day: number | null;
  fed_today: number | null;
  pet_day: number | null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!rateLimit(`care:${user.id}`, { max: 30, windowMs: 60_000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { target_id?: string; action?: string; item_key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { target_id, action } = body;
  if (!target_id || !action || !["feed", "pet", "use_item"].includes(action)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: cat, error: catError } = await svc
    .from("cats")
    .select("id, caretaker_id, card_exp, card_level, fed_at, mood_at, fed_day, fed_today, pet_day")
    .eq("id", target_id)
    .maybeSingle();

  // 마이그레이션 전 안전 거절 — 배포 순서가 꼬여도 안 죽는다
  if (catError?.code === "42703") {
    return NextResponse.json({ error: "not_ready" }, { status: 503 });
  }
  if (catError || !cat) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = cat as CareCatRow;
  if (row.caretaker_id !== user.id) {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  const now = Date.now();
  const today = currentCareDay(now);
  const fullness = fullnessAt(row.fed_at, now);
  const mood = moodAt(row.mood_at, now);
  const exp = row.card_exp ?? 0;
  const level = row.card_level ?? 1;

  // ── 밥 주기 ──
  if (action === "feed") {
    const fedToday = row.fed_day === today ? (row.fed_today ?? 0) : 0;
    if (fedToday >= FEED_LIMIT_PER_DAY) {
      return NextResponse.json({ error: "daily_limit" }, { status: 429 });
    }
    if (fullness >= FEED_FULL_BLOCK) {
      // 이미 배부른 애한테 억지로 먹이지 않는다
      return NextResponse.json({ error: "full" }, { status: 409 });
    }
    const newFullness = Math.min(100, fullness + FEED_FULLNESS_GAIN);
    const newMood = Math.min(100, mood + FEED_MOOD_GAIN);
    const newExp = exp + FEED_EXP;
    const newLevel = computeLevel(newExp);

    const { error } = await svc.from("cats").update({
      // ⚠️ fed_at = now 로 저장하면 항상 100이 되어 +38이 무의미 — 반드시 역산값 저장
      fed_at: gaugeTs(newFullness, FULLNESS_DECAY_HOURS, now),
      mood_at: gaugeTs(newMood, MOOD_DECAY_HOURS, now),
      fed_day: today,
      fed_today: fedToday + 1,
      card_exp: newExp,
      card_level: newLevel,
    }).eq("id", row.id);
    if (error) {
      console.error("[care] feed update failed:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true, fullness: newFullness, mood: newMood,
      fed_today: fedToday + 1, feed_limit: FEED_LIMIT_PER_DAY,
      exp_gained: FEED_EXP, leveled_up: newLevel > level, new_level: newLevel,
    });
  }

  // ── 쓰다듬기 (하루 1회, 기분 만점) ──
  if (action === "pet") {
    // ⚠️ 게이트는 반드시 pet_day 전용 컬럼 — mood_at 날짜 판정은 급여의 기분 회복과
    //    상호작용해 오차단하는 버그가 있다 (냥줍에서 실제 발생)
    if (row.pet_day === today) {
      return NextResponse.json({ error: "daily_limit" }, { status: 429 });
    }
    const { error } = await svc.from("cats").update({
      mood_at: new Date(now).toISOString(), // 기분 만점
      pet_day: today,
    }).eq("id", row.id);
    if (error) {
      console.error("[care] pet update failed:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
    // EXP는 지도에서 실물 쓰다듬기(상위 보상)에 양보 — 여기선 0
    return NextResponse.json({
      ok: true, fullness, mood: 100,
      fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
      exp_gained: 0, leveled_up: false, new_level: level,
    });
  }

  // ── 케어 아이템 사용 (일일 한도 없음 — 돈 주고 산 것) ──
  const item = SHOP_ITEMS[body.item_key as ShopItemKey];
  if (!item?.care) {
    return NextResponse.json({ error: "not_care_item" }, { status: 400 });
  }
  const { data: inv } = await svc
    .from("user_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("item_key", item.key)
    .maybeSingle();
  const qty = (inv as { quantity: number } | null)?.quantity ?? 0;
  if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });

  // 수량 차감 (use-item 라우트와 동일한 gt 가드 방식)
  await svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date(now).toISOString() })
    .eq("user_id", user.id).eq("item_key", item.key).gt("quantity", 0);

  const newFullness = Math.min(100, fullness + (item.care.fullness ?? 0));
  const newMood = Math.min(100, mood + (item.care.mood ?? 0));
  const newExp = exp + (item.care.exp ?? 0);
  const newLevel = computeLevel(newExp);

  const { error } = await svc.from("cats").update({
    fed_at: gaugeTs(newFullness, FULLNESS_DECAY_HOURS, now),
    mood_at: gaugeTs(newMood, MOOD_DECAY_HOURS, now),
    card_exp: newExp,
    card_level: newLevel,
  }).eq("id", row.id);
  if (error) {
    console.error("[care] use_item update failed:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
  return NextResponse.json({
    ok: true, fullness: newFullness, mood: newMood,
    fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
    exp_gained: item.care.exp ?? 0, leveled_up: newLevel > level, new_level: newLevel,
    item_remaining: qty - 1,
  });
}
