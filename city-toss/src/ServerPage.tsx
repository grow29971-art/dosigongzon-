import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router";
import { NextNavError } from "./shims/next-navigation";

// 본 앱의 async 서버 컴포넌트 페이지를 클라이언트에서 돌리는 어댑터.
// 서버 페이지는 "params/searchParams Promise를 받아 JSX를 돌려주는 async 함수"라 컴포넌트가 아니라
// 함수로 호출한 뒤 결과 JSX를 그린다(훅이 없으므로 안전). notFound/redirect는 shim이 던지는 예외로 처리.
type PageFn = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactNode>;
type Loader = () => Promise<{ default: PageFn }>;

export default function ServerPage({ load }: { load: Loader }) {
  const params = useParams();
  const [sp] = useSearchParams();
  const { pathname, search } = useLocation();
  const [node, setNode] = useState<ReactNode>(null);
  const [state, setState] = useState<"loading" | "ok" | "notFound" | "error">("loading");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onRefresh = () => setTick((t) => t + 1);
    window.addEventListener("miniapp:refresh", onRefresh);
    return () => window.removeEventListener("miniapp:refresh", onRefresh);
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    const spObj: Record<string, string | string[]> = {};
    sp.forEach((v, k) => { const prev = spObj[k]; spObj[k] = prev === undefined ? v : ([] as string[]).concat(prev, v); });
    const cleanParams = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? ""]));
    load()
      .then((m) => m.default({ params: Promise.resolve(cleanParams), searchParams: Promise.resolve(spObj) }))
      .then((n) => { if (!alive) return; setNode(n); setState("ok"); })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof NextNavError) {
          if (e.kind === "redirect" && e.to) { setRedirectTo(e.to); return; }
          setState("notFound"); return;
        }
        console.error("[ServerPage]", pathname, e);
        setState("error");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search, tick]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;
  if (state === "loading") return <div className="flex items-center justify-center min-h-[50vh] text-sm" style={{ color: "var(--color-text-light)" }}>불러오는 중…</div>;
  if (state === "notFound") return <div className="flex items-center justify-center min-h-[50vh] text-sm" style={{ color: "var(--color-text-light)" }}>페이지를 찾을 수 없어요</div>;
  if (state === "error") return <div className="flex items-center justify-center min-h-[50vh] text-sm" style={{ color: "var(--color-danger, #d1433b)" }}>불러오지 못했어요. 잠시 후 다시 열어 주세요.</div>;
  return <>{node}</>;
}
