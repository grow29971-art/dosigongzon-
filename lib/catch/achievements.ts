// catch 업적 시스템 — 도감의 수집 축 (냥줍 lib/achievements.ts 이식, 2026-08-04 P3).
//
// DB 테이블 없음: 업적은 이미 쌓이는 데이터(catch_cards·catch_profiles)에서 순수
// 함수로 매번 계산한다. 규칙이 바뀌면 이 파일만 고치면 소급 적용되고, "달성 기록"을
// 저장하지 않으므로 마이그레이션·정합성 문제가 없다. 보상 수령 기록만
// catch_profiles.achievement_claims에 남는다(업적당 평생 1회 —
// app/api/catch/achievements/claim 참조).
//
// 냥줍 대비 조정:
//  · 실사 축 폐기 — city 포획 카드는 전부 종 아트(photo_url 없음)라 photo_url 필터
//    없이 catch_cards 전체를 센다. realCatches → totalCatches로 개명.
//  · 재회(reunion)·실체화(materialize) 업적 제외 — 재회 라우트·실사 촬영 플로우가
//    아직 없어 영구 달성 불가가 된다(냥줍 2026-07-15 "죽은 의뢰" 감사 교훈:
//    달성 경로가 연결되지 않은 컨텐츠는 넣지 않는다). 이식 시 여기 정의만 추가하면 됨.
//  · 종 컬렉션 목표 — 냥줍 18종이 아니라 city 카탈로그 크기(SPAWN_SPECIES.length,
//    현재 118종)를 동적으로 참조. 종이 늘면 "완전 도감" 목표도 같이 늘어난다.
//  · 배틀 업적(streak_5·boss_5)은 정의를 유지하되 도감이 CATCH_BATTLE_ENABLED로
//    필터한다(lib/catch/features.ts — P4 배틀 이식 전까지 진행값은 항상 0).

import { SPAWN_SPECIES } from "@/lib/catch/spawn-species";

export interface AchievementInput {
  /** 포획한 카드 수 (catch_cards 전체) */
  totalCatches: number;
  /** 등급별 카드 수 (card_rarity — 완벽 포획 승급이면 종 등급과 다를 수 있다) */
  rarityCounts: Record<string, number>;
  /** 서로 다른 geohash7 셀 수 (탐험 반경) */
  distinctCells: number;
  /** 완벽 포획 횟수 (catch_profiles.perfect_catch_count) */
  perfectCatches: number;
  /** 보스 퇴치 횟수 — P4 배틀 이식 전까지 0 */
  bossDefeats: number;
  /** 최고 연승 — P4 배틀 이식 전까지 0 */
  bestWinStreak: number;
  /** 서로 다른 종 수 (catch_cards.species_key distinct) */
  speciesCount: number;
  /** ✨ 샤이니 보유 수 */
  shinyCount: number;
}

export interface Achievement {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  /** 현재 진행값 / 목표값 — UI 진행바용 */
  current: number;
  target: number;
  done: boolean;
  /** 달성 보상 코인 (1회 수령 — catch_profiles.achievement_claims에 수령 키 기록) */
  reward: number;
}

/** 배틀 전적 기반 업적 키 — CATCH_BATTLE_ENABLED가 꺼지면 도감·수령에서 제외 */
export const BATTLE_ACHIEVEMENT_KEYS = new Set(["streak_5", "boss_5"]);

const def = (
  key: string, emoji: string, title: string, desc: string,
  current: number, target: number, reward: number,
): Achievement => ({
  key, emoji, title, desc,
  current: Math.min(current, target), target, done: current >= target, reward,
});

