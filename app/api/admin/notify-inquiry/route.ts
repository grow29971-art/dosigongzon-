// 새 문의·신고 발생 시 admin에게 이메일 알림.
// 비공개 테스트 기간에 admin이 /admin/inbox를 매번 확인하지 않아도 즉시 인지하도록.
// best-effort: 인증된 유저면 누구나 호출 가능 (DB insert는 이미 RLS로 검증됨).
//
// 보안: 인증 체크 + 본문은 로그인 유저 자신의 닉네임/이메일만 노출. 본문은 1:1 메일에만.

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/cats-repo";
import { reportError } from "@/lib/error-report";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const ADMIN_EMAIL = "grow29971@gmail.com";

type NotifyType = "inquiry" | "report";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
    }

    // 유저당 1시간 5회 — 실제 문의/신고는 이렇게 자주 반복될 일이 없고,
    // 없으면 로그인 유저 누구나 admin 이메일함에 스팸을 반복 발송할 수 있었음.
    if (!rateLimit(`notify-inquiry:${user.id}`, { max: 5, windowMs: 60 * 60 * 1000 })) {
      return Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const type: NotifyType = body.type === "report" ? "report" : "inquiry";
    const subject: string = String(body.subject ?? "").slice(0, 200);
    const content: string = String(body.body ?? body.description ?? "").slice(0, 2000);

    if (!subject.trim() && !content.trim()) {
      return Response.json({ error: "내용 없음" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "도시공존 <onboarding@resend.dev>";
    if (!resendKey) {
      // 설정 누락은 알림 실패지만 호출자에게는 200으로 응답 (사용자 인지 불필요)
      console.warn("[notify-inquiry] RESEND_API_KEY missing — 알림 skip");
      return Response.json({ ok: false, reason: "resend_not_configured" });
    }

    const userName = getDisplayName(user);
    const userEmail = user.email ?? "(이메일 없음)";
    const typeLabel = type === "report" ? "🚨 신고" : "📩 문의";
    const adminUrl =
      type === "report"
        ? "https://dosigongzon.com/admin/inbox"
        : "https://dosigongzon.com/admin/inbox";

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: fromEmail,
      to: ADMIN_EMAIL,
      subject: `[도시공존 ${typeLabel}] ${subject || "(제목 없음)"}`,
      text:
        `${typeLabel} 들어왔어요\n\n` +
        `보낸 사람: ${userName} (${userEmail})\n` +
        `제목: ${subject || "(없음)"}\n\n` +
        `내용:\n${content || "(없음)"}\n\n` +
        `--\n관리자 페이지: ${adminUrl}\n`,
      html:
        `<div style="font-family:-apple-system,sans-serif;max-width:560px">` +
        `<h2 style="margin:0 0 12px">${typeLabel} 들어왔어요</h2>` +
        `<p style="margin:0 0 6px;color:#555"><b>보낸 사람:</b> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>` +
        `<p style="margin:0 0 6px;color:#555"><b>제목:</b> ${escapeHtml(subject || "(없음)")}</p>` +
        `<div style="margin:12px 0;padding:12px 14px;background:#F7F4EE;border-radius:8px;white-space:pre-wrap;font-size:14px;line-height:1.6">${escapeHtml(content || "(내용 없음)")}</div>` +
        `<p style="margin:16px 0 0"><a href="${adminUrl}" style="display:inline-block;padding:8px 14px;background:#3182F6;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">관리자 페이지 열기</a></p>` +
        `</div>`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    reportError("admin/notify-inquiry", err);
    // 호출자(클라이언트)에게는 실패해도 200 — 본 흐름(문의 자체)에 영향 주지 않음
    return Response.json({ ok: false, reason: "send_failed" });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
