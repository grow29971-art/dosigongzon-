import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

// 앱인토스 미니앱(city-toss/)은 tossmini.com 오리진에서 쿠키 없이 API를 부른다 — 대신 Supabase 액세스 토큰을
// Authorization: Bearer로 보낸다. 쿠키 세션이 없고 Bearer가 있으면 그 토큰을 세션 쿠키 형태로 합성해 넣어
// getUser()·RLS 쿼리가 본 앱과 같은 코드 경로로 동작하게 한다. 위조 토큰은 getUser()가 auth 서버에서 거절한다.
function bearerCookie(auth: string | null, url: string): { name: string; value: string } | null {
  const m = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(auth ?? "");
  if (!m) return null;
  const token = m[1];
  let payload: { sub?: string; exp?: number; email?: string; role?: string; app_metadata?: unknown; user_metadata?: unknown };
  try { payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { return null; }
  if (!payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) return null;
  const ref = new URL(url).hostname.split(".")[0];
  const session = {
    access_token: token,
    refresh_token: "",
    token_type: "bearer",
    expires_at: payload.exp,
    expires_in: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
    user: { id: payload.sub, aud: "authenticated", role: payload.role ?? "authenticated", email: payload.email ?? null, app_metadata: payload.app_metadata ?? {}, user_metadata: payload.user_metadata ?? {}, created_at: "" },
  };
  return { name: `sb-${ref}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}` };
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  let synthesized: { name: string; value: string } | null = null;
  if (!cookieStore.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) {
    try { synthesized = bearerCookie((await headers()).get("authorization"), url); } catch { /* 정적 렌더 등 headers() 불가 */ }
  }

  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll();
          return synthesized ? [...all, synthesized] : all;
        },
        setAll(cookiesToSet) {
          if (synthesized) return; // Bearer 세션은 쿠키로 되돌려 쓰지 않는다
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출 시 무시
          }
        },
      },
    }
  );
}
