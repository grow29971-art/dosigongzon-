"use client";

// 다크모드 강제 반전 진단 페이지 (임시) — 어떤 브라우저가 어떤 방식으로
// 색을 뒤집는지 사용자 폰에서 직접 판별하기 위한 화면.
// 반전은 페인트 단계에서 일어나 JS로 감지 불가 → 육안/스크린샷 비교 방식.
// 문제 해결 후 삭제 예정.

import { useEffect, useRef, useState } from "react";

function browserName(ua: string): string {
  if (/SamsungBrowser/i.test(ua)) return "삼성인터넷";
  if (/; wv\)/.test(ua) || /Version\/[\d.]+ Chrome/i.test(ua)) return "인앱 WebView";
  if (/Chrome\//i.test(ua)) return "크롬";
  if (/Firefox\//i.test(ua)) return "파이어폭스";
  return "기타";
}

export default function DarkCheckPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState({ ua: "", browser: "", prefersDark: false, standalone: false });

  useEffect(() => {
    const ua = navigator.userAgent;
    setInfo({
      ua,
      browser: browserName(ua),
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
    });
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = "#191F28";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("B: 캔버스 (원래 흰색)", 12, 32);
      }
    }
  }, []);

  const box: React.CSSProperties = {
    padding: "18px 14px",
    borderRadius: "var(--radius-square-lg)",
    border: "2px solid #191F28",
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 10,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", color: "#191F28", padding: 20, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>다크모드 진단</h1>
      <p style={{ fontSize: 13, color: "#4E5968", marginBottom: 16 }}>
        이 화면을 캡처해서 보내주세요. 각 박스가 무슨 색으로 보이는지가 중요해요.
      </p>

      <div style={{ ...box, background: "#FFFFFF" }}>A: 일반 배경 (원래 흰색)</div>
      <canvas ref={canvasRef} width={340} height={48} style={{ borderRadius: "var(--radius-square-lg)", border: "2px solid #191F28", display: "block", marginBottom: 10, maxWidth: "100%" }} />
      <div style={{ ...box, background: "none", background: "#FFFFFF" }}>
        C: 그라디언트 배경 (원래 흰색)
      </div>
      <div style={{ ...box, background: "#AD5E3B", color: "#FFFFFF", border: "none" }}>D: 테라코타 (원래 주황갈색)</div>

      <div style={{ marginTop: 20, padding: 14, borderRadius: "var(--radius-square-lg)", background: "#FFFFFF", fontSize: 13, lineHeight: 1.7, wordBreak: "break-all" }}>
        <div><b>브라우저:</b> {info.browser}</div>
        <div><b>시스템 다크모드:</b> {info.prefersDark ? "켜짐" : "꺼짐"}</div>
        <div><b>앱(설치형) 모드:</b> {info.standalone ? "예" : "아니오"}</div>
        <div style={{ marginTop: 8, fontSize: 11, color: "#8B95A1" }}>{info.ua}</div>
      </div>
    </div>
  );
}
