import { createClient } from "@/lib/supabase/client";
import { getDisplayName, convertImageToWebp } from "@/lib/cats-repo";

export interface DirectMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  receiver_id: string;
  receiver_name: string | null;
  body: string;
  photo_url: string | null;
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

export async function sendDM(receiverId: string, receiverName: string, body: string, photoUrl?: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const trimmed = body.trim();
  if (!trimmed && !photoUrl) throw new Error("내용을 입력해주세요.");

  // 보안: user_metadata는 유저가 조작 가능. profiles 테이블에서 실제 스냅샷 조회 (위조 방어)
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (profile?.nickname as string | null) ?? getDisplayName(user);
  const senderAvatar = (profile?.avatar_url as string | null) ?? null;

  const { error } = await supabase.from("direct_messages").insert({
    sender_id: user.id,
    sender_name: senderName,
    sender_avatar_url: senderAvatar,
    receiver_id: receiverId,
    receiver_name: receiverName,
    body: trimmed || (photoUrl ? "📷 사진" : ""),
    photo_url: photoUrl || null,
  });
  if (error) throw new Error(`쪽지 전송 실패: ${error.message}`);

  // 푸시 알림 (실패해도 쪽지 전송 자체는 성공)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    fetch("/api/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId: receiverId,
        title: `${senderName}님의 쪽지`,
        body: trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed,
        url: "/messages",
      }),
    }).catch(() => {});
  } catch {}
}

export async function uploadDMPhoto(file: File): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하만 가능해요.");
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 가능해요.");

  const webpFile = await convertImageToWebp(file, 1024, 0.8);
  const fileName = `${user.id}/dm_${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, { cacheControl: "3600", upsert: false, contentType: "image/webp" });
  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage.from("cat-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 목록 표시에 필요한 컬럼만 — photo_url 같은 무거운 필드는 제외.
  // 최근 500건 기준으로 대화방 집계 (대부분의 유저는 이 범위로 충분).
  const { data, error } = await supabase
    .from("direct_messages")
    .select(
      "id, sender_id, receiver_id, sender_name, receiver_name, sender_avatar_url, body, is_read, created_at",
    )
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(500);

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
