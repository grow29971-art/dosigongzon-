// 1000명 이벤트 키링 응모 API.
// 로그인 사용자 → INSERT event_keyring_entries + admin inquiry 자동 등록.

import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  // 인증
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // 입력 없이 user_id만으로 INSERT (단순 응모)
  const { error: insertErr } = await supabase
    .from("event_keyring_entries")
    .insert({ user_id: user.id });
  if (insertErr) {
    if (insertErr.code === "23505") {
      return Response.json({ error: "이미 응모하셨어요" }, { status: 409 });
    }
    console.error("[event/keyring] insert failed:", insertErr);
    return Response.json({ error: "응모 등록 실패" }, { status: 500 });
  }

  // admin inquiry 자동 등록 (inbox에 표시)
  try {
    const nickname =
      (user.user_metadata?.nickname as string | undefined)
      ?? user.email?.split("@")[0]
      ?? "익명";
    await supabase.from("inquiries").insert({
      user_id: user.id,
      subject: `[1000명 이벤트] ${nickname} 키링 응모`,
      body: `${nickname} 님이 키링 추첨에 응모했어요. (당첨되면 쪽지로 사진·배송정보 별도 수집)`,
      status: "pending",
    });
  } catch (err) {
    console.error("[event/keyring] admin notification failed:", err);
    // 알림 실패는 무시 (응모 자체는 성공)
  }

  return Response.json({ ok: true });
}
