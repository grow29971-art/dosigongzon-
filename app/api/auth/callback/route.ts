import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 내부 경로만 허용. `//host`, `/\host`, 스킴 포함 URL은 모두 거부 → open-redirect 차단.
function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 약관 동의 일시 기록 (소셜 로그인 첫 가입 시)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ terms_agreed_at: new Date().toISOString() })
          .eq("id", user.id)
          .is("terms_agreed_at", null);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
