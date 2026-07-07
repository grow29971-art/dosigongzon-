import { Black_Han_Sans } from "next/font/google";

// 배틀/카드 화면 전용 "게임 타이틀" 폰트 — 플랫한 웹앱 느낌을 벗고
// 실제 게임처럼 보이게 하려고 이름/숫자/헤더에만 스코프해서 씀.
export const gameFont = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-game",
});
