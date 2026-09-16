// 리디자인 「익숙한 동네앱」 T12 회귀 가드 — 로그인·가입·welcome·온보딩·루트 페이지군 (2026-09-16)
// node --test tests/redesign-auth.test.mjs
//   (a) 담당 파일(darkcheck·opengraph-image 제외)에 구 아이보리 팔레트(#FAF6F0·#211D17·#5D564B)와
//       placehold.co 플레이스홀더가 없다 — 사진 없는 고양이는 lib/cat-art 마커 아트로 그린다.
//   (b) login/page.tsx에 카카오 브랜드색 #FEE500이 남아 있다 (브랜드 버튼은 토큰화 대상이 아님)
//   (c) signup/page.tsx의 퍼널 계측 logFunnelEvent( 호출이 살아 있다
//   (d) app/(main)/layout.tsx의 첫 진입 게이트·하단 탭 마운트가 각각 정확히 1회 — 순서·개수 불변
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const OWNED_DIRS = [
  "app/login", "app/signup", "app/welcome", "app/onboarding", "app/about", "app/faq", "app/guide",
  "app/areas", "app/regions", "app/terms", "app/privacy", "app/account-deletion", "app/celebrate",
  "app/maker", "app/z",
];
const OWNED_FILES = [
  "app/error.tsx", "app/not-found.tsx", "app/(main)/layout.tsx", "app/(main)/error.tsx",
  ...[
    "WelcomeGate", "FeatureTourGate", "FeatureTourModal", "AnnouncementModal", "AppOpenGuideModal",
    "Og200EventModal", "PushOnboardInterstitial", "FirstFeedPushPrompt", "PushSubscriber", "ConsentManager",
    "MarketingConsentApplier", "PendingInviteApplier", "TurnstileWidget", "LoginRequired", "AIChatModal",
    "PointsGuideSheet", "SourceCapture", "MetaPixel",
  ].map((n) => `app/components/${n}.tsx`),
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

function ownedFiles() {
  const files = [];
  for (const d of OWNED_DIRS) files.push(...walk(join(root, d)));
  for (const f of OWNED_FILES) files.push(join(root, f));
  // darkcheck는 다크닝 점검용으로 hex 리터럴 유지 허용, opengraph-image는 다른 담당(hex 필수 문맥)
  return files.filter((p) => !/opengraph-image\.tsx$/.test(p) && !/[\\/]darkcheck[\\/]/.test(p));
}

const read = (rel) => readFileSync(join(root, rel), "utf8");

test("(a) 담당 파일에 구 아이보리 팔레트·placehold.co 없음", () => {
  const banned = ["#FAF6F0", "#211D17", "#5D564B", "placehold.co"];
  const offenders = [];
  for (const p of ownedFiles()) {
    const src = readFileSync(p, "utf8").toUpperCase();
    for (const b of banned) {
      if (src.includes(b.toUpperCase())) offenders.push(`${p.slice(root.length + 1)}: ${b}`);
    }
  }
  assert.deepEqual(offenders, [], `구 팔레트/플레이스홀더 잔존:\n${offenders.join("\n")}`);
});

test("(b) login/page.tsx 카카오 브랜드색 #FEE500 유지", () => {
  assert.ok(read("app/login/page.tsx").toUpperCase().includes("#FEE500"));
});

test("(c) signup/page.tsx 퍼널 계측 logFunnelEvent( 유지", () => {
  assert.ok(read("app/signup/page.tsx").includes("logFunnelEvent("));
});

test("(d) (main)/layout.tsx 게이트·하단 탭 마운트 각 1회", () => {
  const src = read("app/(main)/layout.tsx");
  for (const tag of ["BottomNav", "WelcomeGate", "FeatureTourGate", "AnnouncementModal", "PushReconsentCard", "PushOnboardInterstitial"]) {
    const n = (src.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;
    assert.equal(n, 1, `<${tag} 마운트는 1회여야 함: ${n}`);
  }
});
