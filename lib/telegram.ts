// ══════════════════════════════════════════
// 텔레그램 알림 (서버 전용) — 운영자(사장님) 채팅방으로 발송
// TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID 미설정이면 조용히 스킵
// (lib/meta-capi.ts와 같은 silent skip 패턴 — 배포가 설정에 앞서도 안전)
// 봇 토큰은 서버 환경변수로만 — 클라이언트/OpenClaw 쪽에 노출 금지.
// ══════════════════════════════════════════

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const ADMIN_CHAT_ID = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim();

// 텔레그램 메시지 상한 4096자 — 여유를 두고 나눠 보낸다
const CHUNK_SIZE = 3500;

export function telegramConfigured(): boolean {
  return !!BOT_TOKEN && !!ADMIN_CHAT_ID;
}

/** 운영자 채팅방으로 텍스트 발송. 성공한 조각 수를 반환(미설정이면 0). */
export async function sendTelegramToAdmin(text: string): Promise<number> {
  if (!telegramConfigured()) return 0;

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= CHUNK_SIZE) { chunks.push(rest); break; }
    // 조각 경계는 줄바꿈 우선 — 주문 블록이 중간에서 잘리지 않게
    const cut = rest.lastIndexOf("\n", CHUNK_SIZE);
    const at = cut > CHUNK_SIZE / 2 ? cut : CHUNK_SIZE;
    chunks.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n+/, "");
  }

  let sent = 0;
  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: chunk }),
      });
      if (res.ok) sent++;
      else console.error("[telegram] sendMessage failed:", res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.error("[telegram] sendMessage error:", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
