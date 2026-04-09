"use client";

import { User, ChevronRight, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const nickname =
    user?.user_metadata?.nickname ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "사용자";

  const email = user?.email || "";

  return (
    <div className="px-5 pt-14 pb-4">
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">마이페이지</h1>

      {loading ? (
        <div className="flex justify-center mt-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : user ? (
        <>
          {/* 프로필 카드 — 로그인됨 */}
          <div className="card p-5 mt-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-[22px] bg-primary flex items-center justify-center shrink-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-16 h-16 rounded-[22px] object-cover"
                />
              ) : (
                <User size={36} color="#fff" strokeWidth={1.8} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-extrabold text-text-main truncate">{nickname}</p>
              <p className="text-[13px] text-text-light mt-0.5 truncate">{email}</p>
            </div>
          </div>

          {/* 메뉴 */}
          <div className="card mt-4 overflow-hidden">
            {["내가 쓴 글", "좋아요 한 글", "알림 설정", "공지사항", "문의하기"].map((label, i, arr) => (
              <button key={label} className={`w-full flex items-center justify-between px-5 py-4 text-left active:bg-surface-alt transition-colors ${i < arr.length - 1 ? "border-b border-divider" : ""}`}>
                <span className="text-[15px] font-medium text-text-main">{label}</span>
                <ChevronRight size={18} className="text-text-muted" />
              </button>
            ))}
          </div>

          {/* 로그아웃 */}
          <button
            onClick={handleSignOut}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-border text-text-sub text-[14px] font-medium active:scale-[0.97] transition-transform"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </>
      ) : (
        <>
          {/* 프로필 카드 — 비로그인 */}
          <Link href="/login" className="card p-5 mt-5 flex items-center gap-4 block">
            <div className="w-16 h-16 rounded-[22px] bg-primary flex items-center justify-center shrink-0">
              <User size={36} color="#fff" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="text-lg font-extrabold text-text-main">게스트</p>
              <p className="text-[13px] text-text-light mt-0.5">로그인하고 커뮤니티에 참여하세요</p>
            </div>
            <ChevronRight size={20} className="text-text-muted" />
          </Link>

          {/* 메뉴 */}
          <div className="card mt-4 overflow-hidden">
            {["공지사항", "문의하기"].map((label, i, arr) => (
              <button key={label} className={`w-full flex items-center justify-between px-5 py-4 text-left active:bg-surface-alt transition-colors ${i < arr.length - 1 ? "border-b border-divider" : ""}`}>
                <span className="text-[15px] font-medium text-text-main">{label}</span>
                <ChevronRight size={18} className="text-text-muted" />
              </button>
            ))}
          </div>
        </>
      )}

      <p className="text-center text-[11px] text-text-muted mt-6">도시공존 v0.1.0</p>
    </div>
  );
}
