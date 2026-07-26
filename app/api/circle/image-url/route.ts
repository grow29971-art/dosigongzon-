// POST /api/circle/image-url { ref: "private:{circleId}/{senderId}/{uuid}.webp" }
// 서클 채팅 비공개 사진의 signed URL 발급 (2026-07-26 보안 패치).
// private 버킷이라 직접 열람 불가 — 여기서 멤버십(owner/accepted)을 검증한 뒤
// 5분 TTL signed URL만 내려준다. 비멤버·비로그인은 403/401.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { isPrivateCircleImageRef, CIRCLE_IMAGE_PRIVATE_PREFIX } from "@/lib/circle-chat-repo";

const SIGNED_URL_TTL_SEC = 300; // 5분 — 채팅 화면 표시용 짧은 TTL

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  // 채팅방 진입 시 이미지 수만큼 연속 호출됨 — 분당 120이면 정상 사용 커버, 크롤링 차단
  if (!rateLimit(`circle-img:${user.id}`, { max: 120, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요." }, { status: 429 });
  }

  let body: { ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const ref = typeof body.ref === "string" ? body.ref : "";
  if (!isPrivateCircleImageRef(ref)) {
    return NextResponse.json({ error: "잘못된 이미지 참조예요." }, { status: 400 });
  }

  const path = ref.slice(CIRCLE_IMAGE_PRIVATE_PREFIX.length);
  const circleId = path.split("/")[0];

  // 멤버십 검증 — owner 또는 accepted 멤버만
  const svc = createServiceClient();
  const [{ data: owned }, { data: member }] = await Promise.all([
    svc.from("caretaker_circles").select("id").eq("id", circleId).eq("owner_id", user.id).maybeSingle(),
    svc.from("circle_members").select("circle_id")
      .eq("circle_id", circleId).eq("member_id", user.id).eq("status", "accepted").maybeSingle(),
  ]);
  if (!owned && !member) {
    return NextResponse.json({ error: "서클 멤버만 볼 수 있어요." }, { status: 403 });
  }

  const { data, error } = await svc.storage
    .from("circle-photos")
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "이미지를 불러올 수 없어요." }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl, ttl: SIGNED_URL_TTL_SEC });
}
