import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams as useRRParams, useSearchParams as useRRSearchParams } from "react-router";
import { isMiniAppBlockedPath } from "./miniapp-routes";

// next/navigation 대체 — react-router 위에 같은 시그니처.
export class NextNavError extends Error {
  constructor(public kind: "notFound" | "redirect", public to?: string) { super(kind); }
}
export function notFound(): never { throw new NextNavError("notFound"); }
export function redirect(to: string): never { throw new NextNavError("redirect", to); }
export function permanentRedirect(to: string): never { throw new NextNavError("redirect", to); }

export function useRouter() {
  const nav = useNavigate();
  const go = useCallback((to: string, replace: boolean) => {
    if (/^https?:\/\//.test(to)) { window.location.href = to; return; }
    nav(isMiniAppBlockedPath(to) ? "/" : to, { replace });
  }, [nav]);
  return useMemo(() => ({
    push: (to: string) => go(to, false),
    replace: (to: string) => go(to, true),
    back: () => nav(-1),
    forward: () => nav(1),
    refresh: () => window.dispatchEvent(new Event("miniapp:refresh")),
    prefetch: () => {},
  }), [go, nav]);
}
export function usePathname(): string { return useLocation().pathname; }
export function useSearchParams(): URLSearchParams { return useRRSearchParams()[0]; }
export function useParams<T = Record<string, string | string[]>>(): T {
  return useRRParams() as unknown as T;
}
export function useSelectedLayoutSegment(): string | null { return null; }
export function useSelectedLayoutSegments(): string[] { return []; }
