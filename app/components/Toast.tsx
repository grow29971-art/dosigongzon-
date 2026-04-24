"use client";

// 전역 토스트 알림 시스템.
// - alert()을 대체해서 UX 개선 (blocking → 비동기, 네이티브 스타일 제거)
// - 4가지 variant: success / error / warn / info
// - 우측 상단 스택, 4초 auto-dismiss, 클릭 시 즉시 닫힘
//
// 사용법:
//   const toast = useToast();
//   toast.success("저장됐어요");
//   toast.error("실패했어요", { duration: 6000 });

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

type Variant = "success" | "error" | "warn" | "info";

interface ToastItem {
  id: number;
  variant: Variant;
  message: string;
}

interface ToastOptions {
  duration?: number;
}

interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void;
  error: (message: string, opts?: ToastOptions) => void;
  warn: (message: string, opts?: ToastOptions) => void;
  info: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT_STYLE: Record<Variant, { bg: string; border: string; color: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: "#E8F4E8", border: "#C8E0C8", color: "#3F5B42", Icon: CheckCircle2 },
  error:   { bg: "#FBEAEA", border: "#E8C5C5", color: "#8B2F2F", Icon: AlertCircle },
  warn:    { bg: "#FFF4E0", border: "#F5DAB0", color: "#6F4910", Icon: AlertTriangle },
  info:    { bg: "#F0F6FF", border: "#C9DBF5", color: "#22457A", Icon: Info },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: Variant, message: string, opts?: ToastOptions) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-4), { id, variant, message }]); // 최대 5개
    const duration = opts?.duration ?? 4000;
    setTimeout(() => remove(id), duration);
  }, [remove]);

  const api = useMemo<ToastApi>(() => ({
    success: (m, o) => push("success", m, o),
    error: (m, o) => push("error", m, o),
    warn: (m, o) => push("warn", m, o),
    info: (m, o) => push("info", m, o),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Provider 없이 쓰이면 console + alert 폴백 (개발 실수 방어)
    return {
      success: (m) => console.log("[toast.success]", m),
      error: (m) => { console.error("[toast.error]", m); if (typeof window !== "undefined") window.alert(m); },
      warn: (m) => { console.warn("[toast.warn]", m); if (typeof window !== "undefined") window.alert(m); },
      info: (m) => console.info("[toast.info]", m),
    };
  }
  return ctx;
}

/* ═══ 뷰포트 — fixed 영역에 쌓임 ═══ */
function ToastViewport({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div
      className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { bg, border, color, Icon } = VARIANT_STYLE[item.variant];
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // 다음 tick에 entered=true로 → transition 동작
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="pointer-events-auto flex items-start gap-2 rounded-2xl px-3.5 py-2.5 w-full max-w-sm transition-all"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
        transform: entered ? "translateY(0)" : "translateY(-20px)",
        opacity: entered ? 1 : 0,
      }}
      role="status"
    >
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color }} />
      <p className="flex-1 text-[12.5px] leading-snug font-semibold" style={{ color }}>
        {item.message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md active:scale-90"
        aria-label="닫기"
      >
        <X size={12} style={{ color }} />
      </button>
    </div>
  );
}
