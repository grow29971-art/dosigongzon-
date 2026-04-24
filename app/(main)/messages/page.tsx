"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, Loader2, Mail, ChevronRight, Camera, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import FollowButton from "@/app/components/FollowButton";
import PageIntroBanner from "@/app/components/PageIntroBanner";
import {
  getConversations,
  getMessagesWithUser,
  sendDM,
  uploadDMPhoto,
  type Conversation,
  type DirectMessage,
} from "@/lib/dm-repo";

export default function MessagesPageWrapper() {
  return (
    <Suspense>
      <MessagesPage />
    </Suspense>
  );
}

function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // 대화 상대 선택
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // URL 파라미터로 바로 쪽지 보내기 (?to=userId&name=이름&preset=메시지)
  // preset이 있으면 입력창에 미리 채워 — 입양 문의 버튼 등에서 활용.
  useEffect(() => {
    const toId = searchParams.get("to");
    const toName = searchParams.get("name");
    const preset = searchParams.get("preset");
    if (toId && toName) {
      setSelectedPartner({ id: toId, name: toName });
      if (preset) setMsgText(preset);
    }
  }, [searchParams]);

  // 대화 목록 로드
  useEffect(() => {
    if (!user) return;
    getConversations().then(setConvs).finally(() => setLoading(false));
  }, [user]);

  // 대화 상대 선택 시 메시지 로드 + 1초 폴링
  useEffect(() => {
    if (!selectedPartner) return;
    let active = true;

    const fetchMsgs = async () => {
      const data = await getMessagesWithUser(selectedPartner.id);
      if (!active) return;
      setMessages((prev) => {
        if (prev.length !== data.length) {
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
        return data;
      });
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 1500);
    return () => { active = false; clearInterval(interval); };
  }, [selectedPartner]);

  const handleSend = async () => {
    if (!selectedPartner || (!msgText.trim() && !photoFile) || sending) return;
    const body = msgText.trim();
    setMsgText("");
    setSending(true);

    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        photoUrl = await uploadDMPhoto(photoFile);
        setPhotoFile(null);
        setPhotoPreview(null);
      }

      // 낙관적
      const tempMsg: DirectMessage = {
        id: `temp-${Date.now()}`,
        sender_id: user!.id,
        sender_name: null,
        sender_avatar_url: user!.user_metadata?.avatar_url ?? null,
        receiver_id: selectedPartner.id,
        receiver_name: selectedPartner.name,
        body: body || (photoUrl ? "📷 사진" : ""),
        photo_url: photoUrl ?? null,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

      await sendDM(selectedPartner.id, selectedPartner.name, body, photoUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="px-5 pt-20 text-center">
        <Mail size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">로그인이 필요해요</p>
        <button onClick={() => router.push("/login")} className="text-[13px] font-bold text-primary mt-2">로그인하기</button>
      </div>
    );
  }

  // 대화 상세
  if (selectedPartner) {
    return (
      <div className="flex flex-col" style={{ height: "100dvh" }}>
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b border-divider shrink-0">
          <button onClick={() => { setSelectedPartner(null); setMessages([]); getConversations().then(setConvs); }} className="p-2 -ml-2 active:scale-90 transition-transform">
            <ArrowLeft size={24} className="text-text-main" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-text-main truncate">{selectedPartner.name}</p>
            <p className="text-[10px] text-text-light">1:1 쪽지 · 읽고 7일 후 자동 삭제</p>
          </div>
          <FollowButton userId={selectedPartner.id} size="sm" />
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-light">
              <Mail size={32} strokeWidth={1.2} className="mb-2 opacity-30" />
              <p className="text-[12px]">첫 쪽지를 보내보세요</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                {!isMe && (
                  msg.sender_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.sender_avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">{(selectedPartner.name)[0]}</span>
                    </div>
                  )
                )}
                <div className="max-w-[75%]">
                  <div
                    className="overflow-hidden"
                    style={{
                      backgroundColor: isMe ? "#C47E5A" : "#F6F1EA",
                      borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    }}
                  >
                    {msg.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.photo_url} alt="" className="max-w-full max-h-48 object-cover" />
                    )}
                    {msg.body && msg.body !== "📷 사진" && (
                      <p className="px-3.5 py-2 text-[13px] leading-relaxed" style={{ color: isMe ? "#fff" : "#2A2A28" }}>
                        {msg.body}
                      </p>
                    )}
                    {(!msg.body || msg.body === "📷 사진") && !msg.photo_url && (
                      <p className="px-3.5 py-2 text-[13px] leading-relaxed" style={{ color: isMe ? "#fff" : "#2A2A28" }}>
                        {msg.body}
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                    <span className="text-[9px] text-text-light">
                      {new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMe && msg.is_read && <span className="text-[8px] text-primary font-bold">읽음</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* 사진 미리보기 */}
        {photoPreview && (
          <div className="px-4 py-2 border-t border-divider shrink-0">
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="" className="h-20 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"
              >
                <X size={10} className="text-text-sub" />
              </button>
            </div>
          </div>
        )}

        {/* 입력 */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-divider shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-90 transition-transform shrink-0"
            style={{ backgroundColor: photoFile ? "#6B8E6F" : "#F6F1EA", border: "1px solid #E3DCD3" }}
          >
            <Camera size={18} style={{ color: photoFile ? "#fff" : "#A38E7A" }} />
          </button>
          <input
            type="text"
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="쪽지를 입력하세요"
            className="flex-1 px-3.5 py-2.5 rounded-2xl text-[13px] outline-none"
            style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && (msgText.trim() || photoFile)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || (!msgText.trim() && !photoFile)}
            className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform shrink-0"
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    );
  }

  // 대화 목록
  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-4 pt-14 pb-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-[20px] font-extrabold text-text-main">쪽지함</h1>
      </div>

      <div className="px-4 mb-3">
        <PageIntroBanner
          id="messages"
          title="이웃과 1:1 쪽지"
          description="커뮤니티 글·댓글·프로필에서 쪽지 버튼을 누르면 대화가 시작돼요. 사진도 첨부 가능. 받은 쪽지는 푸시·알림 센터로 바로 알려드려요."
          ctaLabel="전체 기능 보기"
          ctaHref="/guide"
          accent="#E86B8C"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : convs.length === 0 ? (
        <div className="flex flex-col items-center pt-20 text-text-light">
          <Mail size={48} strokeWidth={1.2} className="mb-3 opacity-30" />
          <p className="text-[14px] text-text-sub font-semibold">받은 쪽지가 없어요</p>
          <p className="text-[12px] mt-1">커뮤니티에서 이웃에게 쪽지를 보내보세요</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {convs.map((c) => (
            <button
              key={c.partnerId}
              type="button"
              onClick={() => setSelectedPartner({ id: c.partnerId, name: c.partnerName })}
              className="w-full flex items-center gap-3 px-4 py-3 active:scale-[0.99] transition-transform text-left"
              style={{
                background: c.unreadCount > 0 ? "linear-gradient(135deg, #FDF9F2, #FFF)" : "#FFFFFF",
                borderRadius: 16,
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: c.unreadCount > 0 ? "1.5px solid rgba(196,126,90,0.2)" : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              {c.partnerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.partnerAvatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[14px] font-extrabold text-primary">{c.partnerName[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-text-main">{c.partnerName}</span>
                  {c.unreadCount > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-white">{c.unreadCount}</span>
                  )}
                </div>
                <p className="text-[11px] text-text-sub truncate mt-0.5">{c.lastMessage}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[9px] text-text-light">
                  {new Date(c.lastAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
                <ChevronRight size={12} className="text-text-light" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
