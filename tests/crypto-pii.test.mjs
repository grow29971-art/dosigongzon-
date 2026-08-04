// PII 암호화 헬퍼 테스트 — node --test tests/crypto-pii.test.mjs
// lib/crypto-pii.ts (AES-256-GCM + kid 키회전 + HMAC 검색 인덱스) 실계약 검증.
//
// 검증 항목: 라운드트립 / 키 없음 fail-closed / GCM 변조 감지 / null·빈값 /
//   한글·이모지 / 1MB 초장문 / kid 키 회전(구키 복호화·재암호화 판정) /
//   포맷 오류 throw / HMAC 인덱스 결정성 / 마스킹.
//
// 주의: 모듈이 import "server-only" 를 포함하므로(클라 번들 유입 차단 — 의도된 경계)
//   테스트에서는 node:module registerHooks로 해당 스펙만 빈 모듈로 치환해 로드한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { randomBytes } from "node:crypto";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const mod = await import("../lib/crypto-pii.ts");
const {
  encryptPii, decryptPii, isEncrypted, needsReencrypt,
  normalizePhone, hmacIndex, phoneIndex, safeEqualHex, maskPhone,
} = mod;

const KEY_A = randomBytes(32).toString("base64");
const KEY_B = randomBytes(32).toString("base64");
const IDX_KEY = randomBytes(32).toString("base64");

// env를 바꿨다가 반드시 원복 — 다른 테스트 오염 방지
function withEnv(vars, fn) {
  const names = ["PII_ENC_KEY_CURRENT", "PII_ENC_KEY_PREVIOUS", "PII_INDEX_KEY"];
  const prev = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    for (const n of names) {
      if (vars[n] === undefined) delete process.env[n];
      else process.env[n] = vars[n];
    }
    return fn();
  } finally {
    for (const n of names) {
      if (prev[n] === undefined) delete process.env[n];
      else process.env[n] = prev[n];
    }
  }
}
const withKeyA = (fn) => withEnv({ PII_ENC_KEY_CURRENT: `1:${KEY_A}` }, fn);

// ── 1. 라운드트립·포맷 ──────────────────────────────────────

test("라운드트립: encrypt → decrypt 원문 복원 + enc:v1:<kid> 포맷", () => {
  withKeyA(() => {
    const plain = "010-1234-5678 서울시 강남구 배송지";
    const enc = encryptPii(plain);
    assert.ok(enc.startsWith("enc:v1:1:"), "암호문은 enc:v1:<kid>: 프리픽스");
    assert.ok(!enc.includes(plain), "암호문에 평문 노출 금지");
    assert.equal(decryptPii(enc), plain);
    assert.equal(isEncrypted(enc), true);
    assert.equal(isEncrypted(plain), false);
  });
});

test("동일 평문 2회 암호화 → 서로 다른 암호문 (IV 랜덤성)", () => {
  withKeyA(() => {
    assert.notEqual(encryptPii("same"), encryptPii("same"));
  });
});

test("한글·이모지·개행 라운드트립 (UTF-8 멀티바이트)", () => {
  withKeyA(() => {
    const plain = "냥이 🐈‍⬛ 보호자\n연락처 ☎️ 010-0000-0000 「특수문자」";
    assert.equal(decryptPii(encryptPii(plain)), plain);
  });
});

test("초장문(≈1MB) 라운드트립", () => {
  withKeyA(() => {
    const plain = "가나다라0123456789".repeat(70_000);
    assert.equal(decryptPii(encryptPii(plain)), plain);
  });
});

test("null/undefined/빈 문자열은 패스스루 (nullable 컬럼 왕복 안전)", () => {
  withKeyA(() => {
    assert.equal(encryptPii(null), null);
    assert.equal(encryptPii(undefined), null);
    assert.equal(encryptPii(""), "");
    assert.equal(decryptPii(null), null);
    assert.equal(decryptPii(""), "");
  });
});

// ── 2. fail-closed ─────────────────────────────────────────

test("키 미설정: encrypt·(암호문)decrypt 모두 throw — 평문 저장 폴백 금지", () => {
  const enc = withKeyA(() => encryptPii("secret"));
  withEnv({}, () => {
    assert.throws(() => encryptPii("secret"), /PII_ENC_KEY_CURRENT/);
    assert.throws(() => decryptPii(enc), /키를 찾을 수 없음/);
  });
});

test("키 길이 오류(32바이트 아님)·형식 오류는 즉시 throw", () => {
  withEnv({ PII_ENC_KEY_CURRENT: `1:${randomBytes(16).toString("base64")}` }, () => {
    assert.throws(() => encryptPii("x"), /32바이트/);
  });
  withEnv({ PII_ENC_KEY_CURRENT: KEY_A /* kid 없음 */ }, () => {
    assert.throws(() => encryptPii("x"), /형식 오류/);
  });
});

// ── 3. 변조 감지 (GCM auth tag) ─────────────────────────────

