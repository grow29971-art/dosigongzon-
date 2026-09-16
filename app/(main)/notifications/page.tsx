"use client";

// 알림 센터 — 2026-09-16 「익숙한 동네앱」 리디자인: 타입별 색·틴트 원 폐지 → 회색 선 아이콘,
// 카드 → 구분선 리스트, 읽지 않음은 primary 점 하나. 학대 경보·긴급만 error 색.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  MessageCircle,
  Heart,
  AlertTriangle,
  Loader2,
  ChevronRight,
  MessageSquare,
  CheckCircle2,
  UserPlus,
  Gift,
  MapPin,
} from "lucide-react";
import {
  getNotifications,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications-repo";

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; urgent?: boolean }> = {
  comment_on_my_cat:   { icon: MessageCircle },
  carelog_on_my_cat:   { icon: Heart },
  dm_received:         { icon: MessageCircle },
  alert_on_my_cat:     { icon: AlertTriangle, urgent: true },
  comment_on_my_post:  { icon: MessageSquare },
  inquiry_updated:     { icon: CheckCircle2 },
  following_activity:  { icon: UserPlus },
  invite_accepted:     { icon: Gift },
  cat_moved:           { icon: MapPin },
  urgent_in_area:      { icon: AlertTriangle, urgent: true },
};

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications(50).then(setItems).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center pt-32">
        <Loader2 size={28} className="animate-spin text-text-light" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-3 px-1">
        <h1 className="text-[24px] font-bold text-text-main tracking-tight">알림</h1>
        <p className="text-[13px] text-text-sub mt-1">내 고양이 소식과 받은 쪽지</p>
      </div>

      {/* 알림 목록 */}
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <Bell size={40} strokeWidth={1.2} className="text-text-light mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-text-main mb-1">아직 알림이 없어요</p>
          <p className="text-[13px] text-text-sub">고양이를 등록하면 돌봄 소식을 받아요</p>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--color-divider)" }}>
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type];
            const Icon = config.icon;
            const iconColor = config.urgent ? "var(--color-error)" : "var(--color-text-sub)";
            const href =
              item.type === "dm_received"
                ? `/messages?partner=${item.targetId}`
                : item.type === "comment_on_my_post"
                ? `/community/${item.targetId}`
                : item.type === "inquiry_updated"
                ? "/mypage/inquiries"
                : item.type === "following_activity"
                ? `/cats/${item.targetId}`
                : item.type === "invite_accepted"
                ? `/users/${item.targetId}`
                : item.type === "cat_moved"
                ? `/map?cat=${item.targetId}`
                : item.type === "urgent_in_area"
                ? `/cats/${item.targetId}`
                : "/map";

            return (
              <Link
                key={item.id}
                href={href}
                className="flex items-start gap-3 px-1 py-3.5 press transition-transform border-b border-divider last:border-b-0"
                style={{ minHeight: 64 }}
              >
                {/* 아이콘 — 틴트 박스 없이 회색 선 */}
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Icon size={22} strokeWidth={1.8} style={{ color: iconColor }} />
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[15px] text-text-main truncate ${item.isRead ? "font-semibold" : "font-bold"}`}>
                      {item.actorName}
                    </span>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="읽지 않음" />
                    )}
                  </div>
                  <p className={`text-[13px] mt-0.5 truncate ${item.isRead ? "text-text-sub" : "text-text-main"}`}>
                    <span className="font-semibold">{item.targetName}</span>
                    {item.type === "dm_received"
                      ? `: ${item.message}`
                      : item.type === "inquiry_updated"
                      ? ` — ${item.message}`
                      : item.type === "following_activity"
                      ? ` 에 ${item.message}`
                      : item.type === "invite_accepted"
                      ? ` — ${item.message}`
                      : item.type === "cat_moved"
                      ? ` ${item.message}`
                      : ` 에 ${item.message}`}
                  </p>
                  <p className="text-[11px] text-text-light mt-1">{formatTime(item.createdAt)}</p>
                </div>

                <ChevronRight size={16} className="shrink-0 mt-3" style={{ color: "var(--color-text-muted)" }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
