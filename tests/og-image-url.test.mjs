// (main) 아래 동적 OG 이미지 주소 404 회귀 가드
// node --test tests/og-image-url.test.mjs
//
// 배경: app/(main)/ 아래 라우트에서 손으로 조립한 `/…/opengraph-image` 주소는 404다.
// Next 파일 컨벤션(opengraph-image.tsx)이 주입하는 해시 주소(`opengraph-image-xxxx?hash`)만 200.
// generateMetadata에서 images를 손 조립 문자열로 덮어쓰면 파일 컨벤션 주입이 밀려나므로,
//   (a) 4개 메타데이터 파일의 `images:` 안에 손 조립 `opengraph-image` 문자열이 없어야 한다
//       (JSON-LD의 절대 URL 폴백 `${SITE_URL}/opengraph-image`(루트 정적, 200)는 허용)
//   (b) 카카오 공유 클라이언트 호출처는 손 조립 대신 페이지 og:image 메타를 읽는 getPageOgImageUrl( 을 쓴다
//   (c) 헬퍼 lib/og-image-url.ts 계약: og:image 메타 → 없으면 fallback
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const METADATA_FILES = [
  "app/(main)/cats/[id]/page.tsx",
  "app/(main)/community/[id]/layout.tsx",
  "app/(main)/news/[id]/layout.tsx",
  "app/(main)/tips/[slug]/page.tsx",
];

const SHARE_CALLSITES = [
  "app/components/ShareCatButton.tsx",
  "app/components/ShareGuideButton.tsx",
  "app/components/ShareNewsButton.tsx",
  "app/(main)/community/[id]/page.tsx",
];

// `images: [ ... ]` 블록만 잘라낸다(중첩 대괄호 1단계까지)
function extractImagesBlocks(src) {
  const blocks = [];
  const re = /images:\s*\[/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "[") depth += 1;
      else if (src[i] === "]") depth -= 1;
      i += 1;
    }
    blocks.push(src.slice(m.index, i));
  }
  return blocks;
}

test("(a) (main) 메타데이터 4종: images 안에 손 조립 opengraph-image 주소가 없다", () => {
  for (const rel of METADATA_FILES) {
    const src = read(rel);
    const blocks = extractImagesBlocks(src);
    for (const block of blocks) {
      assert.ok(
        !/opengraph-image/.test(block),
        `${rel}: images 블록에 손 조립 opengraph-image 주소가 남아 있다 → 파일 컨벤션 주입을 덮어써 404\n${block}`,
      );
    }
    // 변수로 우회(`const image = \`…/opengraph-image\`` 를 images에 넣는 패턴)도 막는다
    assert.ok(
      !/\/(cats|community|news|tips)\/\$\{[^}]+\}\/opengraph-image/.test(src),
      `${rel}: 동적 세그먼트 뒤에 /opengraph-image 를 손 조립한 문자열이 남아 있다`,
    );
  }
});

test("(a-2) JSON-LD 절대 URL 폴백은 루트 정적 OG(${SITE_URL}/opengraph-image)를 쓴다", () => {
  const cats = read("app/(main)/cats/[id]/page.tsx");
  assert.match(cats, /image:\s*photo\s*\?\?\s*`\$\{SITE_URL\}\/opengraph-image`/);
  const tips = read("app/(main)/tips/[slug]/page.tsx");
  assert.match(tips, /const image = photo \|\| `\$\{SITE_URL\}\/opengraph-image`/);
});

test("(b) 카카오 공유 호출처 4곳: 손 조립 대신 getPageOgImageUrl( 사용", () => {
  for (const rel of SHARE_CALLSITES) {
    const src = read(rel);
    assert.ok(src.includes("getPageOgImageUrl("), `${rel}: getPageOgImageUrl( 호출이 있어야 한다`);
    assert.ok(
      !/\$\{(origin|window\.location\.origin)\}\/(cats|protection|news|community)\/\$\{[^}]+\}\/opengraph-image/.test(src),
      `${rel}: 손 조립 동적 opengraph-image 주소가 남아 있다`,
    );
  }
});

test("(b-2) 지도 카카오 공유: 페이지 og:image(지도 것) 대신 고양이 사진(sanitizeImageUrl) → 루트 OG 폴백", () => {
  const src = read("app/(main)/map/page.tsx");
  assert.ok(
    !/\/cats\/\$\{selectedCat\.id\}\/opengraph-image/.test(src),
    "map/page.tsx: 손 조립 /cats/{id}/opengraph-image 가 남아 있다",
  );
  const fnStart = src.indexOf("const handleShareCatToKakao");
  assert.ok(fnStart >= 0, "handleShareCatToKakao 가 있어야 한다");
  const fn = src.slice(fnStart, fnStart + 1200);
  assert.match(fn, /sanitizeImageUrl\(selectedCat\.photo_url/);
  assert.match(fn, /\/opengraph-image`/);
  assert.ok(!fn.includes("getPageOgImageUrl("), "지도 페이지의 og:image 는 지도 것이므로 쓰지 않는다");
  // 앵커 무변경(logFunnelEvent( 은 map/page.tsx 가 아니라 FirstFeedBar 등 자식에 있다 — redesign-map 테스트 담당)
  for (const anchor of ["mapInstanceRef", "function escapeHtml("]) {
    assert.ok(src.includes(anchor), `map/page.tsx 앵커 "${anchor}" 유지`);
  }
});

test("(c) lib/og-image-url.ts: og:image 메타 content 우선, 없으면 fallback", async () => {
  const src = read("lib/og-image-url.ts");
  assert.match(src, /export function getPageOgImageUrl\(fallback: string\): string/);
  assert.match(src, /meta\[property="og:image"\]/);
  assert.ok(src.includes("typeof document"), "SSR 가드(typeof document) 필요");
});
