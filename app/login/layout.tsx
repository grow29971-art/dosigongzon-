import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  description: "도시공존 계정으로 로그인하세요. 구글·카카오·이메일 로그인을 지원해요.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
