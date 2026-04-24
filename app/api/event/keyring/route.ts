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

  // 입력 검증
  let body: { name?: string; address?: string; phone?: string; cat_photo_url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "요청 형식 오류" }, { status: 400 });
  }
  const name = body.name?.trim();
  const address = body.address?.trim();
  const phone = body.phone?.trim();
  const cat_photo_url = body.cat_photo_url?.trim();
  if (!name || !address || !phone || !cat_photo_url) {
    return Response.json({ error: "모든 항목 필수" }, { status: 400 });
  }
  if (name.length > 20 || address.length > 200 || phone.length > 20) {
    return Response.json({ error: "입력 길이 초과" }, { status: 400 });
  }
  // 사진 URL 화이트리스트 (Supabase Storage)
  if (!cat_photo_url.startsWith(`${supabaseUrl}/storage/v1/object/public/`)) {
    return Response.json({ error: "사진 URL이 유효하지 않아요" }, { status: 400 });
  }

  // INSERT
  const { error: insertErr } = await supabase
    .from("event_keyring_entries")
    .insert({ user_id: user.id, name, address, phone, cat_photo_url });
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
      body: `이름: ${name}\n전화: ${phone}\n주소: ${address}\n사진: ${cat_photo_url}`,
      status: "pending",
    });
  } catch (err) {
    console.error("[event/keyring] admin notification failed:", err);
    // 알림 실패는 무시 (응모 자체는 성공)
  }

  return Response.json({ ok: true });
}
