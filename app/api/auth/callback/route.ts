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

  // OAuth provider가 에러를 쿼리스트링에 넣어 돌려준 경우
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");
  const oauthErrorCode = searchParams.get("error_code");
  const providerParam = searchParams.get("provider");

  const ua = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const ref = request.headers.get("referer")?.slice(0, 500) ?? null;

  if (oauthError || oauthErrorDesc) {
    try {
      const supabase = await createClient();
      await supabase.from("auth_error_logs").insert({
        provider: providerParam,
        stage: "callback",
        error_code: oauthErrorCode || oauthError,
        error_desc: oauthErrorDesc,
        user_agent: ua,
        url: request.url.slice(0, 1000),
        referrer: ref,
      });
    } catch { /* 로깅 실패 무시 */ }

    const params = new URLSearchParams();
    if (oauthError) params.set("error", oauthError);
    if (oauthErrorCode) params.set("error_code", oauthErrorCode);
    if (oauthErrorDesc) params.set("error_description", oauthErrorDesc);
    if (providerParam) params.set("provider", providerParam);
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      try {
        await supabase.from("auth_error_logs").insert({
          provider: providerParam,
          stage: "exchange",
          error_code: "exchange_failed",
          error_desc: exchangeError.message,
          user_agent: ua,
          url: request.url.slice(0, 1000),
          referrer: ref,
        });
      } catch { /* 로깅 실패 무시 */ }
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&error_description=${encodeURIComponent(exchangeError.message)}`,
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const meta = user.user_metadata ?? {};
      const isFirstLogin = !meta.nickname_set;
      const userProvider = user.app_metadata?.provider;
      // 가입 폼의 선택 동의 값 — 명시적 true일 때만 적용 (기본은 false 유지)
      const emailOptIn = meta.email_opt_in === true;

      if (isFirstLogin && userProvider && userProvider !== "email") {
        const nickname = generateNickname();
        await supabase.auth.updateUser({
          data: { nickname, nickname_set: true, full_name: nickname, name: nickname },
        });

        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        const earlyTitle = (count ?? 0) <= 100 ? "early_supporter" : null;

        await supabase
          .from("profiles")
          .update({
            nickname,
            terms_agreed_at: new Date().toISOString(),
            admin_title: earlyTitle,
            email_digest_enabled: emailOptIn,
          })
          .eq("id", user.id);
      } else {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        const earlyTitle = (count ?? 0) <= 100 ? "early_supporter" : null;

        await supabase
          .from("profiles")
          .update({
            terms_agreed_at: new Date().toISOString(),
            ...(earlyTitle ? { admin_title: earlyTitle } : {}),
            // 이메일 가입 최초 인증 완료 시점에 한해 동의 반영 (중복 업데이트 방지)
            ...(isFirstLogin ? { email_digest_enabled: emailOptIn } : {}),
          })
          .eq("id", user.id)
          .is("admin_title", null);

        // nickname_set 마킹 — 첫 인증 한 번만 opt-in 적용되도록
        if (isFirstLogin && userProvider === "email") {
          await supabase.auth.updateUser({ data: { nickname_set: true } });
        }
      }
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
