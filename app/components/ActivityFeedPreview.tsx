"use client";

// 마이페이지 첫 화면 활동 피드 미리보기.
// /notifications의 최근 N건을 리스트로 노출 → 재방문 트리거.
// 빈 상태일 때는 첫 cat 등록 유도. 행 클릭 → 해당 액션 페이지로 직접 이동.
// 2026-09-16 「익숙한 동네앱」 리디자인: 유형별 색·틴트 박스 폐기 → 회색 선 아이콘 + 구분선 리스트.

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
} from "lucide-react";
import {
  getNotifications,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications-repo";

const PREVIEW_COUNT = 4;

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  comment_on_my_cat: MessageCircle,
  carelog_on_my_cat: Heart,
  dm_received: MessageCircle,
  alert_on_my_cat: AlertTriangle,
  comment_on_my_post: MessageSquare,
  inquiry_updated: CheckCircle2,
  following_activity: UserPlus,
  invite_accepted: Gift,
  cat_moved: MapPin,
  urgent_in_area: AlertTriangle,
};

// 긴급(학대 경보·동네 위험)만 의미색, 나머지는 회색
const URGENT_TYPES = new Set<NotificationType>(["alert_on_my_cat", "urgent_in_area"]);

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

const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
};

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
      <div className="mb-3 px-4 py-3 flex items-center gap-2" style={{ ...CARD, minHeight: 92 }}>
        <Loader2 size={14} className="animate-spin text-text-light" />
        <span className="text-[13px] text-text-light">새 소식 불러오는 중…</span>
      </div>
    );
  }

  // 빈 상태 — 첫 cat 등록 유도
  if (items.length === 0) {
    return (
      <div className="mb-3 p-4" style={CARD}>
        <div className="flex items-center gap-3">
          <Bell size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-main">
              {hasMyCat ? "아직 새 소식이 없어요" : "첫 돌봄 기록부터 시작해요"}
            </p>
            <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
              {hasMyCat
                ? "이웃의 댓글·돌봄·쪽지가 오면 여기서 알려드려요"
                : "고양이를 등록하면 이웃 소식이 모여요"}
            </p>
          </div>
          <Link
            href={hasMyCat ? "/map" : "/map"}
            className="shrink-0 h-8 px-3 flex items-center text-[13px] font-semibold press-strong"
            style={{ borderRadius: "var(--radius-input)", background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
          >
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
          <h2 className="text-[17px] font-bold text-text-main">
            새 소식
          </h2>
          <span className="text-[13px] text-text-light tabular-nums">{items.length}</span>
        </div>
        <Link
          href="/notifications"
          className="flex items-center gap-0.5 text-[13px] font-medium text-text-light active:opacity-70"
        >
          모두 보기
          <ChevronRight size={13} />
        </Link>
      </div>

      <div className="overflow-hidden" style={CARD}>
        {items.map((item, idx) => {
          const Icon = TYPE_ICON[item.type];
          const urgent = URGENT_TYPES.has(item.type);
          return (
            <Link
              key={item.id}
              href={targetHref(item)}
              className="flex items-center gap-3 px-4 press"
              style={{
                minHeight: 60,
                borderTop: idx > 0 ? "1px solid var(--color-divider)" : "none",
              }}
            >
              <Icon
                size={20}
                className="shrink-0"
                style={{ color: urgent ? "var(--color-error)" : "var(--color-text-light)" }}
                strokeWidth={1.8}
              />
              <div className="flex-1 min-w-0 py-2.5">
                <p className="text-[15px] font-semibold text-text-main leading-snug truncate">
                  {item.targetName}
                </p>
                <p className="text-[13px] text-text-sub mt-0.5 leading-snug line-clamp-1">
                  <b className="font-semibold text-text-main">{item.actorName}</b>
                  {" · "}
                  {item.message}
                </p>
              </div>
              <span className="text-[11px] text-text-light shrink-0">
                {formatTime(item.createdAt)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
