"use client";

// 홈에 영구 노출되는 "내 서클" 빠른 진입 카드.
// 멤버 수 + 채팅방 + 관리 두 버튼.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, MessageCircle, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateMyCircle, countMyAcceptedCircleMembers } from "@/lib/circles-repo";

export default function MyCircleQuickEntry() {
  const { user } = useAuth();
  const [circleId, setCircleId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([getOrCreateMyCircle(), countMyAcceptedCircleMembers()])
      .then(([circle, count]) => {
        if (cancelled) return;
        setCircleId(circle.id);
        setMemberCount(count);
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
    <section className="px-5 mt-3">
      <div
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(107,142,111,0.10) 0%, rgba(107,142,111,0.04) 100%)",
          border: "1px solid rgba(107,142,111,0.22)",
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)" }}
          >
            <ShieldCheck size={17} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-extrabold text-text-main tracking-tight">
              내 서클
            </p>
            <div className="flex items-center gap-1 mt-0.5">
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

        {/* 2 버튼 */}
        <div className="flex gap-2">
          <Link
            href={circleId ? `/circle/${circleId}/chat` : "/mypage/circle"}
            className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-extrabold text-white active:scale-[0.97] transition-transform"
            style={{ background: "linear-gradient(135deg, #4F6B53 0%, #6B8E6F 100%)", boxShadow: "0 3px 10px rgba(79,107,83,0.25)" }}
          >
            <MessageCircle size={13} />
            <span>채팅방 열기</span>
          </Link>
          <Link
            href="/mypage/circle"
            className="flex-1 flex items-center justify-center py-2.5 rounded-xl text-[12.5px] font-extrabold active:scale-[0.97] transition-transform bg-white"
            style={{ color: "#4F6B53", border: "1px solid rgba(79,107,83,0.30)" }}
          >
            관리
          </Link>
        </div>
      </div>
    </section>
  );
}
