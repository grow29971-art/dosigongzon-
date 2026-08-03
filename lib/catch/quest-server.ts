// 주간 의뢰 서버 판정·지급 훅 — 냥줍 lib/quest-server.ts 이식 (2026-08-04 P3).
// 보상 라우트(app/api/catch/capture · pet)가 본 로직 성공 직후 호출한다.
// catch_profiles.quest_week로 주당 1회 지급을 보장하고, 테이블 마이그레이션 전이거나
// 조회가 실패하면 조용히 생략한다(의뢰는 부가 기능 — 절대 본 라우트의 성공 응답을
// 막지 않는다).
//
// [냥줍 H2 보안패치 2026-07-31 계승] quest_week 갱신 UPDATE 자체가 유일한 원자
// 게이트(CAS): 예전 값과 일치할 때만 갱신되므로 동시 이벤트 N발 중 정확히 하나만
// rowcount 1을 얻고, 그 하나만 코인을 받는다. 코인은 increment_coins RPC(원자 증분)
// 단일 경로 — 절대값 덮어쓰기 금지(city 코인 불변식).
//
// ⚠️ 서버 전용 — service_role 클라이언트를 받으므로 클라이언트 코드에서 import 금지.

import "server-only";
import {
  currentQuest, currentWeekKey, isQuestDoneThisWeek, questProgressCount,
  encodeQuestProgress, QUEST_REWARD_COINS, type QuestEvent,
} from "./quests";
import type { createServiceClient } from "@/lib/supabase/service";

export interface QuestDone {
  title: string;
  reward: number;
}

/**
 * 이벤트가 이번 주 의뢰에 해당하면 진행도를 올리고, 목표 도달 시 코인 지급 + 주차 키 기록.
 * @returns 이번 호출로 의뢰가 "완료"됐을 때만 QuestDone, 그 외(무관/진행 중/이미 완료/오류)는 null
 */
export async function applyQuestEvent(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
  event: QuestEvent,
): Promise<QuestDone | null> {
  try {
    const quest = currentQuest();
    if (!quest.matches(event)) return null;

    const weekKey = currentWeekKey();
    const { data: prof, error } = await svc.from("catch_profiles")
      .select("quest_week").eq("user_id", userId).maybeSingle();
    // catch_profiles 마이그레이션 전이면 error — 조용히 생략 (부가 기능 패턴)
    if (error) return null;
    if (!prof) {
      // lazy 행 생성 — 가입 트리거 없이 첫 의뢰 진행 시점에 만든다 (경합 시 중복 무해)
      const ins = await svc.from("catch_profiles")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      if (ins.error) return null;
    }

    const last = (prof?.quest_week ?? null) as string | null;
    // 중복 지급 방지 — 주당 1회 (완료 주차 키가 이미 기록돼 있으면 끝)
    if (isQuestDoneThisWeek(last, weekKey)) return null;

    // CAS 게이트 빌더 — 예전 값과 일치할 때만 갱신 (null이면 IS NULL 비교)
    const casPrev = <Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(q: Q): Q =>
      last === null ? q.is("quest_week", null) : q.eq("quest_week", last);

    const count = questProgressCount(last, weekKey) + 1;
    const touchedAt = new Date().toISOString();
    if (count < quest.target) {
      // 다회 의뢰 중간 진행 — "2026-W32:1" 형태로만 기록, 보상 없음. 경합 패자는 조용히 생략.
      await casPrev(svc.from("catch_profiles").update({
        quest_week: encodeQuestProgress(weekKey, count), updated_at: touchedAt,
      }).eq("user_id", userId));
      return null;
    }

    // 완료 게이트: 예전 값과 일치할 때만 weekKey로 승격. 갱신된 행이 있어야 지급.
    const { data: won, error: upErr } = await casPrev(
      svc.from("catch_profiles").update({ quest_week: weekKey, updated_at: touchedAt })
        .eq("user_id", userId),
    ).select("user_id");
    if (upErr || !won || won.length === 0) return null; // 경합에서 짐 → 지급 안 함

    const { error: grantErr } = await svc.rpc("increment_coins", {
      p_user_id: userId, p_amount: QUEST_REWARD_COINS,
    });
    if (grantErr) {
      // 지급 실패(예: RPC 미배포) → 게이트를 되돌려 다음 이벤트에서 재시도 가능하게 한다.
      await svc.from("catch_profiles").update({ quest_week: last })
        .eq("user_id", userId).eq("quest_week", weekKey);
      return null;
    }
    return { title: quest.title, reward: QUEST_REWARD_COINS };
  } catch {
    return null;
  }
}
