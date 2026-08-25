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

// 다크 뉴트럴 단일 표면 (2026-08-13 UIUX 오딧): variant는 아이콘 색으로만 구분.
// 파스텔 배경 4종은 폐기 — 표면이 화면마다 다르면 시스템 알림으로 안 읽힌다.
const VARIANT_ICON: Record<Variant, { iconColor: string; Icon: typeof CheckCircle2 }> = {
  success: { iconColor: "#4ADE80", Icon: CheckCircle2 },
  error:   { iconColor: "#FF7A85", Icon: AlertCircle },
  warn:    { iconColor: "var(--color-warning)", Icon: AlertTriangle },
  info:    { iconColor: "var(--color-gray-400)", Icon: Info },
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
  const { iconColor, Icon } = VARIANT_ICON[item.variant];
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    // 다음 tick에 entered=true로 → transition 동작
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="pointer-events-auto flex items-start gap-2 px-4 py-3 w-full max-w-sm transition-all"
      style={{
        background: "rgba(33,29,23,0.94)",
        borderRadius: "var(--radius-input)",
        boxShadow: "var(--shadow-modal)",
        transform: entered ? "translateY(0)" : "translateY(-20px)",
        opacity: entered ? 1 : 0,
      }}
      role="status"
    >
      <Icon size={16} className="shrink-0 mt-0.5" style={{ color: iconColor }} />
      <p
        className="flex-1 leading-snug font-medium"
        style={{ fontSize: "var(--text-label)", color: "#FFFFFF" }}
      >
        {item.message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md press-strong"
        aria-label="닫기"
      >
        <X size={12} style={{ color: "var(--color-gray-500)" }} />
      </button>
    </div>
  );
}
