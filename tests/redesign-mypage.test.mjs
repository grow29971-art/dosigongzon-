// 리디자인 「익숙한 동네앱」 T10 — 마이페이지·서클·동네·컬렉션·랭킹 화면군 회귀 가드
// node --test tests/redesign-mypage.test.mjs
// (a) 구 아이보리·웜 브라운 hex / 폐지된 iconBg prop / placehold.co 가 담당 파일에 남아 있지 않다
// (b) mypage/circle 은 CareTeamCard 마운트를 유지한다(P4 배선, care-team.test.mjs 와 이중 감시)
// (c) mypage/activity-regions 는 GPS 파생 좌표를 저장 state 에 대입하지 않는다(R4, security-invariants 와 이중 감시)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const OWNED_DIRS = [
  "app/(main)/mypage",
  "app/(main)/neighborhood",
  "app/(main)/collection",
  "app/(main)/caretakers",
  "app/(main)/ranking",
  "app/(main)/experiment",
  "app/circle",
  "app/experiment",
];
const OWNED_FILES = [
  "app/components/MyActivityDashboard.tsx",
  "app/components/MonthlyReportShareButton.tsx",
  "app/components/RankShareButton.tsx",
  "app/components/EmailDigestToggle.tsx",
  "app/components/MarketingPushToggle.tsx",
  "app/components/PushOptInCard.tsx",
  "app/components/PushReconsentCard.tsx",
  "app/components/PushCareCueOptIn.tsx",
  "app/components/InstallAppMenuItem.tsx",
  "app/components/PwaInstallPrompt.tsx",
  "app/components/LegalChecklist.tsx",
  "app/components/MediaKit.tsx",
  "app/components/PrintButton.tsx",
  "app/components/RallyJoinButton.tsx",
];

function walk(rel) {
  const abs = join(root, rel);
  const out = [];
  for (const name of readdirSync(abs)) {
    const child = `${rel}/${name}`;
    if (statSync(join(root, child)).isDirectory()) out.push(...walk(child));
    else if (/\.(ts|tsx)$/.test(name) && !/opengraph-image\.tsx$/.test(name)) out.push(child);
  }
  return out;
}

const ownedSources = () => [...OWNED_DIRS.flatMap(walk), ...OWNED_FILES];

test("(a) 담당 파일에 구 아이보리 hex·iconBg=·placehold.co 없음", () => {
  const banned = ["#FAF6F0", "#211D17", "#5D564B", "#F3EEE5", "iconBg=", "placehold.co"];
  const files = ownedSources();
  assert.ok(files.length >= 30, `담당 파일 수집 이상: ${files.length}`);
  const hits = [];
  for (const f of files) {
    const src = read(f).toUpperCase();
    for (const b of banned) {
      if (src.includes(b.toUpperCase())) hits.push(`${f}: ${b}`);
    }
  }
  assert.deepEqual(hits, [], `잔존 발견:\n${hits.join("\n")}`);
});

test("(b) mypage/circle 은 CareTeamCard 를 마운트한다", () => {
  const src = read("app/(main)/mypage/circle/page.tsx");
  assert.ok(src.includes("<CareTeamCard"), "CareTeamCard 마운트가 사라짐");
});

test("(c) activity-regions 는 GPS 좌표를 저장 state 에 대입하지 않는다", () => {
  const src = read("app/(main)/mypage/activity-regions/page.tsx");
  assert.ok(!/setLat\(\s*gpsLat\s*\)/.test(src), "setLat(gpsLat) 금지");
  assert.ok(!/setLng\(\s*gpsLng\s*\)/.test(src), "setLng(gpsLng) 금지");
});
