"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Ban, ShieldOff, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listMyBlockedUsers, unblockUser, type BlockedUser } from "@/lib/blocks-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl } from "@/lib/cats-repo";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function BlockedUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyBlockedUsers()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [user]);

  const handleUnblock = async (b: BlockedUser) => {
    if (busyId) return;
    if (!confirm(`${b.nickname ?? "이 사용자"}님 차단을 해제할까요?`)) return;
    setBusyId(b.id);
    try {
      await unblockUser(b.id);
      setItems((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "해제 실패");
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-[15px] text-text-sub">로그인이 필요해요.</p>
        <Link href="/login?next=%2Fmypage%2Fblocked-users" className="inline-block mt-4 text-[13px] font-semibold text-primary">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="마이페이지로"
        >
          <ArrowLeft size={22} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">차단한 사용자</h1>
      </div>

      <div className="px-4 mt-3">
        {/* 안내 */}
        <div className="px-1 pb-3 mb-3 flex items-start gap-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <Ban size={18} className="text-text-light shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-text-main">
              차단된 사용자와는 메시지·댓글이 보이지 않아요
            </p>
            <p className="text-[13px] mt-0.5 text-text-sub">
              언제든 해제할 수 있어요.
            </p>
          </div>
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <div className="card py-12 px-4 text-center">
            <Users size={28} className="mx-auto mb-3 text-text-light" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-text-main">
              차단한 사용자가 없어요
            </p>
            <p className="text-[13px] text-text-sub mt-1">
              불편한 사용자는 프로필에서 차단할 수 있어요.
            </p>
          </div>
        ) : (
          <div className="card px-4">
            {items.map((b) => {
              const rawAvatar = sanitizeImageUrl(b.avatar_url, "");
              const avatar = thumbnailUrl(rawAvatar, 72) ?? rawAvatar;
              return (
                <div
                  key={b.id}
                  className="py-3 flex items-center gap-3 border-b border-divider last:border-b-0"
                  style={{ minHeight: 64 }}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover shrink-0 grayscale"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "var(--color-gray-100)" }}
                    >
                      <span className="text-[15px] font-semibold text-text-light">
                        {(b.nickname ?? "?").charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-main truncate">
                      {b.nickname ?? "이름 없음"}
                    </p>
                    <p className="text-[13px] text-text-light mt-0.5">
                      {formatDate(b.created_at)} 차단
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(b)}
                    disabled={busyId === b.id}
                    className="flex items-center gap-1 px-3 h-8 rounded-lg text-[13px] font-semibold press-strong transition-transform disabled:opacity-60"
                    style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-text-main)" }}
                  >
                    {busyId === b.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldOff size={12} strokeWidth={2} />
                    )}
                    해제
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
