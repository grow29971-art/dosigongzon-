// 1000명 이벤트 키링 응모 API.
// 자격: 본인이 등록한 고양이 1마리 이상.
// 입력: { cat_id } — 본인이 돌보는 고양이 ID. 그 아이 모양으로 커스텀 키링 제작.

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

  // 입력 파싱
  let body: { cat_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* 빈 body 허용 안 함 */
  }
  const catId = body.cat_id;
  if (!catId || typeof catId !== "string") {
    return Response.json({ error: "키링으로 제작할 고양이를 골라주세요" }, { status: 400 });
  }

  // 본인 소유 고양이인지 검증 + 키링 정보 가져오기
  const { data: cat, error: catErr } = await supabase
    .from("cats")
    .select("id, name, photo_url, caretaker_id")
    .eq("id", catId)
    .maybeSingle();
  if (catErr || !cat) {
    return Response.json({ error: "고양이를 찾을 수 없어요" }, { status: 404 });
  }
  if (cat.caretaker_id !== user.id) {
    return Response.json({ error: "본인이 등록한 고양이만 응모할 수 있어요" }, { status: 403 });
  }

  // 응모 INSERT — name/cat_photo_url은 선택한 고양이 정보 자동 스냅샷
  const { error: insertErr } = await supabase
    .from("event_keyring_entries")
    .insert({
      user_id: user.id,
      cat_id: cat.id,
      name: cat.name,
      cat_photo_url: cat.photo_url,
    });
  if (insertErr) {
    if (insertErr.code === "23505") {
      return Response.json({ error: "이미 응모하셨어요" }, { status: 409 });
    }
    console.error("[event/keyring] insert failed:", insertErr);
    return Response.json({ error: "응모 등록 실패" }, { status: 500 });
  }

  // admin inquiry 자동 등록
  try {
    const nickname =
      (user.user_metadata?.nickname as string | undefined)
      ?? user.email?.split("@")[0]
      ?? "익명";
    await supabase.from("inquiries").insert({
      user_id: user.id,
      subject: `[1000명 이벤트] ${nickname} 키링 응모 (${cat.name})`,
      body: `${nickname} 님이 본인이 돌보는 고양이 "${cat.name}" 모양 키링 제작에 응모했어요.`,
      status: "pending",
    });
  } catch (err) {
    console.error("[event/keyring] admin notification failed:", err);
  }

  return Response.json({ ok: true, cat: { id: cat.id, name: cat.name } });
}
