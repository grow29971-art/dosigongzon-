import { createElement, lazy, Suspense, type ComponentType } from "react";

// next/dynamic 대체 — React.lazy + Suspense. ssr 옵션은 무의미(항상 CSR).
type Loader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>;
export default function dynamic<P extends object>(loader: Loader<P>, opts?: { loading?: ComponentType; ssr?: boolean }) {
  const L = lazy(async () => {
    const m = await loader();
    return (typeof m === "object" && m !== null && "default" in m ? m : { default: m }) as { default: ComponentType<P> };
  });
  const fallback = opts?.loading ? createElement(opts.loading) : null;
  return function Dynamic(props: P) {
    return createElement(Suspense, { fallback }, createElement(L, props));
  };
}
