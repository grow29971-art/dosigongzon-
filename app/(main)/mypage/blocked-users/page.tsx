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
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-[14px] text-text-sub">로그인이 필요해요.</p>
        <Link href="/login?next=%2Fmypage%2Fblocked-users" className="inline-block mt-4 text-[13px] font-bold text-primary">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="마이페이지로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[16px] font-extrabold text-text-main">차단한 사용자</h1>
      </div>

      <div className="px-4 mt-3">
        {/* 안내 카드 */}
        <div
          className="rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{ backgroundColor: "#FBEAEA", border: "1px solid #E8C5C5" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #D85555 0%, #B84545 100%)" }}
          >
            <Ban size={16} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-extrabold" style={{ color: "#4A3F35" }}>
              차단된 사용자와는 메시지·댓글이 보이지 않아요
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "#A38E7A" }}>
              아래 목록에서 언제든 해제할 수 있어요.
            </p>
          </div>
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <div
            className="rounded-2xl py-12 px-4 text-center"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "#F6F1EA" }}
            >
              <Users size={24} style={{ color: "#A38E7A" }} strokeWidth={1.8} />
            </div>
            <p className="text-[13px] font-extrabold text-text-main">
              차단한 사용자가 없어요
            </p>
            <p className="text-[11px] text-text-sub mt-1">
              불편한 사용자가 있으면 프로필에서 차단할 수 있어요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((b) => {
              const rawAvatar = sanitizeImageUrl(b.avatar_url, "");
              const avatar = thumbnailUrl(rawAvatar, 72) ?? rawAvatar;
              return (
                <div
                  key={b.id}
                  className="rounded-2xl p-3 flex items-center gap-3"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)" }}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover shrink-0 grayscale"
                      style={{ border: "1.5px solid #E5E0D6" }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#EEE8E0", border: "1.5px solid #E5E0D6" }}
                    >
                      <span className="text-[14px] font-extrabold" style={{ color: "#A38E7A" }}>
                        {(b.nickname ?? "?").charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-extrabold text-text-main truncate">
                      {b.nickname ?? "이름 없음"}
                    </p>
                    <p className="text-[10.5px] text-text-light mt-0.5">
                      {formatDate(b.created_at)} 차단
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(b)}
                    disabled={busyId === b.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11.5px] font-bold active:scale-95 transition-transform disabled:opacity-60"
                    style={{ backgroundColor: "#F6F1EA", color: "#A38E7A", border: "1px solid #E3DCD3" }}
                  >
                    {busyId === b.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <ShieldOff size={11} strokeWidth={2.5} />
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
