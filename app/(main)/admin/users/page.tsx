"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Users,
  Loader2,
  Ban,
  CheckCircle,
  Mail,
  Clock,
  Search,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_TITLES, findAdminTitle } from "@/lib/titles";

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  admin_title: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "기록 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return formatDate(iso);
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [titleTarget, setTitleTarget] = useState<string | null>(null); // 타이틀 편집 중인 유저 ID

  const handleSetTitle = async (userId: string, titleId: string | null) => {
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/admin/set-title", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ userId, titleId }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, admin_title: titleId } : u));
        setTitleTarget(null);
      } else {
        const d = await res.json();
        alert(d.error || "실패");
      }
    } catch { alert("타이틀 부여 실패"); }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      isCurrentUserAdmin(),
      createClient().rpc("list_all_users"),
    ]).then(([admin, { data }]) => {
      if (cancelled) return;
      setIsAdmin(admin);
      setUsers((data ?? []) as UserRow[]);
    }).finally(() => {
      if (cancelled) return;
      setAuthChecked(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (!authChecked || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <Link href="/mypage" className="text-[13px] font-bold text-primary mt-4 inline-block">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.nickname.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const suspendedCount = users.filter((u) => u.is_suspended).length;

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5">
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
            가입자 관리
          </h1>
          <span className="text-[10px] font-semibold text-text-light">
            Admin · Users
          </span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-text-sub">
          <span className="flex items-center gap-1">
            <Users size={13} /> 전체 {users.length}명
          </span>
          {suspendedCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#D85555" }}>
              <Ban size={13} /> 정지 {suspendedCount}명
            </span>
          )}
        </div>
      </div>

      {/* 검색 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 mb-4"
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          border: "1px solid #E3DCD3",
        }}
      >
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 이메일 검색"
          className="flex-1 text-[13px] bg-transparent outline-none text-text-main placeholder:text-text-muted"
        />
      </div>

      {/* 유저 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-text-sub">
            {search ? "검색 결과가 없어요." : "가입자가 없어요."}
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: u.is_suspended
                  ? "linear-gradient(135deg, #FBEAEA 0%, #FFF 100%)"
                  : "#FFFFFF",
                borderRadius: 16,
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: u.is_suspended
                  ? "1px solid rgba(216,85,85,0.2)"
                  : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              {/* 아바타 */}
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[14px] font-extrabold text-primary">
                    {u.nickname.charAt(0)}
                  </span>
                </div>
              )}

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-bold text-text-main truncate">
                    {u.nickname}
                  </span>
                  {u.is_suspended && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: "#D85555", color: "#fff" }}
                    >
                      정지
                    </span>
                  )}
                  {(() => {
                    const at = findAdminTitle(u.admin_title);
                    return at ? (
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: at.color, color: "#fff" }}
                      >
                        {at.emoji} {at.name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10.5px] text-text-light flex items-center gap-0.5 truncate">
                    <Mail size={10} /> {u.email}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-light">
                  <span className="flex items-center gap-0.5">
                    <Clock size={10} /> 가입 {formatDate(u.created_at)}
                  </span>
                  <span>
                    마지막 접속 {timeAgo(u.last_sign_in_at)}
                  </span>
                </div>
                {u.is_suspended && u.suspended_reason && (
                  <p className="text-[10px] mt-1" style={{ color: "#D85555" }}>
                    정지 사유: {u.suspended_reason}
                  </p>
                )}
                {/* 타이틀 부여 버튼 */}
                <button
                  type="button"
                  onClick={() => setTitleTarget(titleTarget === u.id ? null : u.id)}
                  className="text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-lg active:scale-95"
                  style={{ backgroundColor: "#F6F1EA", color: "#C47E5A" }}
                >
                  {u.admin_title ? "🏷️ 타이틀 변경" : "🏷️ 타이틀 부여"}
                </button>
                {/* 타이틀 선택 드롭다운 */}
                {titleTarget === u.id && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {u.admin_title && (
                      <button
                        type="button"
                        onClick={() => handleSetTitle(u.id, null)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{ backgroundColor: "#FBEAEA", color: "#D85555" }}
                      >
                        ✕ 제거
                      </button>
                    )}
                    {ADMIN_TITLES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSetTitle(u.id, t.id)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{
                          backgroundColor: u.admin_title === t.id ? t.color : `${t.color}15`,
                          color: u.admin_title === t.id ? "#fff" : t.color,
                        }}
                      >
                        {t.emoji} {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
