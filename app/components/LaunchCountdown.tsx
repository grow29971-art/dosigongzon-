// 정식 출시 배너 — HomeLanding·HomeAuthed·signup 최상단에 표시.
// 2026-06-01 정식 출시. 안드로이드 앱이 Play 스토어에 올라가 다운로드 링크로 연결.
// 정적 배너라 시간 계산·CLS placeholder 불필요.

import { Rocket, Sparkles } from "lucide-react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.dosigongzon.app";

export default function LaunchCountdown() {
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-5 py-2.5 flex items-center justify-center gap-2 text-white active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(90deg, #5C8DEE 0%, #E86B8C 50%, #5C8DEE 100%)",
      }}
    >
      <Rocket size={14} className="shrink-0" />
      <span className="text-[12.5px] font-extrabold tracking-tight whitespace-nowrap">
        🎉 도시공존 출시!{" "}
        <span
          className="mx-0.5 px-1.5 py-0.5 rounded-md"
          style={{ background: "rgba(255,255,255,0.22)" }}
        >
          Play 스토어에서 다운로드
        </span>
      </span>
      <Sparkles size={11} className="shrink-0" style={{ color: "#FFF7C4" }} />
    </a>
  );
}
