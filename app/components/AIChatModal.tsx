"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Send, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getDisplayName } from "@/lib/cats-repo";

/* ═══ 타입 ═══ */
interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

/* ═══ 컴포넌트 ═══ */
export default function AIChatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const displayName = useMemo(() => getDisplayName(user), [user]);
  // 호칭: "XX님" 형태
  const addressName = useMemo(() => {
    if (!displayName || displayName === "익명") return "집사님";
    return displayName.endsWith("님") ? displayName : `${displayName}님`;
  }, [displayName]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      text: `안녕하세요 ${addressName}! 도시공존 AI 집사예요 🐱\n길고양이 돌봄에 대해 궁금한 점이 있으시면 편하게 물어보세요!`,
    },
  ]);

  // 유저가 바뀌면(또는 처음 로드되면) 초기 인사말도 이름에 맞춰 갱신
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 0 && m.role === "ai"
          ? {
              ...m,
              text: `안녕하세요 ${addressName}! 도시공존 AI 집사예요 🐱\n길고양이 돌봄에 대해 궁금한 점이 있으시면 편하게 물어보세요!`,
            }
          : m,
      ),
    );
  }, [addressName]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // 클라이언트에서만 portal root 설정
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // 스크롤 하단 유지
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // 모달 열릴 때 인풋 포커스 + body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: idRef.current++, role: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // 대화 히스토리 전달 (초기 인사 제외, 최근 10개만)
      const history = updatedMessages
        .slice(1)
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, userName: displayName }),
      });

      const data = await res.json();

      if (!res.ok) {
        const debugInfo = data.debug ? `\n\n[디버그] ${data.debug}` : "";
        throw new Error(`${data.error || "응답 오류"}${debugInfo}`);
      }

      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: "ai", text: data.reply },
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "알 수 없는 오류";
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: "ai",
          text: `죄송해요, 잠시 문제가 생겼어요 😿\n\n${reason}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 바텀 시트 */}
      <div
        className="relative mt-auto w-full flex flex-col rounded-t-[32px]"
        style={{ height: "85dvh", backgroundColor: "#F5F3EE" }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(196,126,90,0.1)" }}
            >
              <Bot size={20} color="#C47E5A" />
            </div>
            <div>
              <p className="text-[15px] font-bold" style={{ color: "#2A2A28" }}>도시공존 AI 집사</p>
              <p className="text-[11px]" style={{ color: "#7A756E" }}>
                {loading ? "AI가 답변을 생각 중이에요..." : "길고양이 돌봄 전문가"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ backgroundColor: "#EEEAE2" }}
          >
            <X size={18} color="#7A756E" />
          </button>
        </div>

        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[80%] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line"
                style={
                  msg.role === "user"
                    ? {
                        backgroundColor: "#C47E5A",
                        color: "#fff",
                        borderRadius: "20px 20px 8px 20px",
                      }
                    : {
                        backgroundColor: "#FFFFFF",
                        color: "#2A2A28",
                        borderRadius: "20px 20px 20px 8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* 로딩 인디케이터 */}
          {loading && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3 flex items-center gap-1.5"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "20px 20px 20px 8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "rgba(196,126,90,0.4)", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "rgba(196,126,90,0.4)", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "rgba(196,126,90,0.4)", animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <div
          className="px-4 py-3 border-t"
          style={{
            borderColor: "#E5E0D6",
            backgroundColor: "#FFFFFF",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
              }}
              placeholder="길고양이에 대해 물어보세요..."
              className="flex-1 rounded-2xl px-4 py-3 text-[14px] outline-none transition"
              style={{
                backgroundColor: "#EEEAE2",
                color: "#2A2A28",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-40"
              style={{ backgroundColor: "#C47E5A" }}
            >
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