/** 입력 통계 → 업적 목록 (표시 순서 = 배열 순서) */
export function computeAchievements(s: AchievementInput): Achievement[] {
  const legendary = s.rarityCounts["legendary"] ?? 0;
  const rare = s.rarityCounts["rare"] ?? 0;
  const gotAllRarities = ["common", "uncommon", "rare", "legendary"]
    .filter(r => (s.rarityCounts[r] ?? 0) > 0).length;
  const speciesTotal = SPAWN_SPECIES.length;

  // 보상 스케일 근거(냥줍 계승): 주간 의뢰 100코인 대비 1회성이라 난이도별
  // 30(첫 경험)~300(장기 목표). 상자 보상(10~77)·상점가와 나란한 수준.
  return [
    // 포획(수집)
    def("first_catch", "🐾", "첫 냥이", "첫 번째 냥이를 포획하기", s.totalCatches, 1, 30),
    def("catch_10", "📸", "동네 냥이 반장", "냥이 10마리 포획하기", s.totalCatches, 10, 60),
    def("catch_30", "🎒", "냥이 콜렉터", "냥이 30마리 포획하기", s.totalCatches, 30, 120),
    def("catch_100", "👑", "포획 마스터", "냥이 100마리 포획하기", s.totalCatches, 100, 300),
    // 등급 컬렉션
    def("rarity_all", "🌈", "무지개 컬렉션", "일반~레전드 4개 등급 모두 모으기", gotAllRarities, 4, 200),
    def("rare_1", "💎", "귀한 만남", "레어 등급 냥이 만나기", rare, 1, 40),
    def("legendary_1", "⭐", "전설의 목격자", "레전드 등급 냥이 만나기", legendary, 1, 150),
    // 탐험
    def("explorer_5", "🗺️", "골목 탐험가", "서로 다른 동네 셀 5곳에서 포획", s.distinctCells, 5, 60),
    def("explorer_20", "🧭", "냥이 순례자", "서로 다른 동네 셀 20곳에서 포획", s.distinctCells, 20, 150),
    // 실력
    def("perfect_10", "🎯", "캔 던지기 달인", "완벽 포획 10회", s.perfectCatches, 10, 80),
    def("streak_5", "🔥", "연승 가도", "배틀 5연승 달성", s.bestWinStreak, 5, 80),
    def("boss_5", "🦹", "동네 지킴이", "보스 5회 퇴치", s.bossDefeats, 5, 80),
    // 종 컬렉션
    def("species_5", "🐾", "동네 냥이 박사", "냥이 5종 수집", s.speciesCount, 5, 60),
    def("species_30", "📚", "종 도감 수집가", "냥이 30종 수집", s.speciesCount, 30, 120),
    def("species_all", "🏆", "완전 도감", `냥이 ${speciesTotal}종 모두 수집`, s.speciesCount, speciesTotal, 300),
    // 샤이니
    def("shiny_1", "✨", "반짝이는 만남", "✨샤이니 냥이 잡기 (1% 확률)", s.shinyCount, 1, 100),
  ];
}

// ── 서버 수령 판정용 입력 조립 — 도감 클라이언트와 동일한 규칙을 한 곳에 고정 ──
// (claim API가 service_role로 catch_cards/catch_profiles를 다시 읽어 재계산하므로
//  진행값 위조 불가)
export interface AchievementCardRow {
  card_rarity: string;
  caught_geohash7: string | null;
  species_key: string | null;
  is_shiny: boolean | null;
}

export interface AchievementProfileRow {
  perfect_catch_count?: number | null;
  boss_defeats?: number | null;
  best_win_streak?: number | null;
}

export function achievementInput(
  cards: AchievementCardRow[], prof: AchievementProfileRow | null,
): AchievementInput {
  const rarityCounts: Record<string, number> = {};
  for (const c of cards) rarityCounts[c.card_rarity] = (rarityCounts[c.card_rarity] ?? 0) + 1;
  return {
    totalCatches: cards.length,
    rarityCounts,
    distinctCells: new Set(cards.map(c => c.caught_geohash7).filter(Boolean)).size,
    perfectCatches: prof?.perfect_catch_count ?? 0,
    bossDefeats: prof?.boss_defeats ?? 0,
    bestWinStreak: prof?.best_win_streak ?? 0,
    speciesCount: new Set(cards.map(c => c.species_key).filter(Boolean)).size,
    shinyCount: cards.filter(c => c.is_shiny).length,
  };
}
