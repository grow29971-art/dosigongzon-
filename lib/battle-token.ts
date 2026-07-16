// 수동 배틀 결과 위조 방지용 서명 토큰.
//
// 문제: /api/cats/card-battle/record는 winner·opp_cat_id 등을 클라이언트가
// 보낸 값 그대로 신뢰했음(수동 배틀은 턴 진행이 클라이언트에서 일어나서).
// 악의적인 사용자가 매칭 API를 거치지 않고 임의의 opp_cat_id(다른 유저의
// 실제 카드 UUID)를 넣어 반복 호출하면, 그 유저가 한 번도 배틀한 적 없는데도
// 카드의 win_streak이 계속 리셋되는 등 피해를 줄 수 있었고, 자신은 코인·
// 경험치를 무한정 파밍할 수 있었음(완전한 서버측 시뮬레이션 재작성 없이는
// "정말로 이겼는지"까지는 못 막지만, 최소한 "실제로 매칭된 상대에 대해서만"
// 기록을 인정하도록 막는 게 이 토큰의 역할).
//
// /api/cats/card-battle(mode=manual)이 상대를 매칭할 때 이 토큰을 발급해서
// 클라이언트에 내려주고, /record가 그 토큰을 검증해야만 보상을 지급한다.
// 서명 키는 이미 서버에만 있는 SUPABASE_SERVICE_ROLE_KEY를 재사용 —
// 새 환경변수 설정 없이 바로 배포 가능하게.

import { createHmac, timingSafeEqual } from "crypto";

export interface BattleTokenPayload {
  myCatId: string;
  oppId: string;
  isBoss: boolean;
  exp: number; // 만료 시각(ms epoch)
  nonce?: string; // 발급마다 고유 — 같은 매칭 조합이라도 토큰이 항상 달라 단회 소모 판별 가능
}

function secretKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return key;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signBattleToken(payload: BattleTokenPayload): string {
  const body = b64url(JSON.stringify(payload));
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
    return payload;
  } catch {
    return null;
  }
}
