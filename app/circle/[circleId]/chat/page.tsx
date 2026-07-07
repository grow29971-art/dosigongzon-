"use client";

// Circle Chat — 서클 멤버끼리 그룹 채팅 페이지.
// 실시간 동기화 (Supabase Realtime).

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Send, Loader2, Trash2, Users, Image as ImageIcon, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl, optimizedImageUrl } from "@/lib/cats-repo";
import {
  listCircleMessages,
  sendCircleMessage,
  deleteCircleMessage,
  uploadCircleChatImage,
  markCircleRead,
  type CircleMessage,
} from "@/lib/circle-chat-repo";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export default function CircleChatPage() {
  const params = useParams<{ circleId: string }>();
  const circleId = params.circleId ?? "";
  const { user, loading: authLoading } = useAuth();

  const [messages, setMessages] = useState<CircleMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ownerInfo, setOwnerInfo] = useState<{ nickname: string | null; ownerId: string } | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 메시지 초기 로드 + Realtime 구독
  useEffect(() => {
    if (!user || !circleId) return;
    let cancelled = false;

    // 채팅방 진입 즉시 읽음 마킹 (fire-and-forget)
    void markCircleRead(circleId);

    listCircleMessages(circleId)
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "불러오기 실패");
          setLoading(false);
        }
      });

    // owner 정보 + 멤버 수 조회
    const supabase = createClient();
    supabase
      .from("caretaker_circles")
      .select("owner_id")
      .eq("id", circleId)
      .maybeSingle()
      .then((res: { data: { owner_id: string } | null }) => {
        if (cancelled || !res.data) return;
        const ownerId = res.data.owner_id;
        supabase
          .from("profiles")
          .select("nickname")
          .eq("id", ownerId)
          .maybeSingle()
          .then((pres: { data: { nickname: string | null } | null }) => {
            if (cancelled) return;
            setOwnerInfo({ nickname: pres.data?.nickname ?? null, ownerId });
          });
      });
    supabase
      .from("circle_members")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("status", "accepted")
      .then((res: { count: number | null }) => {
        if (!cancelled) setMemberCount(res.count ?? 0);
      });

    // Realtime — 새 메시지 도착 시 추가
    const channel = supabase
      .channel(`circle-chat:${circleId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "circle_messages", filter: `circle_id=eq.${circleId}` },
        (payload: { new: CircleMessage }) => {
          if (cancelled) return;
          const newMsg = payload.new;
          setMessages((prev) => {
            // 중복 방지 (내가 send한 직후 RT 이벤트로 다시 들어올 때)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // 채팅방 보고 있는 동안 새 메시지 받으면 즉시 읽음 처리
          if (newMsg.sender_id !== user.id) void markCircleRead(circleId);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "circle_messages", filter: `circle_id=eq.${circleId}` },
        (payload: { old: { id: string } }) => {
          if (cancelled) return;
          const oldMsg = payload.old;
          setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, circleId]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !photoFile) || sending) return;
    setSending(true);
    setError("");
    try {
      let imageUrl: string | null = null;
      if (photoFile) {
        imageUrl = await uploadCircleChatImage(photoFile);
      }
      const sent = await sendCircleMessage(circleId, input, imageUrl);
      // 낙관적 추가 (RT가 도착 전이라도 즉시 표시)
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setInput("");
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setSending(false);
    }
  };

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 첨부할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("10MB 이하 사진만 가능해요.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 메시지를 삭제할까요?")) return;
    try {
      await deleteCircleMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="text-[14px] text-text-sub mb-3">로그인이 필요해요.</p>
        <Link href="/login" className="text-primary text-[13px] font-bold">
          로그인
        </Link>
      </div>
    );
  }

  // 날짜별 그룹핑
  const groupedByDate: Array<{ date: string; items: CircleMessage[] }> = [];
  let lastDate = "";
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString();
    if (d !== lastDate) {
      groupedByDate.push({ date: m.created_at, items: [] });
      lastDate = d;
    }
    groupedByDate[groupedByDate.length - 1].items.push(m);
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div
        className="px-4 pt-3 pb-3 flex items-center gap-2 border-b"
        style={{
          background: "#FFFFFF",
          borderColor: "#E5E0D6",
          paddingTop: "max(12px, env(safe-area-inset-top))",
        }}
      >
        <Link
          href="/mypage/circle"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "#F6F1EA" }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-extrabold text-text-main truncate">
            {ownerInfo?.ownerId === user.id ? "내 서클" : `${ownerInfo?.nickname ?? "이웃"}님의 서클`}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Users size={11} className="text-text-light" />
            <span className="text-[10.5px] text-text-light">멤버 {memberCount + 1}명</span>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loading ? (
          <div className="flex justify-center pt-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="pt-20 text-center">
            <Users size={32} className="mx-auto mb-3 text-text-light" />
            <p className="text-[13px] text-text-sub mb-1">아직 대화가 없어요</p>
            <p className="text-[11.5px] text-text-light">첫 메시지를 보내 이웃과 인사 나눠보세요.</p>
          </div>
        ) : (
          groupedByDate.map((group, gi) => (
            <div key={gi}>
              <div className="flex justify-center my-3">
                <span className="text-[10.5px] px-2.5 py-1 rounded-full bg-white text-text-light" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  {formatDate(group.date)}
                </span>
              </div>
              {group.items.map((m) => {
                const isMine = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex gap-2 mb-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMine && <Avatar url={m.sender_avatar_url} size={32} />}
                    <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                      {!isMine && (
                        <p className="text-[10.5px] text-text-light mb-0.5 ml-1">
                          {m.sender_name ?? "익명"}
                        </p>
                      )}
                      {m.image_url && (
                        <a
                          href={m.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block mb-1 rounded-2xl overflow-hidden ${isMine ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                          style={{ maxWidth: 220, boxShadow: "0 2px 6px rgba(0,0,0,0.10)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={optimizedImageUrl(m.image_url, 480, 70) ?? m.image_url}
                            alt=""
                            loading="lazy"
                            className="w-full h-auto block"
                          />
                        </a>
                      )}
                      {m.body && (
                        <div
                          className={`px-3 py-2 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${isMine ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                          style={{
                            background: isMine ? "#5C8DEE" : "#FFFFFF",
                            color: isMine ? "#FFFFFF" : "#3D2F25",
                            boxShadow: isMine ? "0 2px 6px rgba(92,141,238,0.25)" : "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          {m.body}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5 px-1">
                        <span className="text-[10px] text-text-light">{formatTime(m.created_at)}</span>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => handleDelete(m.id)}
                            className="text-text-light active:scale-90"
                            aria-label="삭제"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* 입력 영역 */}
      <div
        className="px-3 py-2.5 border-t"
        style={{
          background: "#FFFFFF",
          borderColor: "#E5E0D6",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        }}
      >
        {error && (
          <p className="text-[10.5px] mb-1.5 px-1" style={{ color: "#B84545" }}>{error}</p>
        )}
        {/* 사진 미리보기 */}
        {photoPreview && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="" className="rounded-xl max-h-32 object-cover" style={{ maxWidth: 120 }} />
            <button
              type="button"
              onClick={handleClearPhoto}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#2A2A28", color: "#fff" }}
              aria-label="사진 제거"
            >
              <X size={11} strokeWidth={3} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickPhoto}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || !!photoPreview}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-40"
            style={{ background: "#F6F1EA", color: "#8B7562" }}
            aria-label="사진 첨부"
          >
            <ImageIcon size={17} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSend();
            }}
            placeholder={photoPreview ? "사진과 함께 보낼 메시지 (선택)" : "메시지를 입력하세요"}
            maxLength={1000}
            disabled={sending}
            className="flex-1 rounded-2xl px-4 py-2.5 text-[14px] outline-none disabled:opacity-50"
            style={{ background: "#F6F1EA", color: "#2A2A28" }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !photoFile) || sending}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-40"
            style={{ background: "#5C8DEE" }}
            aria-label="전송"
          >
            {sending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={17} color="#fff" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ url, size = 32 }: { url: string | null; size?: number }) {
  const safe = sanitizeImageUrl(url, "");
  if (!safe) {
    return (
      <div
        className="shrink-0 rounded-full flex items-center justify-center text-white text-[13px] font-extrabold"
        style={{ width: size, height: size, background: "linear-gradient(135deg, #5C8DEE, #8B6FE0)" }}
      >
        🐾
      </div>
    );
  }
  const thumb = thumbnailUrl(safe, size * 2) ?? safe;
  return (
    <Image
      src={thumb}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      unoptimized
    />
  );
}
