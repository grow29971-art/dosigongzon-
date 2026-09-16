// 리디자인 「익숙한 동네앱」 T7 — 고양이 상세·등록·케어 화면군 회귀 가드
// node --test tests/redesign-cats.test.mjs
//   (a) 담당 파일(OG 제외)에 구 아이보리·웜 잉크 hex(#FAF6F0·#211D17·#5D564B)와 placehold.co 참조가 없다
//   (b) cats/[id]/page.tsx — 퍼널 계측 마운트(PickCatSignupCta·FirstFeedBar)와 memorial_at 분기가 살아 있다
//       (logFunnelEvent 자체는 마운트되는 클라이언트 부품 안에서 발화한다 — 계측 배선 동결)
//   (c) AddCatModal.tsx — 좌표 오프셋(applyLocationOffset) 호출이 살아 있다 (위치 비공개 계약)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function walk(dir) {
  const abs = new URL(dir, ROOT).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const out = [];
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...walk(`${dir}${name}/`));
    else if (/\.(ts|tsx)$/.test(name)) out.push(`${dir}${name}`);
  }
  return out;
}

const OWNED_COMPONENTS = [
  "AddCatModal",
  "CareLogTab",
  "CareLogCelebration",
  "CatRegistrationCelebration",
  "CatQRModal",
  "ShareCatButton",
  "SendToCatStar",
  "CatStarPlanet",
  "MemorialDiary",
  "MemorialFlowerButton",
  "AdoptionBadge",
  "AdoptionSeekingSection",
  "ReactionBar",
  "FollowButton",
  "StreakFreezeButton",
  "AchievementToast",
  "ParticleCanvas",
  "StickerIcon",
  "ReportModal",
  "ReportEvidenceBlock",
  "SfxToggle",
].map((n) => `app/components/${n}.tsx`);

const ownedFiles = [
  ...walk("app/(main)/cats/"),
  ...walk("app/(main)/memorial/"),
  ...OWNED_COMPONENTS,
].filter((f) => !/opengraph-image\.tsx$/.test(f));

test("(a) 담당 파일에 구 아이보리·웜 잉크 hex·placehold.co 없음", () => {
  assert.ok(ownedFiles.length >= 20, `담당 파일 수집 실패: ${ownedFiles.length}`);
  for (const f of ownedFiles) {
    const src = read(f).toUpperCase();
    for (const s of ["#FAF6F0", "#211D17", "#5D564B", "PLACEHOLD.CO"]) {
      assert.ok(!src.includes(s), `${f}: "${s}" 잔존`);
    }
  }
});

test("(b) cats/[id]/page.tsx 퍼널 마운트·memorial_at 분기 유지", () => {
  const page = read("app/(main)/cats/[id]/page.tsx");
  // 계측 발화 부품 두 종이 그대로 마운트된다
  assert.match(page, /<PickCatSignupCta catId=\{cat\.id\} catName=\{cat\.name\} \/>/);
  assert.match(page, /<FirstFeedBar catId=\{cat\.id\} catName=\{cat\.name\} \/>/);
  // 마운트 조건: 가입 nudge는 비로그인 + 추모 아님, 완주 바는 로그인
  assert.match(page, /\{!currentUserId && !cat\.memorial_at && \(/);
  assert.match(page, /\{currentUserId && <FirstFeedBar/);
  // 추모 아이에게 입양 문의·지킴이·기금 UI 안 띄움
  assert.match(page, /cat\.adoption_status && !cat\.memorial_at/);
  assert.match(page, /guardian\.count >= 3 && !cat\.memorial_at/);
  assert.match(page, /designatedFund > 0 && !cat\.memorial_at/);
  assert.match(page, /\{cat\.memorial_at && \(/);
  // 계측 함수는 마운트되는 부품 안에서 발화한다
  for (const c of ["app/components/PickCatSignupCta.tsx", "app/components/FirstFeedBar.tsx"]) {
    assert.ok(read(c).includes("logFunnelEvent("), `${c}: logFunnelEvent 호출 없음`);
  }
});

test("(c) AddCatModal.tsx 좌표 오프셋 경로 유지", () => {
  // 오프셋은 AddCatModal이 직접 부르지 않고 createCat(lib/cats-repo) 안에서 단일 적용된다 —
  // 등록 화면이 createCat 외 다른 경로(fetch·insert 직결)로 좌표를 보내지 않는지, createCat이 오프셋을 거치는지 고정
  const modal = read("app/components/AddCatModal.tsx");
  assert.ok(modal.includes("createCat("), "AddCatModal: createCat( 호출이 없음");
  for (const banned of ["fetch(\"/api/cats\"", ".from(\"cats\")", ".insert("]) {
    assert.ok(!modal.includes(banned), `AddCatModal: 좌표 우회 경로 금지 — '${banned}' 발견`);
  }
  const repo = read("lib/cats-repo.ts");
  const createFn = repo.slice(repo.indexOf("export async function createCat("));
  assert.ok(createFn.includes("applyLocationOffset(input.lat, input.lng)"), "createCat: applyLocationOffset 호출이 없음");
});
