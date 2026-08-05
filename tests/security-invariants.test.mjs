// 보안 패치 소스 불변식 테스트 — node --test tests/security-invariants.test.mjs
// 경제성 API fail-closed·결제 로그 마스킹·XSS 이스케이프가 리팩토링으로
// 되돌아가지 않도록 소스 레벨에서 가드한다 (2026-07-26 보안 패치 회귀 가드).
// (라우트는 next/server 의존이라 직접 import 대신 소스 검사 — DB 동시성의
//  실질 방어선은 "변이는 원자 RPC로만, 실패 시 503"이라는 코드 형태 자체다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { isSafeImageUrl } from "../lib/url-validate.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ── 1. 경제성 API fail-closed (비원자 폴백 금지 + RPC 실패 시 503) ──

const FAIL_CLOSED_ROUTES = [
  // [파일, 필수 RPC 이름, 금지 패턴(비원자 폴백 흔적)]
  ["app/api/shop/buy/route.ts", "buy_shop_item_atomic", ['.from("user_items")', '.from("profiles")']],
  ["app/api/shop/use-item/route.ts", "consume_user_item", ['.from("user_items")']],
  ["app/api/cats/equip-item/route.ts", "equip_item_atomic", ['.from("user_items")', '.from("cats")']],
];

for (const [file, rpc, forbidden] of FAIL_CLOSED_ROUTES) {
  test(`${file}: ${rpc} RPC 전용 + 503 fail-closed + 비원자 폴백 없음`, () => {
    const src = read(file);
    assert.ok(src.includes(`"${rpc}"`), `원자 RPC(${rpc}) 호출이 있어야 함`);
    assert.ok(/status:\s*503/.test(src), "RPC 실패 시 503 fail-closed 경로가 있어야 함");
    for (const marker of forbidden) {
      assert.ok(!src.includes(marker), `비원자 폴백 흔적 금지: ${marker}`);
    }
  });
}

test("코인 지급 라우트(daily-login/care-bonus/checkin): 503 fail-closed 유지", () => {
  for (const file of [
    "app/api/coins/daily-login/route.ts",
    "app/api/coins/care-bonus/route.ts",
    "app/api/checkin/complete/route.ts",
  ]) {
    const src = read(file);
    assert.ok(/status:\s*503/.test(src), `${file}: 503 경로 필요`);
    assert.ok(!src.includes('.update({ coins'), `${file}: 코인 read-modify-write 금지`);
  }
});

// ── 2. 결제 로그 마스킹 (paymentKey 원문·토스 전체 오류 객체 로깅 금지) ──

const PAYMENT_ROUTES = [
  "app/api/payment/confirm/route.ts",
  "app/api/payment/webhook/route.ts",
  "app/api/payment/cancel/route.ts",
];

