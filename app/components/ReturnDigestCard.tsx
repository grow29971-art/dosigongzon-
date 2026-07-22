"use client";

// 귀환 카드 — "다녀간 사이 내 고양이에게 생긴 일" (2026-07-22 리텐션 회의).
// 돌아온 순간에 행동 요구보다 보상이 먼저 오도록 홈 최상단에 배치.
// 데이터는 기존 알림 피드(getNotifications)를 재사용해 지난 방문 이후 건만 추린다.
// 새 일이 없으면 카드 자체를 렌더하지 않는다(빈 카드 금지 — 디자인 회의 원칙).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MailOpen } from "lucide-react";
import { getNotifications, type NotificationItem } from "@/lib/notifications-repo";

// 귀환 보상으로 의미 있는 타입만 — 내 고양이/내 활동에 온 반응
const DIGEST_TYPES = new Set([
  "comment_on_my_cat",
  "carelog_on_my_cat",
  "alert_on_my_cat",
  "comment_on_my_post",
  "following_activity",
  "invite_accepted",
]);

export default function ReturnDigestCard({ lastVisitAt }: { lastVisitAt: number | null }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (lastVisitAt === null) return; // 첫 방문 — 비교 기준 없음
    let cancelled = false;
    getNotifications(20)
      .then((all) => {
        if (cancelled) return;
        const fresh = all.filter(
          (n) => DIGEST_TYPES.has(n.type) && new Date(n.createdAt).getTime() > lastVisitAt,
        );
        setItems(fresh.slice(0, 3));
      })
      .catch(() => {
        /* 조회 실패 — 카드 미표시 */
      });
    return () => {
      cancelled = true;
    };
  }, [lastVisitAt]);

  if (items.length === 0) return null;

  return (
    <Link href="/notifications" className="block active:scale-[0.99] transition-transform">
      <div
        className="mb-4 px-4 py-3.5"
        style={{
          background: "var(--color-primary-soft)",
          borderRadius: "var(--radius-card-sm)",
          border: "1px solid rgba(173,94,59,0.14)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <MailOpen size={14} style={{ color: "var(--color-primary)" }} />
          <p className="text-[12.5px] font-extrabold" style={{ color: "var(--color-primary-dark)" }}>
            다녀간 사이
          </p>
          <span className="flex-1" />
          <span className="text-[11px] font-bold text-text-sub flex items-center gap-0.5">
            보러 가기 <ChevronRight size={12} />
          </span>
        </div>
        <div className="space-y-1">
          {items.map((n) => (
            <p key={n.id} className="text-[12.5px] text-text-main truncate">
              <b>{n.actorName}</b>
              <span className="text-text-sub">
                {"님이 "}
                {n.targetName && <>『{n.targetName}』에 </>}
                {n.message}
              </span>
            </p>
          ))}
        </div>
      </div>
    </Link>
  );
}
