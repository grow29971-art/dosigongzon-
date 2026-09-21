import { API_BASE, supabase } from "./supabase";

// 본 앱 화면들이 부르는 상대 경로 `/api/...`를 dosigongzon.com으로 돌리고, 쿠키 대신
// Supabase 액세스 토큰을 Authorization: Bearer로 붙인다(본 앱 lib/supabase/server.ts가 Bearer를 세션으로 인식).
// 미니앱 오리진(tossmini.com)에는 API가 없으므로 이 브릿지 없이는 모든 fetch("/api/..")가 404다.
export function installApiBridge(): void {
  const w = window as Window & { __apiBridged?: boolean };
  if (w.__apiBridged) return;
  w.__apiBridged = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith("/api/")) return orig(input, init);
    url = `${API_BASE}${url}`;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) {
      const { data } = await supabase().auth.getSession();
      if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
    }
    return orig(url, { ...init, headers, credentials: "omit" });
  };
}
