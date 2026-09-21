import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import aitDevtools from "@apps-in-toss/devtools/unplugin";
import tailwind from "@tailwindcss/postcss";
import path from "node:path";
import fs from "node:fs";

// 본 앱(../app, ../lib)의 클라이언트 화면·repo를 그대로 번들한다. Next 전용 모듈(next/link·navigation·
// image·dynamic·cache 등)은 src/shims/의 react-router 구현으로 치환하고, 쿠키 세션 Supabase 클라이언트
// 3종은 localStorage 세션 클라이언트 하나로 묶는다(iOS WebView 서드파티 쿠키 차단).
const ROOT = path.resolve(__dirname, "..");
const shim = (name: string) => path.resolve(__dirname, "src/shims", name);

// 본 앱 .env.local의 NEXT_PUBLIC_* 공개 값을 그대로 쓴다(전부 브라우저 노출 가능한 값).
function readPublicEnv(): Record<string, string> {
  const out: Record<string, string> = { NODE_ENV: process.env.NODE_ENV ?? "production" };
  for (const f of [".env", ".env.local"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^(NEXT_PUBLIC_[A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim();
    }
  }
  const mine = (k: string) => process.env[k] ?? "";
  out.NEXT_PUBLIC_SUPABASE_URL ||= mine("VITE_SUPABASE_URL");
  out.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= mine("VITE_SUPABASE_ANON_KEY");
  // 카카오 키는 미니앱 전용(VITE_KAKAO_JS_KEY, tossmini 도메인 등록본)이 본 앱 키(dosigongzon.com 등록본)보다 우선 —
  // 본 앱 키로 로드하면 도메인 불일치로 SDK 403 → "지도를 불러올 수 없어요"(9/21 실기기 실측).
  if (mine("VITE_KAKAO_JS_KEY")) { out.NEXT_PUBLIC_KAKAO_MAP_KEY = mine("VITE_KAKAO_JS_KEY"); out.NEXT_PUBLIC_KAKAO_JS_KEY = mine("VITE_KAKAO_JS_KEY"); }
  // 미니앱에서 꺼 두는 것: 웹푸시·픽셀·터스타일·토스페이먼츠 위젯
  for (const k of ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "NEXT_PUBLIC_META_PIXEL_ID", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_TOSS_CLIENT_KEY"]) delete out[k];
  return out;
}

export default defineConfig(({ mode }) => {
  // city-toss/.env.local의 VITE_* 도 process.env로 올려 readPublicEnv가 보게 한다
  for (const f of [".env", `.env.${mode}`, ".env.local", `.env.${mode}.local`]) {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^(VITE_[A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").trim();
    }
  }
  return {
    plugins: [aitDevtools.vite(), react()],
    resolve: {
      alias: [
        { find: "@/lib/supabase/client", replacement: shim("supabase-client.ts") },
        { find: "@/lib/supabase/server", replacement: shim("supabase-server.ts") },
        { find: "@/lib/supabase/anon", replacement: shim("supabase-anon.ts") },
        { find: "@/lib/supabase/service", replacement: shim("forbidden.ts") },
        { find: "@/lib/html-sanitize-server", replacement: shim("html-sanitize-server.ts") },
        { find: "@", replacement: ROOT },
        { find: "next/link", replacement: shim("next-link.tsx") },
        { find: "next/navigation", replacement: shim("next-navigation.ts") },
        { find: "next/image", replacement: shim("next-image.tsx") },
        { find: "next/dynamic", replacement: shim("next-dynamic.ts") },
        { find: "next/script", replacement: shim("next-script.tsx") },
        { find: "next/cache", replacement: shim("next-cache.ts") },
        { find: "next/headers", replacement: shim("forbidden.ts") },
        { find: "@sentry/nextjs", replacement: shim("sentry.ts") },
        { find: "server-only", replacement: shim("empty.ts") },
      ],
      dedupe: ["react", "react-dom", "@supabase/supabase-js"],
    },
    define: { "process.env": JSON.stringify(readPublicEnv()) },
    css: { postcss: { plugins: [tailwind({ base: ROOT })] } },
    server: { port: 5173, fs: { allow: [ROOT] } },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        onwarn(w, warn) {
          if (w.code === "MODULE_LEVEL_DIRECTIVE") return; // "use client"
          warn(w);
        },
      },
    },
  };
});
