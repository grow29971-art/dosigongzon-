import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { resolveChestById, chestNearCell, rollChestReward, CHEST_DAILY_CAP } from "@/lib/catch/chest";
import { parseGh7 } from "@/lib/catch/geohash";
import { currentDay } from "@/lib/catch/wild";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

export const maxDuration = 15;

// 📦 골판지 상자 열기 (냥줍 app/api/chest/open 이식, 2026-08-04 P2 — lib/catch/chest.ts 참조).
// 클라이언트는 chestId와 마스킹된 gh7만 보낸다 — 상자 실존·위치는 서버가 시드 재계산으로
// 검증하고(위조 불가), 보상도 서버 전용 salt 시드로 결정하므로 클라가 미리 알 수 없다.
//
// [냥줍 C2·C3 보안패치 계승] open_catch_chest RPC가 (user_id, chest_id) PK +
// 유저별 advisory lock으로 "중복검사 + 일일 캡 + INSERT"를 한 트랜잭션에서 원자 판정
// → 같은 상자 N중 열기·캡 우회가 원천 차단된다. 코인은 'ok'일 때만 increment_coins
// 원자 증분으로 지급(절대값 쓰기 금지 — city 코인 불변식과 동일).
// (마이그레이션: box/supabase_catch_cards_migration.sql — 미적용 시 503 안전 거절)
//
// 냥줍 대비 변경: 깃털(파트너 냥이 EXP) 보상은 city에 파트너 개념이 아직 없어
// 동전 +10으로 대체 지급한다. TODO(P4): 파트너/동거냥 이식 시 깃털 복원.

interface OpenBody {
  chestId?: string;
  gh7?: string;
}

const REWARD_MESSAGES = {
  miss: "텅 비었어요... 고양이 발자국만 남아있네요",
  coins10: "상자 안에 동전이 숨어있었어요! +10냥",
  coins25: "두둑한 동전 주머니 발견! +25냥",
  jackpot: "금빛 츄르 상자!! +77냥",
} as const;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    if (!rateLimit(`catch-chest:${user.id}`, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    let body: OpenBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }
    const { chestId } = body;
    const gh7 = parseGh7(body.gh7);
    if (typeof chestId !== "string" || !gh7) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    // 1) 상자 재계산 — 오늘 실존하는 상자인지 (자정 5분 유예)
    const chest = resolveChestById(chestId);
    if (!chest) {
      return NextResponse.json({ error: "상자가 사라졌어요. 내일 새 자리에 나타나요!" }, { status: 410 });
    }
    // 2) 셀 근접 검증 — 상자 셀이 유저 gh7의 3×3 이웃 안인지
    if (!chestNearCell(chest, gh7)) {
      return NextResponse.json({ error: "상자가 너무 멀리 있어요. 조금 더 가까이 가주세요!" }, { status: 403 });
    }

    const svc = createServiceClient();

    // 3) 열기 원자 판정 — chest_day는 id에 박힌 UTC 일(세대), 캡은 그 세대당 CHEST_DAILY_CAP개.
    const chestDay = currentDay();
    const gate = await svc.rpc("open_catch_chest", {
      p_user: user.id, p_chest: chestId, p_day: chestDay, p_cap: CHEST_DAILY_CAP,
    });
    if (gate.error) {
      // RPC 미배포(마이그레이션 전) → 보상이 걸린 보안 게이트라 폴백 없이 안전 거절.
      if (["42883", "PGRST202"].includes((gate.error as { code?: string }).code ?? "")) {
        return NextResponse.json({ error: "상자 기능 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
      }
      reportError("catch-chest:gate", gate.error, { chestId, userId: user.id });
      return NextResponse.json({ error: "상자를 여는 데 실패했어요. 다시 시도해주세요." }, { status: 500 });
    }
    if (gate.data === "dup") {
      return NextResponse.json({ error: "이미 연 상자예요!" }, { status: 409 });
    }
    if (gate.data === "cap") {
      return NextResponse.json({ error: "오늘은 상자를 충분히 주웠어요. 내일 또 열어봐요!" }, { status: 429 });
    }

    // 여기 도달 = gate 'ok' (이 chestId에 대해 이 유저의 유일한 실행) → 보상 지급.
    // 보상 롤 — 서비스 롤 키 salt로 클라 예측 차단 + 재시도 멱등
    let reward = rollChestReward(
      `chestreward:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${user.id}:${chestId}`,
    );
    // 깃털 → 파트너 부재로 동전 대체 (빈손 방지, 냥줍의 무파트너 폴백과 동일 EV)
    if (reward.kind === "feather") reward = { kind: "coins", coins: 10 };

    const coinGain = reward.kind === "coins" || reward.kind === "jackpot" ? reward.coins : 0;
    if (coinGain > 0) {
      // 원자 증분 RPC만 사용 — read-modify-write 폴백 금지(city 코인 불변식).
      // gate가 단일 실행을 보장하므로 이 지급은 chestId당 정확히 1회.
      const rpc = await svc.rpc("increment_coins", { p_user_id: user.id, p_amount: coinGain });
      if (rpc.error) {
        reportError("catch-chest:grant", rpc.error, { userId: user.id });
        return NextResponse.json({ error: "보상 지급에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
      }
    }

    const message =
      reward.kind === "miss" ? REWARD_MESSAGES.miss
      : reward.kind === "jackpot" ? REWARD_MESSAGES.jackpot
      : coinGain === 25 ? REWARD_MESSAGES.coins25 : REWARD_MESSAGES.coins10;

    return NextResponse.json({ ok: true, kind: reward.kind, coins: coinGain, message });
  } catch (e) {
    reportError("catch-chest", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
