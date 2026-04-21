"use client";

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

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  comment_on_my_cat:   { icon: MessageCircle, color: "#C47E5A", bg: "#C47E5A15" },
  carelog_on_my_cat:   { icon: Heart,         color: "#6B8E6F", bg: "#6B8E6F15" },
  dm_received:         { icon: MessageCircle, color: "#4A7BA8", bg: "#4A7BA815" },
  alert_on_my_cat:     { icon: AlertTriangle, color: "#D85555", bg: "#D8555515" },
  comment_on_my_post:  { icon: MessageSquare, color: "#8B65B8", bg: "#8B65B815" },
  inquiry_updated:     { icon: CheckCircle2,  color: "#48A59E", bg: "#48A59E15" },
  following_activity:  { icon: UserPlus,      color: "#E8B040", bg: "#E8B04015" },
  invite_accepted:     { icon: Gift,          color: "#E86B8C", bg: "#E86B8C15" },
  cat_moved:           { icon: MapPin,        color: "#5A8AC4", bg: "#5A8AC415" },
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
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5 px-1">
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">알림</h1>
          <span className="text-[11px] font-semibold text-text-light">Notifications</span>
        </div>
        <p className="text-[12.5px] text-text-sub">내 고양이 소식과 받은 쪽지를 확인하세요</p>
      </div>

      {/* 알림 목록 */}
      {items.length === 0 ? (
        <div
          className="py-16 text-center"
          style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid rgba(0,0,0,0.04)" }}
        >
          <Bell size={36} strokeWidth={1.2} className="text-text-light mx-auto mb-3" />
          <p className="text-[14px] font-bold text-text-main mb-1">아직 알림이 없어요</p>
          <p className="text-[12px] text-text-sub">고양이를 등록하면 돌봄 소식을 받을 수 있어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const config = TYPE_CONFIG[item.type];
            const Icon = config.icon;
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
                : "/map";

            return (
              <Link
                key={item.id}
                href={href}
                className="block active:scale-[0.99] transition-transform"
              >
                <div
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{
                    background: item.isRead ? "#FFFFFF" : "#FDF9F2",
                    borderRadius: 16,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                    border: item.isRead ? "1px solid rgba(0,0,0,0.04)" : `1px solid ${config.color}20`,
                  }}
                >
                  {/* 아이콘 */}
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: config.bg }}
                  >
                    <Icon size={18} style={{ color: config.color }} />
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-text-main truncate">
                        {item.actorName}
                      </span>
                      {!item.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                      )}
                    </div>
                    <p className="text-[12px] text-text-sub mt-0.5 truncate">
                      <span className="font-semibold" style={{ color: config.color }}>{item.targetName}</span>
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
                    <p className="text-[10px] text-text-light mt-1">{formatTime(item.createdAt)}</p>
                  </div>

                  <ChevronRight size={14} className="text-text-light shrink-0 mt-3" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