test("암호문 본문 변조 → decrypt throw (부분 평문 반환 절대 금지)", () => {
  withKeyA(() => {
    const enc = encryptPii("주민번호급 민감정보 010-1234-5678");
    const parts = enc.split(":"); // enc v1 kid iv tag ct
    const ct = Buffer.from(parts[5], "base64");
    ct[0] ^= 0xff;
    parts[5] = ct.toString("base64");
    assert.throws(() => decryptPii(parts.join(":")));
  });
});

test("auth tag 변조 → decrypt throw", () => {
  withKeyA(() => {
    const enc = encryptPii("tag tamper");
    const parts = enc.split(":");
    const tag = Buffer.from(parts[4], "base64");
    tag[15] ^= 0x01;
    parts[4] = tag.toString("base64");
    assert.throws(() => decryptPii(parts.join(":")));
  });
});

test("kid만 같고 키가 다르면 복호화 throw (쓰레기 평문 반환 금지)", () => {
  const enc = withKeyA(() => encryptPii("cross-key"));
  withEnv({ PII_ENC_KEY_CURRENT: `1:${KEY_B}` }, () => {
    assert.throws(() => decryptPii(enc));
  });
});

test("포맷 깨진 암호문(필드 수·iv/tag 길이) throw", () => {
  withKeyA(() => {
    assert.throws(() => decryptPii("enc:v1:1:AAAA"), /포맷 오류/);
    const enc = encryptPii("x");
    const parts = enc.split(":");
    parts[3] = Buffer.alloc(8).toString("base64"); // iv 12→8바이트
    assert.throws(() => decryptPii(parts.join(":")), /길이 오류/);
  });
});

// 의도된 소프트 동작(점진 마이그레이션): 프리픽스 없는 값은 평문으로 간주해 그대로 반환.
// 마이그레이션 완료 후 이 동작을 hard-throw로 조이면 이 테스트를 함께 갱신할 것.
test("[공존기 계약] 프리픽스 없는 값은 평문 패스스루", () => {
  withKeyA(() => {
    assert.equal(decryptPii("아직 암호화 안 된 기존 행"), "아직 암호화 안 된 기존 행");
  });
});

// ── 4. 키 회전 (kid) ────────────────────────────────────────

test("키 회전: 구키(kid=1) 암호문을 CURRENT=2 + PREVIOUS=1 에서 복호화", () => {
  const legacy = withKeyA(() => encryptPii("회전 전 데이터"));
  withEnv({ PII_ENC_KEY_CURRENT: `2:${KEY_B}`, PII_ENC_KEY_PREVIOUS: `1:${KEY_A}` }, () => {
    assert.equal(decryptPii(legacy), "회전 전 데이터");
    assert.equal(needsReencrypt(legacy), true, "구 kid는 재암호화 대상");
    const fresh = encryptPii("회전 후 데이터");
    assert.ok(fresh.startsWith("enc:v1:2:"), "신규 암호화는 항상 CURRENT kid");
    assert.equal(needsReencrypt(fresh), false);
  });
  // PREVIOUS 제거(회전 완료) 후 구키 암호문은 명시적으로 실패해야 함 — 조용한 데이터 오염 방지
  withEnv({ PII_ENC_KEY_CURRENT: `2:${KEY_B}` }, () => {
    assert.throws(() => decryptPii(legacy), /kid=1/);
  });
});

test("needsReencrypt: 평문·null 판정", () => {
  withKeyA(() => {
    assert.equal(needsReencrypt("평문 값"), true);
    assert.equal(needsReencrypt(null), false);
    assert.equal(needsReencrypt(""), false);
  });
});

// ── 5. HMAC 검색 인덱스·마스킹 ──────────────────────────────

test("hmacIndex: 결정성 + 키 없으면 fail-closed", () => {
  withEnv({ PII_INDEX_KEY: IDX_KEY }, () => {
    const a = hmacIndex("821012345678");
    assert.equal(a, hmacIndex("821012345678"), "같은 입력 → 같은 인덱스 (equality 검색)");
    assert.notEqual(a, hmacIndex("821012345679"));
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(safeEqualHex(a, a), true);
    assert.equal(safeEqualHex(a, hmacIndex("821012345679")), false);
  });
  withEnv({}, () => {
    assert.throws(() => hmacIndex("x"), /PII_INDEX_KEY/);
  });
});

test("phoneIndex: 표기 흔들림(하이픈·공백·+82) 정규화 후 동일 인덱스", () => {
  withEnv({ PII_INDEX_KEY: IDX_KEY }, () => {
    assert.equal(normalizePhone("+82 10-1234-5678"), "821012345678");
    assert.equal(phoneIndex("010-1234-5678"), phoneIndex("01012345678"));
  });
});

test("maskPhone: 가운데 자리 마스킹, 초단문은 전체 마스킹", () => {
  assert.equal(maskPhone("010-1234-5678"), "010-****-5678");
  assert.equal(maskPhone("123"), "***");
});
