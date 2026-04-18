import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입",
  description: "도시공존에 가입하고 우리 동네 길고양이 돌봄에 함께해요.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
