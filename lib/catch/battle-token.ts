// 수동 배틀 결과 위조/재사용 방지용 서명 토큰 — 냥줍 lib/battle-token.ts 이식 (2026-08-04 P4).
//
// 문제: /api/catch/battle/record는 winner·opp_cat_id 등을 클라이언트가 보낸 값
// 그대로 받는다(수동 배틀은 턴 진행이 클라이언트에서 일어나서). 토큰 없이는 매칭
// API를 거치지 않고 임의의 opp_cat_id로 반복 호출해 코인·경험치를 무한 파밍하거나
// 타인 카드의 win_streak을 리셋시킬 수 있다. 이 토큰이 "실제로 매칭된 상대에
// 대해서만" 기록을 인정하게 막는다.
//
// [냥줍 2026-07-16 보안점검 계승] 상태 없는 순수 HMAC은 유효기간 안에서 재제출
// (replay) 파밍이 가능하다 → 발급 시 jti(랜덤 nonce)를 서명에 포함하고, /record가
// catch_battle_tokens_used에 jti를 소비 기록(1회용)해 재사용을 차단한다.
//
// 서명 키는 이미 서버에만 있는 SUPABASE_SERVICE_ROLE_KEY를 재사용 — 새 환경변수 불필요.

import "server-only"; // 클라이언트 번들에 실리면 빌드 에러 — 서명 키(SERVICE_ROLE_KEY) 유출 원천 차단
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

export interface BattleTokenPayload {
  myCatId: string;
  oppId: string;
  isBoss: boolean;
  exp: number; // 만료 시각(ms epoch)
  jti: string; // 1회용 nonce — /record가 소비 기록으로 재사용(replay)을 차단한다
}

function secretKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return key;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// jti는 서버가 발급 — 호출부는 그대로 {myCatId,oppId,isBoss,exp}만 넘기면 된다.
export function signBattleToken(payload: Omit<BattleTokenPayload, "jti"> & { jti?: string }): string {
  const full: BattleTokenPayload = { ...payload, jti: payload.jti ?? randomUUID() };
  const body = b64url(JSON.stringify(full));
  const sig = createHmac("sha256", secretKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyBattleToken(token: unknown): BattleTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = createHmac("sha256", secretKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BattleTokenPayload;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    // 1회용 nonce가 없는 토큰은 소비 기록을 못 하므로 거절 — replay 방어의 전제
    if (typeof payload.jti !== "string" || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}
