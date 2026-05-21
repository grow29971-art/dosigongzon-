"use client";

// 마이페이지 첫 화면 활동 피드 미리보기.
// /notifications의 최근 N건을 카드로 노출 → 재방문 트리거.
// 빈 상태일 때는 첫 cat 등록 유도. 카드 클릭 → 해당 액션 페이지로 직접 이동.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  MessageCircle,
  Heart,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  UserPlus,
  Gift,
  MapPin,
  ChevronRight,
  Loader2,
  PawPrint,
} from "lucide-react";
import {
  getNotifications,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications-repo";

const PREVIEW_COUNT = 4;

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Bell; color: string; bg: string }> = {
  comment_on_my_cat:   { icon: MessageCircle, color: "#C47E5A", bg: "#C47E5A15" },
  carelog_on_my_cat:   { icon: Heart,         color: "#6B8E6F", bg: "#6B8E6F15" },
  dm_received:         { icon: MessageCircle, color: "#4A7BA8", bg: "#4A7BA815" },
  alert_on_my_cat:     { icon: AlertTriangle, color: "#D85555", bg: "#D8555515" },
  comment_on_my_post:  { icon: MessageSquare, color: "#8B65B8", bg: "#8B65B815" },
  inquiry_updated:     { icon: CheckCircle2,  color: "#48A59E", bg: "#48A59E15" },
  following_activity:  { icon: UserPlus,      color: "#E8B040", bg: "#E8B0401a" },
  invite_accepted:     { icon: Gift,          color: "#E86B8C", bg: "#E86B8C15" },
  cat_moved:           { icon: MapPin,        color: "#5A8AC4", bg: "#5A8AC415" },
  urgent_in_area:      { icon: AlertTriangle, color: "#D85555", bg: "#FBEAEA" },
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

function targetHref(item: NotificationItem): string {
  switch (item.type) {
    case "dm_received":
      return `/messages?partner=${item.targetId}`;
    case "comment_on_my_post":
      return `/community/${item.targetId}`;
    case "inquiry_updated":
      return "/mypage/inquiries";
    case "invite_accepted":
      return `/users/${item.targetId}`;
    default:
      return `/cats/${item.targetId}`;
  }
}

export default function ActivityFeedPreview({ hasMyCat }: { hasMyCat: boolean }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotifications(PREVIEW_COUNT)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 로딩 중엔 자리만 잡아둠 (CLS 방어)
  if (items === null) {
    return (
      <div
        className="mb-3 px-4 py-3 flex items-center gap-2"
        style={{
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.04)",
          minHeight: 92,
        }}
      >
        <Loader2 size={14} className="animate-spin text-text-light" />
        <span className="text-[11.5px] text-text-light">새 소식 불러오는 중…</span>
      </div>
    );
  }

  // 빈 상태 — 첫 cat 등록 유도(둥지 같은 톤)
  if (items.length === 0) {
    return (
      <div
        className="mb-3 relative overflow-hidden p-4"
        style={{
          background: "linear-gradient(135deg, #FFF6E8 0%, #FCE7D2 100%)",
          borderRadius: 18,
          border: "1px solid rgba(196,126,90,0.20)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 12px rgba(196,126,90,0.30)",
            }}
          >
            <Bell size={15} color="#fff" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-text-main tracking-tight">
              {hasMyCat ? "아직 새 소식이 없어요" : "첫 돌봄 기록부터 시작해요"}
            </p>
            <p className="text-[11px] text-text-sub mt-0.5 leading-snug">
              {hasMyCat
                ? "이웃의 댓글·돌봄·쪽지가 도착하면 여기서 알려드려요"
                : "고양이를 등록하면 이웃 소식이 모여요"}
            </p>
          </div>
          <Link
            href={hasMyCat ? "/map" : "/map"}
            className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold active:scale-95"
            style={{ backgroundColor: "#C47E5A", color: "#fff" }}
          >
            <PawPrint size={11} className="inline mr-1" strokeWidth={2.5} />
            지도로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C47E5A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            새 소식
          </h2>
          <span
            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ background: "#C47E5A22", color: "#A8684A" }}
          >
            {items.length}
          </span>
        </div>
        <Link
          href="/notifications"
          className="flex items-center gap-0.5 text-[11px] font-bold active:opacity-70"
          style={{ color: "#A8684A" }}
        >
          모두 보기
          <ChevronRight size={12} />
        </Link>
      </div>

      <div
        className="overflow-hidden"
        style={{
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 4px 14px rgba(196,126,90,0.06), 0 1px 3px rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {items.map((item, idx) => {
          const config = TYPE_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <Link
              key={item.id}
              href={targetHref(item)}
              className="flex items-start gap-3 px-3.5 py-3 active:bg-[#FCFAF6] transition-colors"
              style={{
                borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: config.bg }}
              >
                <Icon size={15} style={{ color: config.color }} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-extrabold text-text-main leading-tight tracking-tight">
                  {item.targetName}
                </p>
                <p className="text-[11px] text-text-sub mt-0.5 leading-snug line-clamp-1">
                  <b style={{ color: config.color }}>{item.actorName}</b>
                  {" · "}
                  {item.message}
                </p>
              </div>
              <span className="text-[10px] text-text-light shrink-0 mt-0.5">
                {formatTime(item.createdAt)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
