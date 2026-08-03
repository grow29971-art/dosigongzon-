import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  resolveRoamById, roamCatNearCell, EVENT_BONUS_EXP, EVENT_SHINY_RATE, WED_BONUS_EXP,
} from "@/lib/catch/wild";
import { geohashCenter, haversineMeters, parseGh7 } from "@/lib/catch/geohash";
import { generateBattleStats, RARITY_UPGRADE_TARGET } from "@/lib/battle-config";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

export const maxDuration = 30;

// 야생냥이 포획 → catch_cards insert (냥줍 app/api/roam/capture 이식, 2026-08-04 P2).
// 클라이언트는 roamId와 마스킹된 gh7만 보낸다. 종·희귀도·현재 위치는 서버가
// lib/catch/wild.ts로 재계산하므로(결정적 생성+이동) 요청 본문을 조작해도 위조할 수 없다.
// 중복 포획은 catch_cards(owner_id, spawn_id) unique 인덱스가 최종 방어선.
//
// [위치정보 불변식 — lib/geo.ts 무신고 구성] 원시 GPS 좌표(lat/lng)는 받지 않는다.
// 클라이언트가 ≈150m로 마스킹한 geohash7 셀만 수신하고, 정밀 100m 근접 판정은
// 클라이언트 하버사인이 담당한다. 서버는 "그 셀 근처에 그 냥이가 실존했는가"만
// 결정적 재계산으로 대조한다(냥줍 gh7 생략 우회 사건 교훈 — gh7은 필수값).

interface CaptureBody {
  roamId?: string;
  gh7?: string;
  isPerfect?: boolean;
}

// 카드 성격 스탯(cuteness 등)은 전투에 영향 없는 표시용 — 등급이 높을수록 하한만 올라감.
function rollCardStats(rarity: string) {
  const floor = { common: 10, uncommon: 25, rare: 40, legendary: 55 }[rarity] ?? 10;
  const roll = () => floor + Math.floor(Math.random() * (95 - floor));
  return { cuteness: roll(), wildness: roll(), sociability: roll(), mysteriousness: roll() };
}

// 완벽 포획 — 냥줍 정책 유지: 한 단계 등급 승급 확률 20% (+보너스 EXP 20)
const PERFECT_UPGRADE_CHANCE = 0.2;

