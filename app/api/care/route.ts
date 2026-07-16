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
  fullnessAt, moodAt, cleanlinessAt, poopCount, gaugeTs, currentCareDay,
  FEED_LIMIT_PER_DAY, FEED_FULLNESS_GAIN, FEED_MOOD_GAIN, FEED_EXP,
  FULLNESS_DECAY_HOURS, MOOD_DECAY_HOURS, CLEANLINESS_DECAY_HOURS,
  FEED_FULL_BLOCK, PLAY_MOOD_GAIN, CLEAN_MOOD_GAIN,
} from "@/lib/care";
import { rateLimit } from "@/lib/rate-limit";

import { cardLevelFromExp as computeLevel } from "@/lib/card-level";

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
  cleaned_at?: string | null; // 마이그레이션 전이면 컬럼 없음(undefined)
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
  if (!target_id || !action || !["feed", "pet", "use_item", "clean", "play"].includes(action)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const svc = createServiceClient();
  // cleaned_at은 별도 마이그레이션이라 있을 수도 없을 수도 있음 — 우선 cleaned_at 포함해
  // 시도하고, 그 컬럼만 없으면(42703) 청결 없이 재조회한다. fed_at 등 기본 케어 컬럼
  // 자체가 없으면(care 마이그레이션 전) 503으로 안전 거절.
  let cleanedSupported = true;
  let cat: CareCatRow | null = null;
  {
    const withClean = await svc
      .from("cats")
      .select("id, caretaker_id, card_exp, card_level, fed_at, mood_at, fed_day, fed_today, pet_day, cleaned_at")
      .eq("id", target_id).maybeSingle();
    if (withClean.error?.code === "42703") {
      cleanedSupported = false;
      const base = await svc
        .from("cats")
        .select("id, caretaker_id, card_exp, card_level, fed_at, mood_at, fed_day, fed_today, pet_day")
        .eq("id", target_id).maybeSingle();
      if (base.error?.code === "42703") return NextResponse.json({ error: "not_ready" }, { status: 503 });
      if (base.error || !base.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
      cat = base.data as CareCatRow;
    } else if (withClean.error) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    } else if (!withClean.data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    } else {
      cat = withClean.data as CareCatRow;
    }
  }
  // 청소는 cleaned_at 컬럼이 있어야 가능
  if (action === "clean" && !cleanedSupported) {
    return NextResponse.json({ error: "not_ready" }, { status: 503 });
  }
  const row = cat;
  if (row.caretaker_id !== user.id) {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  const now = Date.now();
  const today = currentCareDay(now);
  const fullness = fullnessAt(row.fed_at, now);
  const mood = moodAt(row.mood_at, now);
  // 청결: 컬럼 미지원 환경에선 100(항상 깨끗)으로 취급 — 청소 UI가 안 뜰 뿐
  const cleanliness = cleanedSupported ? cleanlinessAt(row.cleaned_at ?? null, now) : 100;
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

    // 낙관적 동시성 가드 — 읽은 시점의 fed_day/fed_today와 여전히 일치할 때만 갱신.
    // 동시 밥주기 요청이 둘 다 fedToday를 읽고 통과해도, 늦게 도착한 쪽은 이 조건이
    // 어긋나 0행 갱신 → 일일 한도(3회) 초과 지급 차단.
    let feedUpdate = svc.from("cats").update({
      // ⚠️ fed_at = now 로 저장하면 항상 100이 되어 +38이 무의미 — 반드시 역산값 저장
      fed_at: gaugeTs(newFullness, FULLNESS_DECAY_HOURS, now),
      mood_at: gaugeTs(newMood, MOOD_DECAY_HOURS, now),
      fed_day: today,
      fed_today: fedToday + 1,
      card_exp: newExp,
      card_level: newLevel,
    }).eq("id", row.id);
    feedUpdate = fedToday === 0
      ? feedUpdate.or(`fed_day.is.null,fed_day.neq.${today}`) // 오늘 첫 밥: 아직 today로 안 바뀐 행만
      : feedUpdate.eq("fed_day", today).eq("fed_today", fedToday); // 2·3번째: 카운터 그대로일 때만
    const { data: feedRows, error } = await feedUpdate.select("id");
    if (error) {
      console.error("[care] feed update failed:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
    if (!feedRows || feedRows.length === 0) {
      // 동시 요청이 먼저 반영됨 — 한도 초과로 처리
      return NextResponse.json({ error: "daily_limit" }, { status: 429 });
    }
    return NextResponse.json({
      ok: true, fullness: newFullness, mood: newMood, cleanliness,
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
      ok: true, fullness, mood: 100, cleanliness,
      fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
      exp_gained: 0, leveled_up: false, new_level: level,
    });
  }

  // ── 치워주기 (청결 100, 기분 소폭) — 한도 없음, EXP·코인 없음(파밍 불가) ──
  if (action === "clean") {
    const newMood = Math.min(100, mood + CLEAN_MOOD_GAIN);
    const { error } = await svc.from("cats").update({
      cleaned_at: new Date(now).toISOString(), // 청결 만점
      mood_at: gaugeTs(newMood, MOOD_DECAY_HOURS, now),
    }).eq("id", row.id);
    if (error) {
      console.error("[care] clean update failed:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true, fullness, mood: newMood, cleanliness: 100,
      fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
      exp_gained: 0, leveled_up: false, new_level: level,
    });
  }

  // ── 놀아주기 (기분 회복) — 한도 없음, EXP·코인 없음(게이지만 움직여 파밍 불가) ──
  if (action === "play") {
    const newMood = Math.min(100, mood + PLAY_MOOD_GAIN);
    const { error } = await svc.from("cats").update({
      mood_at: gaugeTs(newMood, MOOD_DECAY_HOURS, now),
    }).eq("id", row.id);
    if (error) {
      console.error("[care] play update failed:", error);
      return NextResponse.json({ error: "update_failed" }, { status: 502 });
    }
    return NextResponse.json({
      ok: true, fullness, mood: newMood, cleanliness,
      fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
      exp_gained: 0, leveled_up: false, new_level: level,
    });
  }

  // ── 케어 아이템 사용 (일일 한도 없음 — 돈 주고 산 것) ──
  const item = SHOP_ITEMS[body.item_key as ShopItemKey];
  if (!item?.care) {
    return NextResponse.json({ error: "not_care_item" }, { status: 400 });
  }
  // 원자적 소모 — DB에서 조건부 증분 후 남은 수량 반환. 동시 요청이 같은 재고를
  // 두 번 쓰던 레이스 차단. RPC 미배포(42883) 시 기존 read-modify-write 폴백.
  let itemRemaining: number;
  const { data: rpcRemaining, error: consumeErr } = await svc.rpc("consume_user_item", {
    p_user_id: user.id, p_item_key: item.key,
  });
  if (!consumeErr && typeof rpcRemaining === "number") {
    if (rpcRemaining < 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    itemRemaining = rpcRemaining;
  } else {
    console.warn("[care] ⚠️ consume_user_item RPC 미배포/오류 — 비원자 폴백 실행. 마이그레이션 확인 필요.");
    const { data: inv } = await svc
      .from("user_items").select("quantity")
      .eq("user_id", user.id).eq("item_key", item.key).maybeSingle();
    const qty = (inv as { quantity: number } | null)?.quantity ?? 0;
    if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    await svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date(now).toISOString() })
      .eq("user_id", user.id).eq("item_key", item.key).gt("quantity", 0);
    itemRemaining = qty - 1;
  }

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
    // 아이템은 이미 차감됐는데 효과 적용이 실패 — 유료 간식이 증발하지 않게 되돌린다.
    // 에러 경로라 드물고, 되돌림 자체가 또 실패하면 로그만(수동 보정).
    const { error: refundErr } = await svc.from("user_items")
      .update({ quantity: itemRemaining + 1, updated_at: new Date(now).toISOString() })
      .eq("user_id", user.id).eq("item_key", item.key);
    if (refundErr) console.error("[care] use_item refund failed (MANUAL CHECK):", refundErr, user.id, item.key);
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
  return NextResponse.json({
    ok: true, fullness: newFullness, mood: newMood, cleanliness,
    fed_today: row.fed_day === today ? (row.fed_today ?? 0) : 0, feed_limit: FEED_LIMIT_PER_DAY,
    exp_gained: item.care.exp ?? 0, leveled_up: newLevel > level, new_level: newLevel,
    item_remaining: itemRemaining,
  });
}
