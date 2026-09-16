// 리디자인 「익숙한 동네앱」(결정 0007) 후속 — 앱 밖 자산(OG 이미지·메일 HTML) 소스 감시 회귀 가드
// node --test tests/redesign-og-mail.test.mjs
//
// (a) OG 이미지 19종 + 공용 템플릿(lib/og-helpers.tsx)에 구 아이보리 그라디언트·웜 잉크 hex·
//     placehold.co 폴백이 없다
// (b) 주간 메일·문의 알림 메일 HTML에 구 팔레트 hex가 없고, 수신거부 링크·발송 조건은 그대로다
// (c) lib/url-validate.ts의 OG SSRF 허용 목록에서 placehold.co가 빠졌다(Supabase 스토리지만 허용)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const OG_FILES = [
  "app/opengraph-image.tsx",
  "app/about/opengraph-image.tsx",
  "app/faq/opengraph-image.tsx",
  "app/guide/opengraph-image.tsx",
  "app/areas/[slug]/opengraph-image.tsx",
  "app/(main)/cats/[id]/opengraph-image.tsx",
  "app/(main)/community/[id]/opengraph-image.tsx",
  "app/(main)/news/[id]/opengraph-image.tsx",
  "app/(main)/tips/[slug]/opengraph-image.tsx",
  "app/(main)/rescue/opengraph-image.tsx",
  "app/(main)/protection/disease-guide/opengraph-image.tsx",
  "app/(main)/protection/district-contacts/opengraph-image.tsx",
  "app/(main)/protection/emergency-guide/opengraph-image.tsx",
  "app/(main)/protection/feeding-guide/opengraph-image.tsx",
  "app/(main)/protection/kitten-guide/opengraph-image.tsx",
  "app/(main)/protection/legal/opengraph-image.tsx",
  "app/(main)/protection/pharmacy-guide/opengraph-image.tsx",
  "app/(main)/protection/shelter-guide/opengraph-image.tsx",
  "app/(main)/protection/trapping-guide/opengraph-image.tsx",
  "lib/og-helpers.tsx",
];

const MAIL_FILES = ["lib/weekly-digest.ts", "app/api/admin/notify-inquiry/route.ts"];

// 구 아이보리 그라디언트·아이보리 바탕·웜 브라운·웜 잉크 팔레트 + 플레이스홀더 호스트
const BANNED = [
  "#F6EFE3",
  "#EADFCB",
  "#DAC4A3",
  "#F7F4EE",
  "#A38E7A",
  "#FAF6F0",
  "#211D17",
  "#5D564B",
  "#8B5A3C",
  "#6B5043",
  "#8B7562",
  "#C9A961",
  "#4A7BA8",
  "placehold.co",
];

test("(a) OG 이미지 19종 + 템플릿: 구 아이보리·웜 브라운 hex·placehold.co 없음", () => {
  assert.equal(OG_FILES.filter((f) => f.endsWith("opengraph-image.tsx")).length, 19);
  for (const rel of OG_FILES) {
    const src = read(rel).toUpperCase();
    for (const s of BANNED) {
      assert.ok(!src.includes(s.toUpperCase()), `${rel} 에 "${s}" 가 남아 있음`);
    }
    assert.ok(!src.includes("LINEAR-GRADIENT"), `${rel} 에 그라디언트가 남아 있음`);
    assert.ok(!src.includes("RADIAL-GRADIENT"), `${rel} 에 장식 원 그라디언트가 남아 있음`);
  }
});

test("(a-2) OG 이미지: 크기 1200×630·브랜드색 유지", () => {
  for (const rel of OG_FILES.filter((f) => f.endsWith("opengraph-image.tsx"))) {
    const src = read(rel);
    assert.ok(
      src.includes("width: 1200, height: 630") || src.includes("size = OG_SIZE"),
      `${rel} 의 OG 크기(1200×630)가 바뀜`,
    );
  }
  assert.ok(read("lib/og-helpers.tsx").includes("#B05C36"), "템플릿 브랜드 마크는 테라코타여야 한다");
});

test("(b) 메일 HTML 2종: 구 팔레트 hex 없음, 수신거부·발송 조건 유지", () => {
  for (const rel of MAIL_FILES) {
    const src = read(rel).toUpperCase();
    for (const s of BANNED) {
      assert.ok(!src.includes(s.toUpperCase()), `${rel} 에 "${s}" 가 남아 있음`);
    }
    assert.ok(!src.includes("LINEAR-GRADIENT"), `${rel} 에 그라디언트가 남아 있음`);
  }
  const digest = read("lib/weekly-digest.ts");
  assert.ok(digest.includes("unsub=1#email-digest"), "주간 메일 수신거부 링크가 남아 있어야 한다");
  assert.ok(digest.includes('.eq("email_digest_enabled", true)'), "opt-in 발송 조건이 남아 있어야 한다");
  assert.ok(digest.includes("(광고)"), "(광고) 표기가 남아 있어야 한다");
  const inquiry = read("app/api/admin/notify-inquiry/route.ts");
  assert.ok(inquiry.includes("rateLimit(`notify-inquiry:${user.id}`"), "문의 알림 레이트리밋이 남아 있어야 한다");
  assert.ok(inquiry.includes("관리자 페이지 열기"), "문의 알림 버튼 문구가 남아 있어야 한다");
});

test("(c) OG SSRF 허용 목록: placehold.co 제거, Supabase 호스트만", () => {
  const src = read("lib/url-validate.ts");
  assert.ok(!src.includes("placehold.co"), "OG_IMAGE_HOST_ALLOW 에 placehold.co 가 남아 있음");
  assert.ok(src.includes("NEXT_PUBLIC_SUPABASE_URL"), "Supabase 스토리지 호스트 허용은 유지");
  assert.ok(src.includes("export function sanitizeOgImageUrl"), "sanitizeOgImageUrl 은 유지");
});
