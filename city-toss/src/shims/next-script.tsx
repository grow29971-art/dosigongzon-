import { useEffect } from "react";

// next/script 대체 — src를 head에 1회 주입.
export default function Script({ src, onLoad, id }: { src?: string; onLoad?: () => void; id?: string; strategy?: string; children?: unknown }) {
  useEffect(() => {
    if (!src) return;
    if (document.querySelector(`script[src="${src}"]`)) { onLoad?.(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true; if (id) s.id = id;
    s.onload = () => onLoad?.();
    document.head.appendChild(s);
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
