import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// P1-5 소스 감시 회귀: "오늘의 돌봄 인박스" 헤더 프레이밍 불변식.
//
// careInboxMode + 아직 못 챙긴 아이(pendingCount>0) 조건에서만 "오늘의 돌봄"/"아직 N마리"
// 프레이밍이 나타나고, flag off 또는 kill switch(=careInboxMode off) 또는 pendingCount===0
// 이면 기존 "내 아이들"/"doneCount/total 오늘 밥"으로 fail-safe 유지된다.
// 이 테스트는 프레이밍 게이팅이 careInboxMode·countPendingFeed 계약에서 벗어나는 회귀를
// 소스 레벨에서 막는다. (UI·flag·URL·라우트·데이터 변경 없음, 파일 삭제 없음 - 감시 전용)

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

test("MyCatsHero 헤더 프레이밍은 careInboxMode && pendingCount>0 게이트로만 '오늘의 돌봄'을 켠다", () => {
  const src = read("app/components/MyCatsHero.tsx");
  // 인박스 프레이밍 게이트: careInboxMode && pendingCount > 0
  assert.match(
    src,
    /careInboxMode\s*&&\s*pendingCount\s*>\s*0/,
    "careInboxMode && pendingCount>0 게이트가 있어야 한다",
  );
  // pending 수는 공유 순수 계약 countPendingFeed(cats)로 계산한다 (UI 자체 셈 금지).
  assert.match(
    src,
    /countPendingFeed\s*\(\s*cats\s*\)/,
    "pendingCount는 countPendingFeed(cats)로 파생되어야 한다",
  );
  // fail-safe 폴백 문구가 남아 있어야 한다 (flag off/kill switch/pending 0 시).
  assert.ok(src.includes("내 아이들"), "fail-safe 폴백 제목 '내 아이들'이 있어야 한다");
});

test("정렬은 careInboxMode에서만 prioritizePendingFeed로 미완료를 앞세운다", () => {
  const src = read("app/components/MyCatsHero.tsx");
  // careInboxMode ? prioritizePendingFeed(cats) : cats 형태의 조건 정렬.
  assert.match(
    src,
    /careInboxMode\s*\?\s*prioritizePendingFeed\s*\(\s*cats\s*\)\s*:\s*cats/,
    "careInboxMode에서만 prioritizePendingFeed(cats), 아니면 원본 cats여야 한다",
  );
});
