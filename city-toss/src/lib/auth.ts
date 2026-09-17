import { TossAuth, getOperationalEnvironment } from "@apps-in-toss/web-framework";
import type { Session } from "@supabase/supabase-js";
import { API_BASE, supabase } from "./supabase";

// 토스 로그인 → 본 앱 브릿지(/api/toss/login) → Supabase 세션.
// 클라이언트는 인가 코드만 받아 넘긴다. 토큰 교환·사용자 조회·복호화·계정 매핑은 전부 서버가 한다.
// 서버는 magiclink token_hash를 돌려주고, 여기서 verifyOtp로 세션을 만든다.
export async function loginWithToss(): Promise<Session> {
  const { authorizationCode, referrer } = await TossAuth.login();

  const res = await fetch(`${API_BASE}/api/toss/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorizationCode, referrer, env: getOperationalEnvironment() }),
  });
  const body = (await res.json().catch(() => ({}))) as { token_hash?: string; error?: string };
  if (!res.ok || !body.token_hash) {
    throw new Error(body.error ?? `로그인 서버 응답 오류 (${res.status})`);
  }

  const { data, error } = await supabase().auth.verifyOtp({ token_hash: body.token_hash, type: "magiclink" });
  if (error || !data.session) throw new Error(error?.message ?? "세션을 만들지 못했어요.");
  return data.session;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
}
