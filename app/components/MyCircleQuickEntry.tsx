"use client";

// 홈에 영구 노출되는 "내 서클" 빠른 진입 카드.
// 멤버 수 + 채팅방 + 관리 두 버튼.
// 2026-09-16 「익숙한 동네앱」 리디자인: 초록 틴트·채움 아이콘 폐기 → 흰 면 + 헤어라인, 회색 선 아이콘,
// 버튼은 primary/secondary 두 가지.

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount/user-change only: 로그아웃 상태를 1회 로딩 해제로 정착시킬 뿐 렌더마다 setState 하지 않는다(직후 `if (!user) return null`).
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
        className="p-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* 헤더 */}
        <div className="flex items-start gap-3 mb-3">
          <ShieldCheck size={22} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[15px] font-semibold text-text-main">
                내 서클
              </p>
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 text-text-sub"
                style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
              >
                PRIVATE
              </span>
            </div>
            <p className="text-[13px] mt-0.5 leading-snug text-text-sub">
              걱정되는 아이를 내가 초대한 이웃에게만 보여줘요
            </p>
            <div className="flex items-center gap-1 mt-1 text-text-light">
              <Users size={12} />
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <span className="text-[11px] font-medium">
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
            className="w-full h-10 flex items-center justify-center gap-1.5 text-[15px] font-semibold press-strong transition-transform"
            style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
          >
            <UserPlus size={15} />
            <span>이웃 초대 시작하기</span>
          </Link>
        ) : (
          /* 멤버 있음: 채팅방 + 관리 두 버튼 */
          <div className="flex gap-2">
            <Link
              href={circleId ? `/circle/${circleId}/chat` : "/mypage/circle"}
              className="flex-[1.5] h-10 flex items-center justify-center gap-1.5 text-[15px] font-semibold press-strong transition-transform"
              style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
            >
              <MessageCircle size={14} />
              <span>채팅방 열기</span>
              {unreadTotal > 0 && (
                <span
                  className="ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold leading-[18px] text-center"
                  style={{ background: "var(--color-surface)", color: "var(--color-primary)" }}
                >
                  {unreadTotal > 99 ? "99+" : unreadTotal}
                </span>
              )}
            </Link>
            <Link
              href="/mypage/circle"
              className="flex-1 h-10 flex items-center justify-center text-[15px] font-semibold press-strong transition-transform"
              style={{ borderRadius: "var(--radius-input)", background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
            >
              관리
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