// 마이그레이션(box/supabase_catch_cards_migration.sql) 미실행 환경 감지 —
// 테이블/컬럼 부재는 보상이 걸린 경로라 폴백 없이 안전 거절한다.
function isMissingSchema(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .* does not exist|column/i.test(err.message ?? "");
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    // 인메모리 레이트리밋 — 유저당 20회/분 (DB 카운트 가드보다 싼 1차 방어)
    if (!rateLimit(`catch-capture:${user.id}`, { max: 20, windowMs: 60_000 })) {
      return NextResponse.json({ error: "너무 빨라요! 잠시 쉬었다가 다시 잡아주세요." }, { status: 429 });
    }

    let body: CaptureBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    const { roamId } = body;
    const gh7 = parseGh7(body.gh7);
    if (typeof roamId !== "string" || !gh7) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    // 1) 냥이 재계산 — 오늘 실존하는 개체인지 (냥줍 튜토리얼 냥이는 city 이식에서 제외)
    const cat = resolveRoamById(roamId);
    if (!cat) {
      return NextResponse.json({ error: "이미 떠나버린 냥이예요. 다른 아이를 찾아보세요!" }, { status: 410 });
    }

    // 2) 셀 근접 검증 — 최근 90초 내 냥이가 유저 셀(3×3 이웃) 안에 실존했는지
    if (!roamCatNearCell(cat, gh7)) {
      return NextResponse.json({ error: "너무 멀리 있어요. 조금 더 가까이 가주세요!" }, { status: 403 });
    }

    const svc = createServiceClient();

    // ── 치트 방어 (프로덕션만 — 개발 시뮬레이션 테스트를 막지 않기 위해) ──
    if (process.env.NODE_ENV === "production") {
      // 1) DB 카운트 레이트리밋: 10분당 15마리 — 정상 플레이(이동+미니게임)로는 도달 불가
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count: recentCount, error: countErr } = await svc
        .from("catch_cards").select("id", { count: "exact", head: true })
        .eq("owner_id", user.id).gte("caught_at", tenMinAgo);
      if (countErr && isMissingSchema(countErr)) {
        return NextResponse.json({ error: "포획 기능 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
      }
      if ((recentCount ?? 0) >= 15) {
        return NextResponse.json({ error: "너무 빨라요! 잠시 쉬었다가 다시 잡아주세요." }, { status: 429 });
      }
      // 2) 순간이동 감지 — 정밀 좌표가 없으므로 geohash7 셀 중심 간 거리로 근사(±150m 오차 허용).
      // 최근 15분 내 연속 포획에만 적용 — 오래된 기록과 비교하면 정상 유저 오탐(냥줍 2026-07-11 장애).
      const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data: lastCard } = await svc
        .from("catch_cards").select("caught_geohash7, caught_at")
        .eq("owner_id", user.id).not("caught_geohash7", "is", null)
        .gte("caught_at", fifteenMinAgo)
        .order("caught_at", { ascending: false }).limit(1).maybeSingle();
      if (lastCard?.caught_geohash7) {
        const prev = geohashCenter(lastCard.caught_geohash7 as string);
        if (prev) {
          const cur = geohashCenter(gh7)!;
          const elapsedSec = Math.max(1, (Date.now() - new Date(lastCard.caught_at as string).getTime()) / 1000);
          const movedM = Math.max(0, haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng) - 300);
          if (movedM / elapsedSec > 40) {
            return NextResponse.json({ error: "이동 속도가 비정상적으로 빨라요. 잠시 후 다시 시도해주세요." }, { status: 403 });
          }
        }
      }
    }

    const isPerfect = body.isPerfect === true;
    // 🎉 이벤트 개체 — resolveRoamById가 시간대(주말/수요일 밤 KST)까지 검증한 뒤이므로 id만 보면 된다
    const isEvent = roamId.startsWith("event:");
    const isWed = roamId.startsWith("wed:");
    const { species } = cat;

    // 완벽 포획 승급 롤 — 서버 판정이라 위조 불가. 스탯은 최종 등급 기준으로 굴린다.
    const finalRarity = isPerfect && Math.random() < PERFECT_UPGRADE_CHANCE
      ? (RARITY_UPGRADE_TARGET[species.rarity] ?? species.rarity)
      : species.rarity;
    const wasUpgraded = finalRarity !== species.rarity;
    const battle = generateBattleStats(finalRarity);

    const { data: card, error: insertError } = await svc
      .from("catch_cards")
      .insert({
        owner_id: user.id,
        species_key: species.key,
        spawn_id: cat.id,
        card_name: species.name,
        card_rarity: finalRarity,
        card_traits: species.traits,
        card_stats: rollCardStats(finalRarity),
        card_exp: (isPerfect ? 20 : 0) + (isEvent ? EVENT_BONUS_EXP : 0) + (isWed ? WED_BONUS_EXP : 0),
        caught_geohash7: gh7,
        // ✨ 반짝이 — 기본 1%, 이벤트 냥이는 3% (서버 판정이라 위조 불가)
        is_shiny: Math.random() < (isEvent ? EVENT_SHINY_RATE : 0.01),
        ...battle,
      })
      .select()
      .single();

    if (insertError) {
      // 23505 = unique_violation → 같은 냥이 재포획 시도
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "이미 포획한 냥이예요!" }, { status: 409 });
      }
      // 마이그레이션 전 — 보상이 걸린 기록이라 폴백 없이 안전 거절
      if (isMissingSchema(insertError)) {
        return NextResponse.json({ error: "포획 기능 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
      }
      reportError("catch-capture:insert", insertError, { roamId, userId: user.id });
      return NextResponse.json({ error: "포획 기록에 실패했어요. 다시 시도해주세요." }, { status: 500 });
    }

    // TODO(P3): quest hook — 냥줍 applyQuestEvent(capture)·partner-perk 동반 EXP는
    // 도감·퀘스트 단계에서 city 구조에 맞게 재연결한다.

    return NextResponse.json({ card, isPerfect, was_upgraded: wasUpgraded, is_event: isEvent });
  } catch (e) {
    reportError("catch-capture", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
