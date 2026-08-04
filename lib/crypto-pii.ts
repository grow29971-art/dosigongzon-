// ══════════════════════════════════════════════════════════════
// PII 앱계층 암호화 헬퍼 (초안 — 아직 어디서도 import하지 않음)
//
// 용도: orders.recipient_phone / recipient_address 등 개인정보 컬럼과
//       (도입 시) billing_keys.billing_key_enc 암호화.
//
// 방식: AES-256-GCM (node:crypto) + 키버전 태그.
//   - 암호문 포맷: enc:v1:<kid>:<iv b64>:<tag b64>:<ct b64>
//   - kid(키 ID)가 암호문에 박혀 있어 키 회전 시 구·신 키가 공존 가능.
//
// 검색 문제: 암호화하면 equality 검색·정렬이 깨진다.
//   → 검색이 필요한 컬럼(전화번호)은 결정적 HMAC 인덱스 컬럼을 병행.
//     예) recipient_phone_idx = hmacIndex(normalizePhone(phone))
//     WHERE recipient_phone_idx = hmacIndex('01012345678') 로 equality 검색.
//   주소처럼 검색 안 하는 컬럼은 인덱스 없이 암호화만.
//
// 환경변수 (모두 서버 전용 — Vercel Dashboard에만 등록, NEXT_PUBLIC 금지):
//   PII_ENC_KEY_CURRENT  = "<kid>:<base64 32bytes>"   예) "1:q3Zk...=="
//   PII_ENC_KEY_PREVIOUS = "<kid>:<base64 32bytes>"   (회전 중에만, 평시 미설정)
//   PII_INDEX_KEY        = "<base64 32bytes>"          (HMAC 인덱스용 — 회전 금지*)
//   * 인덱스 키를 바꾸면 전 행 재인덱싱 필요. 유출 시에만 교체 + 배치 재인덱싱.
//
// 키 생성: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// 키 회전 절차:
//   1) 새 키 생성 → PII_ENC_KEY_PREVIOUS에 기존 CURRENT 값 복사,
//      PII_ENC_KEY_CURRENT를 "2:<새키>"로 교체 → 재배포.
//   2) 배치: decryptPii→encryptPii로 전 행 재암호화 (kid가 다르면 재암호화 대상).
//   3) 전 행이 새 kid가 되면 PII_ENC_KEY_PREVIOUS 제거.
// ══════════════════════════════════════════════════════════════
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_LEN = 12; // GCM 권장 96bit
const TAG_LEN = 16;

type KeyEntry = { kid: string; key: Buffer };

function parseKeyEnv(name: string, raw: string | undefined): KeyEntry | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i <= 0) throw new Error(`${name} 형식 오류 — "<kid>:<base64 32bytes>" 이어야 함`);
  const kid = raw.slice(0, i).trim();
  const key = Buffer.from(raw.slice(i + 1).trim(), "base64");
  if (key.length !== 32) throw new Error(`${name} 키 길이 오류 — base64 디코드 후 32바이트여야 함`);
  return { kid, key };
}

function currentKey(): KeyEntry {
  const k = parseKeyEnv("PII_ENC_KEY_CURRENT", process.env.PII_ENC_KEY_CURRENT);
  if (!k) throw new Error("PII_ENC_KEY_CURRENT 미설정 — PII 암호화 불가(fail-closed)");
  return k;
}

function keyByKid(kid: string): Buffer {
  const cur = parseKeyEnv("PII_ENC_KEY_CURRENT", process.env.PII_ENC_KEY_CURRENT);
  if (cur?.kid === kid) return cur.key;
  const prev = parseKeyEnv("PII_ENC_KEY_PREVIOUS", process.env.PII_ENC_KEY_PREVIOUS);
  if (prev?.kid === kid) return prev.key;
  throw new Error(`PII 복호화 실패 — kid=${kid} 키를 찾을 수 없음(회전 중 PREVIOUS 누락?)`);
}

/** 평문 → "enc:v1:<kid>:<iv>:<tag>:<ct>" (빈 문자열/null은 그대로 통과) */
export function encryptPii(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return plain ?? null;
  const { kid, key } = currentKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${kid}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** 암호문 → 평문. 마이그레이션 공존기: 암호문 포맷이 아니면 평문으로 간주하고 그대로 반환. */
export function decryptPii(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // 아직 미암호화 행(점진 마이그레이션)
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 4) throw new Error("PII 암호문 포맷 오류");
  const [kid, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error("PII 암호문 필드 길이 오류");
  const decipher = createDecipheriv("aes-256-gcm", keyByKid(kid), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

/** 재암호화 필요 여부(키 회전 배치용): 평문이거나 kid가 현재 키와 다르면 true */
export function needsReencrypt(value: string | null | undefined): boolean {
  if (value == null || value === "") return false;
  if (!value.startsWith(PREFIX)) return true;
  return value.slice(PREFIX.length).split(":")[0] !== currentKey().kid;
}

// ── 검색용 결정적 인덱스 (HMAC-SHA256) ─────────────────────────
// 같은 입력 → 같은 출력이므로 equality 검색 가능. 원문 복원은 불가.
// 저장: 별도 *_idx 컬럼(text) + btree 인덱스. LIKE/부분검색은 불가 — 필요하면
// 마지막 4자리 등 저민감 파생값을 평문 컬럼으로 따로 두는 방식으로 해결.

function indexKey(): Buffer {
  const raw = process.env.PII_INDEX_KEY;
  if (!raw) throw new Error("PII_INDEX_KEY 미설정 — 인덱스 생성 불가(fail-closed)");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new Error("PII_INDEX_KEY 길이 오류 — base64 32바이트여야 함");
  return key;
}

/** 전화번호 정규화: 숫자만 남김 ("+82 10-1234-5678" → "821012345678") */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** 결정적 검색 인덱스. 전화번호는 반드시 normalizePhone 후 호출. */
export function hmacIndex(normalized: string): string {
  return createHmac("sha256", indexKey()).update(normalized, "utf8").digest("hex");
}

/** 편의: 전화번호 → 인덱스 값 */
export function phoneIndex(phone: string): string {
  return hmacIndex(normalizePhone(phone));
}

/** 인덱스 비교(상수시간) — 토큰류 비교 시 사용 */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** 표시용 마스킹: "010-1234-5678" → "010-****-5678" */
export function maskPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length < 7) return "***";
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}
