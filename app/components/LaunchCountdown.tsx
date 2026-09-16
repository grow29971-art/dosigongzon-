// 정식 출시 배너 — HomeLanding·HomeAuthed·signup 최상단에 표시.
// 2026-06-01 정식 출시. 안드로이드 앱이 Play 스토어에 올라가 다운로드 링크로 연결.
// 정적 배너라 시간 계산·CLS placeholder 불필요.
// 2026-09-16 「익숙한 동네앱」 리디자인: 이모지·반짝이 제거, primary 한 줄 바.

import { Rocket, ChevronRight } from "lucide-react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.dosigongzon.app";

export default function LaunchCountdown() {
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-5 py-2.5 flex items-center justify-center gap-2 press transition-transform"
      style={{
        background: "var(--color-primary)",
        color: "var(--color-surface)",
      }}
    >
      <Rocket size={14} className="shrink-0" />
      <span className="text-[13px] font-semibold whitespace-nowrap">
        도시공존 출시! Play 스토어에서 다운로드
      </span>
      <ChevronRight size={14} className="shrink-0" />
    </a>
  );
}
