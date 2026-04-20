import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * 닉네임으로 마스킹된 이메일 조회.
 * 보안 고려:
 * - 존재/미존재 응답 시간·형식 동일 (타이밍/응답 분기 공격 방어)
 * - IP+nickname 조합 rate limit (사전 공격 방어)
 * - 최소 지연 삽입으로 DB 응답 편차 숨김
 */

const MIN_RESPONSE_MS = 350;

async function uniformDelay(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = MIN_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const ip = getClientIp(request);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    await uniformDelay(startedAt);
    return Response.json({ email: null }, { status: 200 });
  }

  const { nickname } = await request.json().catch(() => ({ nickname: null }));
  const trimmed = nickname?.trim();

  // Rate limit: IP+닉네임 조합으로 분당 5회 — 사전 공격 방어
  const rlKey = `find-email:${ip}:${trimmed ?? ""}`;
  if (!rateLimit(rlKey, { max: 5, windowMs: 60_000 })) {
    await uniformDelay(startedAt);
    return Response.json({ email: null }, { status: 200 });
  }

  if (!trimmed || trimmed.length < 2) {
    await uniformDelay(startedAt);
    return Response.json({ email: null }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("nickname", trimmed)
    .maybeSingle();

  // 에러·없음·존재 모두 동일한 형식의 200 응답 반환 — 분기 추론 차단
  let maskedEmail: string | null = null;
  if (!error && data?.email) {
    const email = data.email as string;
    const [local, domain] = email.split("@");
    maskedEmail =
      local.length <= 2
        ? local[0] + "*".repeat(Math.max(0, local.length - 1)) + `@${domain}`
        : local[0] + local[1] + "*".repeat(local.length - 3) + local[local.length - 1] + `@${domain}`;
  }

  await uniformDelay(startedAt);
  return Response.json({ email: maskedEmail }, { status: 200 });
}
