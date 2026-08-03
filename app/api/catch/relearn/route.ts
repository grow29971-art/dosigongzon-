import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { SKILL_POOL, SPECIAL_SKILLS, type SpecialSkillId } from "@/lib/battle-config";
import { reportError } from "@/lib/error-report";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";
import { rateLimit } from "@/lib/rate-limit";

// 기술 다시 배우기 — 냥줍 app/api/cards/relearn 이식 (2026-08-04 P4).
// 냥줍은 상점 아이템(skill_relearn, 60코인)을 소모했지만 city 상점엔 배틀 소모품이
// 없다 → "달성 경로 없는 죽은 기능" 방지(냥줍 2026-07-15 죽은 의뢰 감사 교훈)를 위해
// 코인 직접 차감(같은 60코인)으로 치환. 차감은 spend_catch_coins RPC(원자, 잔액 검증
// 포함 — box/supabase_catch_battle_migration.sql) 단일 경로. RPC 미배포면 503 fail-closed
// (비원자 read-modify-write 폴백은 동시요청 이중사용을 되살리므로 금지 — shop/buy 패턴).

const RELEARN_COST = 60; // route.ts는 HTTP 메서드 외 export 금지 — 상수는 파일 내부에만

const SLOT_COLUMNS = ["battle_special", "battle_special2", "battle_special3", "battle_special4"] as const;

export async function POST(req: Request) {
  try {
    if (!CATCH_BATTLE_ENABLED) return NextResponse.json({ error: "지금은 사용할 수 없어요." }, { status: 503 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    if (!rateLimit(`catch-relearn:${user.id}`, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    let body: { card_id?: unknown; slot?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    const { card_id, slot } = body;
    if (typeof card_id !== "string" || typeof slot !== "number" || slot < 1 || slot > 4) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    const svc = createServiceClient();

    const { data: card } = await svc
      .from("catch_cards")
      .select("id,card_rarity,battle_special,battle_special2,battle_special3,battle_special4")
      .eq("id", card_id).eq("owner_id", user.id).maybeSingle();
    if (!card) return NextResponse.json({ error: "카드를 찾을 수 없어요." }, { status: 404 });

    // 같은 등급 풀에서 현재 4개에 없는 스킬 추첨
    const current = [card.battle_special, card.battle_special2, card.battle_special3, card.battle_special4];
    const pool = (SKILL_POOL[card.card_rarity ?? "common"] ?? SKILL_POOL.common)
      .filter(s => !current.includes(s));
    if (pool.length === 0) {
      return NextResponse.json({ error: "이 등급에서 더 배울 수 있는 새 기술이 없어요." }, { status: 400 });
    }
    const newSkill = pool[Math.floor(Math.random() * pool.length)] as SpecialSkillId;
    const column = SLOT_COLUMNS[slot - 1];

    // 코인 차감(원자, 잔액 검증) → 성공한 경우에만 스킬 교체.
    // RPC 반환: 차감 후 잔액(int) / NULL = 잔액 부족(또는 프로필 없음).
    const { data: spent, error: spendErr } = await svc.rpc("spend_catch_coins", {
      p_user_id: user.id, p_amount: RELEARN_COST,
    });
    if (spendErr) {
      if (["42883", "PGRST202"].includes((spendErr as { code?: string }).code ?? "")) {
        return NextResponse.json(
          { error: "준비 중이에요. (box/supabase_catch_battle_migration.sql 실행 필요)" },
          { status: 503 },
        );
      }
      throw spendErr;
    }
    if (typeof spent !== "number") {
      return NextResponse.json({ error: `코인이 부족해요. (기술 재배정 ${RELEARN_COST}코인)` }, { status: 400 });
    }

    const { error: cardErr } = await svc.from("catch_cards").update({ [column]: newSkill }).eq("id", card.id);
    if (cardErr) {
      // 스킬 교체 실패 시 차감분 환불 — 코인만 사라지는 최악을 막는다.
      await svc.rpc("increment_coins", { p_user_id: user.id, p_amount: RELEARN_COST });
      throw cardErr;
    }

    const info = SPECIAL_SKILLS[newSkill];
    return NextResponse.json({
      ok: true, slot, new_skill: newSkill,
      new_skill_name: info?.name ?? newSkill, new_skill_icon: info?.icon ?? "✨", new_skill_desc: info?.desc ?? "",
      coins_total: spent,
    });
  } catch (e) {
    reportError("catch-relearn", e);
    return NextResponse.json({ error: "재배정에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }
}