test("결제 라우트: console 호출에 paymentKey 원문 전달 금지", () => {
  for (const file of PAYMENT_ROUTES) {
    const src = read(file);
    for (const line of src.split("\n")) {
      if (!/console\.(error|warn|log)/.test(line)) continue;
      if (!/payment_?[Kk]ey/.test(line)) continue;
      assert.ok(
        /maskPaymentKey\(|safeErrorMessage\(/.test(line),
        `${file}: 마스킹 없는 paymentKey 로깅 — ${line.trim()}`,
      );
    }
    // 토스 응답 본문을 통째로 로그에 흘리는 패턴 금지
    assert.ok(!/console\.[a-z]+\([^\n]*\.text\(\)/.test(src), `${file}: 응답 본문 원문 로깅 금지`);
  }
});

test("결제 라우트: 마스킹 유틸(lib/log-sanitize) 사용", () => {
  for (const file of PAYMENT_ROUTES) {
    assert.ok(read(file).includes('from "@/lib/log-sanitize"'), `${file}: log-sanitize import 필요`);
  }
});

// ── 3. 저장형 XSS ──

test("shop/[id] JSON-LD: '<' 유니코드 이스케이프로 script 탈출 차단", () => {
  const src = read("app/(main)/shop/[id]/page.tsx");
  // 소스에는 문자 그대로 백슬래시 2개 + u003c 가 있어야 한다: .replace(/</g, "\\u003c")
  const needle = 'replace(/</g, "' + "\\\\" + 'u003c")';
  assert.ok(src.includes(needle), "JSON.stringify 후 < 치환 필요");
});

test("map 병원 마커: 병원명은 escapeHtml을 거쳐서만 innerHTML에 삽입", () => {
  const src = read("app/(main)/map/page.tsx");
  assert.match(src, /const label = escapeHtml\(/);
  assert.match(src, /function escapeHtml\(/);
  // 동 이름도 이스케이프 유지
  assert.match(src, /escapeHtml\(dong\)/);
});

test("isSafeImageUrl: 인용부호·스킴 주입 페이로드 거부 (CSS url() 내삽 방어)", () => {
  assert.equal(isSafeImageUrl("https://x.com/a.webp"), true);
  assert.equal(isSafeImageUrl("https://x.com/a');<img onerror=alert(1)>"), false);
  assert.equal(isSafeImageUrl(`https://x.com/a"b`), false);
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("data:text/html,x"), false);
});

// ── 4. 서버 전용 경계 ──

test("lib/supabase/service.ts: server-only 하드 경계 유지", () => {
  assert.ok(read("lib/supabase/service.ts").includes('import "server-only"'));
});

// ── 5. Sentry 설정: sendDefaultPii=false + 공통 redaction 연결 ──

test("sentry config 3종: sendDefaultPii false + redactSentryEvent 연결", () => {
  for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "sentry.client.config.ts"]) {
    const src = read(file);
    assert.ok(src.includes("sendDefaultPii: false"), `${file}: sendDefaultPii false 필요`);
    assert.ok(src.includes("redactSentryEvent"), `${file}: 공통 redaction 필요`);
  }
});

// ── 6. GPS 무신고 불변식 (lib/geo.ts 주석 → 실행 가능한 회귀 가드) ──
// 위협모델: 리팩터로 raw GPS 좌표(pos.coords)가 fetch body·supabase insert/rpc 인자에
//   실리면 개인위치정보 "수집"이 되어 미신고 LBS 운영(위치정보법·형사) 위험. 좌표가
//   네트워크로 나가는 유일 허용 경로는 HomeAuthed의 0.05° 격자 스냅(날씨)뿐이다.
//   (설계 근거: 2026-08-02 보안수정 회의 STEP 6)

// 좌표를 다루도록 허가된 파일 화이트리스트 = 리뷰 게이트.
// 새 파일이 GPS를 쓰면 이 테스트가 깨지고, lib/geo.ts 불변식을 검토한 뒤에만 여기 추가할 수 있다.
const KNOWN_GEO_FILES = new Set([
  "app/(main)/map/page.tsx",
  "app/(main)/mypage/activity-regions/page.tsx",
  "app/components/HomeAuthed.tsx",
  "app/components/CatLocationPicker.tsx",
  "app/components/AddCatModal.tsx",
  "app/components/SafetyCallSheet.tsx",
  "app/components/ShareMyLocation.tsx",
]);

// 주석 제거 — 주석 속 단어("fetch·supabase 금지" 등)가 오탐되지 않게. `://`(URL)는 보존.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const listAppSources = () =>
  readdirSync(new URL("../app/", import.meta.url), { recursive: true })
    .map((f) => "app/" + String(f).replace(/\\/g, "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f));

// R1 — 신규 GPS 도입 = 강제 리뷰 게이트
test("GPS: getCurrentPosition/watchPosition 사용처는 화이트리스트뿐", () => {
  const users = listAppSources().filter((f) =>
    /(getCurrentPosition|watchPosition)\s*\(/.test(stripComments(read(f))),
  );
  const unknown = users.filter((f) => !KNOWN_GEO_FILES.has(f));
  assert.deepEqual(
    unknown,
    [],
    `미등록 GPS 사용처 — lib/geo.ts 불변식 검토 후 화이트리스트 갱신 필요: ${unknown.join(", ")}`,
  );
});

// R2 — egress-free 파일 봉인: 좌표를 화면/OS로만 흘리고 네트워크로 절대 안 보냄
test("GPS: SafetyCallSheet·ShareMyLocation에 네트워크 송신 채널 금지", () => {
  for (const f of ["app/components/SafetyCallSheet.tsx", "app/components/ShareMyLocation.tsx"]) {
    const code = stripComments(read(f));
    for (const banned of ["fetch(", "createClient", ".insert(", ".rpc(", ".upsert(", "sendBeacon", "XMLHttpRequest"]) {
      assert.ok(!code.includes(banned), `${f}: 좌표 egress 채널 금지 — '${banned}' 발견`);
    }
  }
});

// R3 — 날씨만 좌표 전송 허용, 그것도 0.05° 격자 스냅 강제
test("GPS: 날씨 전송 좌표는 격자 스냅을 거치고 raw 직결은 금지", () => {
  const home = stripComments(read("app/components/HomeAuthed.tsx"));
  assert.match(
    home,
    /Math\.round\(\s*pos\.coords\.latitude\s*\/\s*0\.05\s*\)/,
    "weather 전송 좌표는 0.05° 격자 스냅을 거쳐야 함",
  );
  assert.ok(!/fetchWeather\(\s*pos\.coords/.test(home), "raw pos.coords를 fetchWeather에 직결 금지");
});

// R3-1 — 좌표는 URL이 아니라 POST body로. 격자 좌표라도 쿼리스트링에 실으면
//   우리가 저장하지 않아도 플랫폼(Vercel) 액세스 로그에 남아 "미수집" 구성이 깨진다.
test("GPS: 날씨 좌표는 쿼리스트링이 아니라 POST body로만 전송", () => {
  const home = stripComments(read("app/components/HomeAuthed.tsx"));
  assert.ok(
    !/["'`]\/api\/weather[^"'`]*\?[^"'`]*(lat|lon)=/.test(home),
    "좌표를 /api/weather 쿼리스트링에 실으면 안 됨 (플랫폼 로그 잔존)",
  );
  assert.match(home, /JSON\.stringify\(\{\s*lat\s*,\s*lon\s*\}\)/, "좌표는 body로 전송해야 함");

  const route = stripComments(read("app/api/weather/route.ts"));
  assert.ok(
    !/searchParams\.get\(\s*["'](lat|lon)["']\s*\)/.test(route),
    "GET에서 좌표 쿼리를 읽으면 안 됨 — 읽는 순간 URL에 실어 보내는 경로가 되살아난다",
  );
  assert.ok(
    !/cf-connecting-ip/.test(route),
    "cf-connecting-ip는 우리 경로의 프록시가 설정하지 않아 위조 가능 — getClientIp를 쓸 것",
  );
});

// R4 — 활동지역: 저장 좌표는 행정동 중심만. raw든 뭉갠 값이든 GPS 파생값 저장 금지
test("GPS: activity-regions는 GPS 파생 좌표를 저장 state에 대입하지 않음", () => {
  const src = stripComments(read("app/(main)/mypage/activity-regions/page.tsx"));
  assert.ok(!/setLat\(\s*gpsLat\s*\)/.test(src), "raw gpsLat 저장 금지 (행정동 중심만)");
  assert.ok(!/setLng\(\s*gpsLng\s*\)/.test(src), "raw gpsLng 저장 금지");
  // 뭉갠 격자값도 금지 — GPS에서 파생된 좌표를 user_id와 함께 저장하는 순간
  // 개인위치정보 수집으로 해석될 여지가 생긴다. 지오코딩 실패 시엔 저장하지 않는다.
  assert.ok(
    !/set(Lat|Lng)\(\s*Math\.round\(\s*gps/.test(src),
    "GPS 파생 격자값 저장 금지 — 지오코딩 실패 시 직접 선택을 안내할 것",
  );
});

// R5 — 고양이 좌표: 저장 직전 applyLocationOffset(±444m) 통과 + 오프셋이 항등이 아님
test("GPS: createCat/updateCat 좌표는 applyLocationOffset을 거침", () => {
  const src = read("lib/cats-repo.ts");
  assert.match(src, /applyLocationOffset\(\s*input\.lat\s*,\s*input\.lng\s*\)/);
  assert.match(src, /\(Math\.random\(\)\s*-\s*0\.5\)\s*\*\s*0\.008/);
});
