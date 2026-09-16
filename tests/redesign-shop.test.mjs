// 쇼핑 화면군 리디자인 회귀 가드 — node --test tests/redesign-shop.test.mjs
// 2026-09-16 리디자인 「익숙한 동네앱」(결정 0007) T9. 담당 파일을 텍스트로 읽어 다음을 고정한다:
//   (a) 구 아이보리·웜 잉크 hex와 placehold.co 플레이스홀더가 남아 있지 않다
//   (b) 법정 표시 문자열(사업자정보 푸터·부가세 포함·VAT 문구·수익 10%)이 글자 그대로 남아 있다
//   (c) shop/[id] JSON-LD의 '<' 유니코드 이스케이프가 유지된다
//   (d) 담당 파일에 6자리 hex 리터럴이 없다(브랜드색 카카오·네이버만 허용)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/opengraph-image\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

const OWNED = [
  ...walk(join(ROOT, "app/(main)/shop")),
  join(ROOT, "app/components/FundSettlementCard.tsx"),
  join(ROOT, "app/components/FundVoteCard.tsx"),
];

test("(a) 구 팔레트 hex·placehold.co 잔재 없음", () => {
  for (const file of OWNED) {
    const src = readFileSync(file, "utf8").toUpperCase();
    for (const s of ["#FAF6F0", "#211D17", "#5D564B", "PLACEHOLD.CO"]) {
      assert.ok(!src.includes(s), `${file}: "${s}" 가 남아 있음`);
    }
  }
});

test("(b) 법정 표시 문자열 유지 — 사업자정보 푸터·부가세·VAT·수익 10%", () => {
  const list = read("app/(main)/shop/page.tsx");
  for (const s of [
    "도시공존 · 대표 김성우 · 사업자등록번호 793-16-02886",
    "사업장 소재지: 인천광역시 검단구 원당대로820번길 35, 초롱마을 13동 401호 (당하동)",
    "전화 010-7790-2997 · grow29971@gmail.com",
    "통신판매업 신고번호 제2026-인천검단-0207호",
    "수익(이익)의 10%",
  ]) {
    assert.ok(list.includes(s), `shop/page.tsx: "${s}" 소실`);
  }

  const detail = read("app/(main)/shop/[id]/ProductDetailClient.tsx");
  assert.ok(detail.includes("부가세 포함"), "ProductDetailClient: '부가세 포함' 소실");

  const checkout = read("app/(main)/shop/checkout/page.tsx");
  assert.ok(checkout.includes("모든 금액은 부가세(VAT) 포함이에요."), "checkout: VAT 문구 소실");
  assert.ok(checkout.includes("수익의 10%"), "checkout: 후원 '수익의 10%' 문구 소실");

  const policy = read("app/(main)/shop/policy/page.tsx");
  for (const s of [
    'value="793-16-02886"',
    'value="제2026-인천검단-0207호"',
    "부가가치세(VAT)가 포함된 최종 금액",
    "수익(이익)의 10%",
    "7일 이내",
  ]) {
    assert.ok(policy.includes(s), `policy: "${s}" 소실`);
  }

  const demo = read("app/(main)/shop/payment-demo/PaymentDemoClient.tsx");
  assert.ok(demo.includes("사업자등록번호 793-16-02886"), "payment-demo: 사업자등록번호 소실");
  assert.ok(demo.includes("통신판매업 신고번호 제2026-인천검단-0207호"), "payment-demo: 통신판매업 신고번호 소실");
});

test("(c) shop/[id] JSON-LD '<' 이스케이프 유지", () => {
  const src = read("app/(main)/shop/[id]/page.tsx");
  const needle = 'replace(/</g, "' + "\\\\" + 'u003c")';
  assert.ok(src.includes(needle), "JSON.stringify 후 < 치환 필요");
});

test("(d) 담당 파일에 6자리 hex 리터럴 없음(브랜드색 제외)", () => {
  const ALLOW = new Set(["#FEE500", "#03C75A"]);
  const HEX_RE = /#[0-9a-fA-F]{6}(?![0-9a-zA-Z])/g;
  for (const file of OWNED) {
    const src = readFileSync(file, "utf8");
    const found = [...src.matchAll(HEX_RE)].map((m) => m[0].toUpperCase()).filter((h) => !ALLOW.has(h));
    assert.deepEqual(found, [], `${file}: hex 리터럴 잔존 ${found.join(", ")}`);
  }
});
