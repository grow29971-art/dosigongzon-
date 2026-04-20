import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "관리자 대시보드",
  description: "도시공존 운영 관리",
  robots: { index: false, follow: false },
};

/**
 * 관리자 전용 서버 가드.
 * 비로그인 또는 비관리자 접근 시 서버에서 즉시 redirect —
 * 민감 UI/번들 노출 차단.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    redirect("/");
  }

  return children;
}
