import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import PushSubscriber from "@/app/components/PushSubscriber";
import "./globals.css";

export const metadata: Metadata = {
  title: "도시공존",
  description: "길고양이와 사람이 함께하는 커뮤니티",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "도시공존",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F5F3EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <PushSubscriber />
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js")`,
          }}
        />
      </body>
    </html>
  );
}
