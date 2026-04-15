import { createClient } from "@supabase/supabase-js";

// 인메모리 Rate limiting (IP당 1분에 5회)
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT) return false;
  bucket.count++;
  return true;
}

export async function POST(request: Request) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  const { nickname } = await request.json();
  if (!nickname?.trim()) {
    return Response.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("nickname", nickname.trim())
    .maybeSingle();

  // 존재 여부와 관계없이 동일한 응답 시간 (타이밍 공격 방지)
  if (error || !data?.email) {
    return Response.json({ error: "해당 닉네임으로 가입된 계정을 찾을 수 없어요." }, { status: 404 });
  }

  // 이메일 마스킹: grow29971@gmail.com → gr*****1@gmail.com
  const email = data.email as string;
  const [local, domain] = email.split("@");
  const masked =
    local.length <= 2
      ? local[0] + "*".repeat(local.length - 1)
      : local[0] + local[1] + "*".repeat(local.length - 3) + local[local.length - 1];

  return Response.json({ email: `${masked}@${domain}` });
}
