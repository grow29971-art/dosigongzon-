// 위클리 다이제스트 발송 — Vercel Cron 매주 월요일 08:00 KST
// 수동 호출: POST /api/cron/weekly-digest (CRON_SECRET 필요)

import { Resend } from "resend";
import {
  listDigestRecipients,
  getDigestBaseContent,
  getMyCatCount,
  renderDigestHtml,
  markDigestSent,
} from "@/lib/weekly-digest";

export const maxDuration = 300; // 대량 발송 대비

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "도시공존 <onboarding@resend.dev>";

  if (!resendKey) {
    // 이메일 인프라 미설정 — 발송 스킵하고 구조만 검증
    const base = await getDigestBaseContent();
    const recipients = await listDigestRecipients();
    return Response.json({
      ok: true,
      dryRun: true,
      reason: "RESEND_API_KEY not configured",
      recipientCount: recipients.length,
      baseContent: base,
    });
  }

  const resend = new Resend(resendKey);
  const base = await getDigestBaseContent();
  const recipients = await listDigestRecipients();

  let sent = 0;
  let failed = 0;
  const errors: Array<{ user: string; error: string }> = [];

  // 순차 발송 (Resend 기본 rate limit 2 req/s 고려). 필요 시 chunk 병렬화.
  for (const r of recipients) {
    try {
      const myCatCount = await getMyCatCount(r.id);
      const { subject, html, text } = renderDigestHtml(r, { ...base, myCatCount });
      await resend.emails.send({
        from: fromEmail,
        to: r.email,
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<https://dosigongzon.com/mypage#email-digest>`,
        },
      });
      await markDigestSent(r.id);
      sent++;
      // 간단한 throttle
      await new Promise((res) => setTimeout(res, 300));
    } catch (err) {
      failed++;
      errors.push({ user: r.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return Response.json({
    ok: true,
    sent,
    failed,
    total: recipients.length,
    errors: errors.slice(0, 10), // 디버깅용 일부만 반환
  });
}

// GET도 POST와 동일하게 동작 (Vercel Cron은 GET으로 호출할 수도 있음)
export const GET = POST;
