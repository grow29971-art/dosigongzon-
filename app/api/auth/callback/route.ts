import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

// 랜덤 닉네임 생성 (소셜 로그인 시 실명 대체)
const ADJECTIVES = ["귀여운","용감한","따뜻한","다정한","씩씩한","부지런한","행복한","포근한","착한","똑똑한","수줍은","느긋한","활발한","조용한","밝은"];
const NOUNS = ["집사","냥이","고양이","캣맘","캣대디","돌보미","지킴이","친구","이웃","시민","봉사자","수호자","파수꾼","동반자","벗"];

function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 소셜 로그인 첫 가입: 실명 → 랜덤 닉네임 교체
        const meta = user.user_metadata ?? {};
        const isFirstLogin = !meta.nickname_set;
        const provider = user.app_metadata?.provider;

        if (isFirstLogin && provider && provider !== "email") {
          const nickname = generateNickname();
          await supabase.auth.updateUser({
            data: { nickname, nickname_set: true, full_name: nickname, name: nickname },
          });

          // 초기 서포터 타이틀: 100명까지 자동 부여
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true });
          const earlyTitle = (count ?? 0) <= 100 ? "early_supporter" : null;

          await supabase
            .from("profiles")
            .update({ nickname, terms_agreed_at: new Date().toISOString(), admin_title: earlyTitle })
            .eq("id", user.id);
        } else {
          // 약관 동의 일시 + 초기 서포터 체크
          const { count } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true });
          const earlyTitle = (count ?? 0) <= 100 ? "early_supporter" : null;

          await supabase
            .from("profiles")
            .update({
              terms_agreed_at: new Date().toISOString(),
              ...(earlyTitle ? { admin_title: earlyTitle } : {}),
            })
            .eq("id", user.id)
            .is("admin_title", null);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
