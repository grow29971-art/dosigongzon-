import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installApiBridge } from "./lib/api-bridge";
import "@/app/globals.css";

// 본 앱 코드가 미니앱 환경을 구분하는 표식(lib/miniapp.ts isMiniApp) — 쇼핑·채팅·웹푸시 진입점을 숨긴다.
(window as Window & { __DOSIGONGZON_MINIAPP__?: boolean }).__DOSIGONGZON_MINIAPP__ = true;
installApiBridge();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
