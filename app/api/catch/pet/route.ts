import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { cardLevelFromExp } from "@/lib/card-level";
import { encodeGeohash, geohashNeighbors3x3, parseGh7, GEOHASH_PRECISION } from "@/lib/catch/geohash";
import { myCatRoamFor, roamPosAt, currentDay } from "@/lib/catch/wild";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

// 쓰다듬기 — 지도에서 돌아다니는 내 냥이를 실제로 만나러 가서 쓰다듬는다
// (냥줍 app/api/cards/pet 이식, 2026-08-04 P2 — cards→catch_cards).
// 보상: EXP +5, 카드당 하루 1회(게임의 하루 = UTC 자정 = KST 09시, 로밍 물갈이와 동일).
// 위치 검증은 포획과 같은 철학 — 클라는 geohash7만 보내고, 서버가 내 냥이의
// 현재 로밍 위치(myCatRoamFor — 결정적)를 재계산해 3×3 셀 근접만 확인한다.
// 정밀 100m 게이트는 클라이언트(하버사인) 담당.
//
// 냥줍 대비 변경: photo_url 필터 제거(city 포획 카드는 종 아트가 기본이라 사진이 없다),
// mood_at 케어 연동 제거(TODO(P4): 케어 이식 시 복원), 퀘스트 훅 제거(TODO(P3)).

const PET_EXP = 5;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    if (!rateLimit(`catch-pet:${user.id}`, { max: 20, windowMs: 60_000 })) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const { card_id, gh7 } = await request.json().catch(() => ({})) as { card_id?: string; gh7?: string };
    if (typeof card_id !== "string" || !card_id) {
      return NextResponse.json({ error: "card_id가 필요해요." }, { status: 400 });
    }
    const freshGh = parseGh7(gh7);
    if (!freshGh) {
      return NextResponse.json({ error: "위치를 확인할 수 없어요. GPS를 켜고 다시 시도해주세요." }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: card, error } = await svc.from("catch_cards")
      .select("id, card_name, caught_geohash7, card_exp, card_level, last_petted_at")
      .eq("id", card_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) {
      // 테이블/last_petted_at 마이그레이션 전 — 쿨다운을 보장할 수 없으므로 파밍 방지 차원에서 거절
      reportError("catch-pet:select", error);
      return NextResponse.json({ error: "쓰다듬기 준비 중이에요. (box/supabase_catch_cards_migration.sql 실행 필요)" }, { status: 503 });
    }
    if (!card) return NextResponse.json({ error: "내 냥이 카드를 찾을 수 없어요." }, { status: 404 });
    if (!card.caught_geohash7) return NextResponse.json({ error: "이 냥이는 아직 지도를 돌아다니지 않아요." }, { status: 400 });

    // 하루 1회 — 로밍 물갈이와 같은 날 경계(UTC 자정 = KST 09시)
    const today = currentDay();
    const todayStartIso = new Date(today * 86_400_000).toISOString();
    if (card.last_petted_at && currentDay(new Date(card.last_petted_at as string).getTime()) === today) {
      return NextResponse.json({ already: true, card_name: card.card_name });
    }

    // 위치 검증 — 내 냥이의 현재 로밍 위치를 서버가 결정적으로 재계산해 3×3 셀 대조.
    // 미니게임이 없어 접근 시간 보정(90초 창)은 불필요 — 현재 시점 한 번이면 충분.
    const track = myCatRoamFor(card.id as string, card.caught_geohash7 as string);
    if (!track) return NextResponse.json({ error: "냥이 위치를 계산할 수 없어요." }, { status: 400 });
    const pos = roamPosAt(track);
    const catCell = encodeGeohash(pos.lat, pos.lng, GEOHASH_PRECISION);
    if (!geohashNeighbors3x3(catCell).includes(freshGh)) {
      return NextResponse.json({ error: "냥이가 있는 곳에서 너무 멀어요. 가까이 가서 쓰다듬어주세요!" }, { status: 400 });
    }

    // [냥줍 M1 보안패치 계승] 하루 1회 게이트를 조건부 UPDATE(CAS)로 원자화 —
    // last_petted_at이 오늘 경계 이전(또는 null)일 때만 갱신되므로 동시 N발 중 정확히
    // 하나만 rowcount 1을 얻는다(read-then-write EXP 파밍 차단).
    const newExp = ((card.card_exp as number) ?? 0) + PET_EXP;
    const newLevel = cardLevelFromExp(newExp);
    const { data: petted, error: upErr } = await svc.from("catch_cards").update({
      card_exp: newExp,
      card_level: newLevel,
      last_petted_at: new Date().toISOString(),
    }).eq("id", card.id)
      .or(`last_petted_at.is.null,last_petted_at.lt.${todayStartIso}`)
      .select("id");
    if (upErr) {
      reportError("catch-pet:update", upErr);
      return NextResponse.json({ error: "쓰다듬기 기록에 실패했어요." }, { status: 500 });
    }
    // 갱신된 행이 없으면 = 동시 요청이 먼저 오늘 쓰다듬기를 가져감 → 보상 없이 already 응답.
    if (!petted || petted.length === 0) {
      return NextResponse.json({ already: true, card_name: card.card_name });
    }

    // TODO(P3): quest hook — 냥줍 applyQuestEvent({ type: "pet" }) 자리.

    return NextResponse.json({
      ok: true,
      card_name: card.card_name,
      exp_gained: PET_EXP,
      leveled_up: newLevel > ((card.card_level as number) ?? 1),
      new_level: newLevel,
    });
  } catch (e) {
    reportError("catch-pet", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
