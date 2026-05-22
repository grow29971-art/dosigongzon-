"use client";

// 홈에 영구 노출되는 "내 서클" 빠른 진입 카드.
// 멤버 수 + 채팅방 + 관리 두 버튼.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, MessageCircle, Users, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateMyCircle, countMyAcceptedCircleMembers } from "@/lib/circles-repo";
import { listMyUnreadCircles } from "@/lib/circle-chat-repo";

export default function MyCircleQuickEntry() {
  const { user } = useAuth();
  const [circleId, setCircleId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      getOrCreateMyCircle(),
      countMyAcceptedCircleMembers(),
      listMyUnreadCircles(),
    ])
      .then(([circle, count, unread]) => {
        if (cancelled) return;
        setCircleId(circle.id);
        setMemberCount(count);
        setUnreadTotal(unread.reduce((sum, u) => sum + u.unread_count, 0));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <section className="mt-3">
      <div
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(107,142,111,0.10) 0%, rgba(107,142,111,0.04) 100%)",
          border: "1px solid rgba(107,142,111,0.22)",
        }}
      >
        {/* 헤더 */}
        <div className="flex items-start gap-2 mb-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)" }}
          >
            <ShieldCheck size={17} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13.5px] font-extrabold text-text-main tracking-tight">
                내 서클
              </p>
              <span
                className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md tracking-wider"
                style={{ background: "rgba(79,107,83,0.15)", color: "#4F6B53" }}
              >
                PRIVATE
              </span>
            </div>
            <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "rgba(60,46,35,0.65)" }}>
              걱정되는 아이를 내가 초대한 이웃에게만 보여줘요
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Users size={10} style={{ color: "#4F6B53" }} />
              {loading ? (
                <Loader2 size={10} className="animate-spin" style={{ color: "#4F6B53" }} />
              ) : (
                <span className="text-[10.5px] font-bold" style={{ color: "#4F6B53" }}>
                  {memberCount === 0 ? "초대 시작하기" : `멤버 ${memberCount}명`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 버튼 — 멤버 유무로 분기 */}
        {memberCount === 0 ? (
          /* 멤버 0명: 초대를 강조. 채팅방은 본인만 있어서 의미 적음 → 아래 작은 라벨로 */
          <Link
            href="/mypage/circle"
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13px] font-extrabold text-white active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)", boxShadow: "0 4px 12px rgba(79,107,83,0.30)" }}
          >
            <UserPlus size={14} />
            <span>이웃 초대 시작하기</span>
          </Link>
        ) : (
          /* 멤버 있음: 채팅방 + 관리 두 버튼 */
          <div className="flex gap-2">
            <Link
              href={circleId ? `/circle/${circleId}/chat` : "/mypage/circle"}
              className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-extrabold text-white active:scale-[0.97] transition-transform relative"
              style={{ background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)", boxShadow: "0 3px 10px rgba(79,107,83,0.25)" }}
            >
              <MessageCircle size={13} />
              <span>채팅방 열기</span>
              {unreadTotal > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none"
                  style={{ background: "#FFF7C4", color: "#4F6B53" }}
                >
                  {unreadTotal > 99 ? "99+" : unreadTotal}
                </span>
              )}
            </Link>
            <Link
              href="/mypage/circle"
              className="flex-1 flex items-center justify-center py-2.5 rounded-xl text-[12.5px] font-extrabold active:scale-[0.97] transition-transform bg-white"
              style={{ color: "#4F6B53", border: "1px solid rgba(79,107,83,0.30)" }}
            >
              관리
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
