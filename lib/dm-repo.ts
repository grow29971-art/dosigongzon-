import { createClient } from "@/lib/supabase/client";
import { getDisplayName } from "@/lib/cats-repo";

export interface DirectMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  receiver_id: string;
  receiver_name: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
}

export async function sendDM(receiverId: string, receiverName: string, body: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("내용을 입력해주세요.");

  const { error } = await supabase.from("direct_messages").insert({
    sender_id: user.id,
    sender_name: getDisplayName(user),
    sender_avatar_url: user.user_metadata?.avatar_url ?? null,
    receiver_id: receiverId,
    receiver_name: receiverName,
    body: trimmed,
  });
  if (error) throw new Error(`쪽지 전송 실패: ${error.message}`);

  // 푸시 알림 (실패해도 쪽지 전송 자체는 성공)
  try {
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: receiverId,
        title: `${getDisplayName(user)}님의 쪽지`,
        body: trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed,
        url: "/messages",
      }),
    }).catch(() => {});
  } catch {}
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const convMap = new Map<string, Conversation>();
  for (const msg of data as DirectMessage[]) {
    const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    const partnerName = msg.sender_id === user.id
      ? (msg.receiver_name ?? "익명")
      : (msg.sender_name ?? "익명");
    const partnerAvatar = msg.sender_id !== user.id
      ? (msg.sender_avatar_url ?? null)
      : null;

    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        partnerId,
        partnerName,
        partnerAvatar,
        lastMessage: msg.body,
        lastAt: msg.created_at,
        unreadCount: 0,
      });
    }

    if (msg.receiver_id === user.id && !msg.is_read) {
      const conv = convMap.get(partnerId)!;
      conv.unreadCount += 1;
    }
  }

  return Array.from(convMap.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

export async function getMessagesWithUser(partnerId: string): Promise<DirectMessage[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`,
    )
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  // 읽음 처리
  const unreadIds = (data as DirectMessage[])
    .filter((m) => m.receiver_id === user.id && !m.is_read)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await supabase
      .from("direct_messages")
      .update({ is_read: true })
      .in("id", unreadIds);
  }

  return data as DirectMessage[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("is_read", false);

  if (error) return 0;
  return count ?? 0;
}
