// 리디자인 「익숙한 동네앱」(결정 0007) — 홈 화면군(T6) 소스 감시 회귀 가드
// node --test tests/redesign-home.test.mjs
//
// (a) 홈 화면군 파일에 구 아이보리 hex·세리프 폰트·placehold.co 잔재가 없다
// (b) HomeLanding SEO 앵커: h1 문구·JSON-LD 스크립트가 그대로다
// (c) 계측 앵커: PickCatSignupCta의 logFunnelEvent(, HomeAuthed의 PendingCareHandoff 마운트·
//     CareTeamCard 게이트·날씨 좌표 body 전송은 리디자인이 건드리지 않는다
// (d) MyCatsHero의 fail-safe 폴백 제목 "내 아이들"이 남아 있다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const HOME_FILES = [
  "app/(main)/page.tsx",
  "app/components/HomeLanding.tsx",
  "app/components/HomeAuthed.tsx",
  "app/components/HomeStreakCard.tsx",
  "app/components/CatSpotlightRow.tsx",
  "app/components/MyCatsHero.tsx",
  "app/components/MyCatsQuickCare.tsx",
  "app/components/MyCircleQuickEntry.tsx",
  "app/components/ActivityFeedPreview.tsx",
  "app/components/WeeklyHotPosts.tsx",
  "app/components/WeeklyCheckinCard.tsx",
  "app/components/TodayVisitors.tsx",
  "app/components/SocialProofStrip.tsx",
  "app/components/ShopPreviewStrip.tsx",
  "app/components/PetitionSection.tsx",
  "app/components/RescueBanner.tsx",
  "app/components/RallyPosterBanner.tsx",
  "app/components/Event1000Banner.tsx",
  "app/components/FoundingMemberBanner.tsx",
  "app/components/FirstProjectBanner.tsx",
  "app/components/PatchUpdateBanner518.tsx",
  "app/components/LaunchCountdown.tsx",
  "app/components/AboutCityCard.tsx",
  "app/components/AIChatCard.tsx",
  "app/components/FeatureTipsCard.tsx",
  "app/components/OnboardingCard.tsx",
  "app/components/ReturnDigestCard.tsx",
  "app/components/FirstCheerCard.tsx",
  "app/components/InviteSection.tsx",
  "app/components/LandingOnboardingGate.tsx",
  "app/components/PickCatSignupCta.tsx",
  "app/components/SignupNudgeBar.tsx",
  "app/components/PublicHeader.tsx",
  "app/components/CareTeamCard.tsx",
  "app/components/SplashLoading.tsx",
];

test("(a) 홈 화면군: 구 아이보리 hex·세리프·placehold.co 잔재 없음", () => {
  const banned = ["#FAF6F0", "#211D17", "#5D564B", 'fontFamily: "serif"', "placehold.co"];
  for (const rel of HOME_FILES) {
    const src = read(rel).toUpperCase();
    for (const s of banned) {
      assert.ok(!src.includes(s.toUpperCase()), `${rel} 에 "${s}" 가 남아 있음`);
    }
  }
});

test("(b) HomeLanding: h1 문구·JSON-LD 유지 (SEO 본문 무변경)", () => {
  const src = read("app/components/HomeLanding.tsx");
  assert.match(src, /<h1[^>]*>\s*전국 길고양이 /, "h1 '전국 길고양이 …' 문구가 있어야 한다");
  assert.ok(src.includes("한 화면에서 함께 돌봐요."), "h1 두 번째 줄 문구가 있어야 한다");
  assert.ok(
    (src.match(/type="application\/ld\+json"/g) ?? []).length >= 2,
    "WebApplication·FAQPage JSON-LD 스크립트 2개가 있어야 한다",
  );
  assert.ok(src.includes('"@type": "FAQPage"'), "FAQ JSON-LD가 있어야 한다");
});

test("(c) 계측·게이트 앵커 유지", () => {
  const cta = read("app/components/PickCatSignupCta.tsx");
  assert.ok(cta.includes("logFunnelEvent("), "PickCatSignupCta의 logFunnelEvent( 호출이 남아 있어야 한다");
  assert.ok(
    /logFunnelEvent\(\s*["']onboarding_pick["']\s*,\s*catId\s*\)/.test(cta),
    "onboarding_pick 계측 인자가 그대로여야 한다",
  );

  const home = read("app/components/HomeAuthed.tsx");
  assert.ok(home.includes("<PendingCareHandoff"), "온보딩 핸드오프(계측 마운트) 마운트가 남아 있어야 한다");
  assert.ok(/isCoreJourneyEnabled\(\s*["']P4["']\s*\)\s*&&\s*user\s*&&\s*<CareTeamCard/.test(home), "CareTeamCard P4 게이트 표현식이 그대로여야 한다");
  assert.match(home, /JSON\.stringify\(\{\s*lat\s*,\s*lon\s*\}\)/, "날씨 좌표는 POST body로 전송");
  assert.ok(home.includes("<MyCatsHero careInboxMode={SHOW_CARE_INBOX_HOME} />"), "MyCatsHero 마운트가 그대로여야 한다");
});

test("(d) MyCatsHero: fail-safe 폴백 제목 '내 아이들' 유지", () => {
  const src = read("app/components/MyCatsHero.tsx");
  assert.ok(src.includes("내 아이들"));
  assert.match(src, /careInboxMode\s*&&\s*pendingCount\s*>\s*0/);
});
