import { Component, useEffect, useState, type ReactNode } from "react";

// 미니앱 안에서는 개발자 도구를 못 연다. 렌더 에러·미처리 예외를 화면 하단에 그대로 보여줘 실기기 증상을 스크린샷으로
// 받을 수 있게 한다(9/22 "페이지가 열렸다 안 열렸다" 진단용). 에러 바운더리는 트리 전체가 사라지는 것도 막는다.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-[13px]" style={{ color: "var(--color-text-main)" }}>
          <p className="font-bold mb-2">화면을 그리지 못했어요</p>
          <pre className="whitespace-pre-wrap break-all text-[11px]" style={{ color: "var(--color-text-sub)" }}>{String(this.state.error?.stack ?? this.state.error)}</pre>
          <button type="button" className="mt-3 px-4 py-2 rounded-xl text-white" style={{ background: "var(--color-primary)" }} onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}>홈으로</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorToast() {
  const [msgs, setMsgs] = useState<string[]>([]);
  useEffect(() => {
    const push = (m: string) => setMsgs((prev) => [...prev.slice(-4), m]);
    const onErr = (e: ErrorEvent) => push(`${e.message} @${(e.filename ?? "").split("/").pop()}:${e.lineno}`);
    const onRej = (e: PromiseRejectionEvent) => push(`(promise) ${e.reason?.message ?? String(e.reason)}`);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  if (msgs.length === 0) return null;
  return (
    <div className="fixed left-2 right-2 z-[9999] p-2 rounded-lg text-[11px] text-white" style={{ bottom: 72, background: "rgba(200,40,40,0.92)" }} onClick={() => setMsgs([])}>
      {msgs.map((m, i) => <div key={i} className="break-all">{m}</div>)}
    </div>
  );
}
