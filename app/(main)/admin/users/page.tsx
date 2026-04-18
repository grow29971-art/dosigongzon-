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
  ArrowDownUp,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_TITLES, findAdminTitle } from "@/lib/titles";
import { suspendUser, unsuspendUser } from "@/lib/support-repo";

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
  provider: string | null;
  providers: string[] | null;
}

// 로그인 방식 뱃지 설정
const PROVIDER_META: Record<string, { label: string; bg: string; fg: string; emoji: string }> = {
  google:     { label: "구글",     bg: "#E3EBF7", fg: "#3A6CB5", emoji: "🟦" },
  kakao:      { label: "카카오",   bg: "#FEF4C8", fg: "#7A5F16", emoji: "🟨" },
  email:      { label: "이메일",   bg: "#EEE8E0", fg: "#8B5A3C", emoji: "✉️" },
  apple:      { label: "애플",     bg: "#E5E5E5", fg: "#2A2A28", emoji: "" },
  naver:      { label: "네이버",   bg: "#E0F0E4", fg: "#1C7A33", emoji: "🟩" },
  facebook:   { label: "페이스북", bg: "#E4EAF5", fg: "#3B5998", emoji: "Ⓕ" },
};

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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const handleSuspend = async (u: UserRow) => {
    const daysStr = prompt(
      `"${u.nickname}" 님을 정지할까요?\n며칠 정지할지 입력 (영구는 0):`,
      "7",
    );
    if (daysStr === null) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 0) {
      alert("숫자로 입력해주세요 (0=영구, 1이상=일수)");
      return;
    }
    const reason = prompt("정지 사유:", "커뮤니티 규정 위반");
    if (reason === null || !reason.trim()) return;

    setBusyUserId(u.id);
    try {
      await suspendUser(u.id, reason.trim(), days === 0 ? null : days);
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, is_suspended: true, suspended_reason: reason.trim() } : x,
        ),
      );
      alert(days === 0 ? "영구 정지됐어요." : `${days}일 정지됐어요.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "정지 실패");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleUnsuspend = async (u: UserRow) => {
    if (!confirm(`"${u.nickname}" 님의 정지를 해제할까요?`)) return;
    setBusyUserId(u.id);
    try {
      await unsuspendUser(u.id);
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, is_suspended: false, suspended_reason: null } : x,
        ),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "해제 실패");
    } finally {
      setBusyUserId(null);
    }
  };

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

  // 검색 + provider 필터
  let filtered = search.trim()
    ? users.filter(
        (u) =>
          u.nickname.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  if (providerFilter) {
    filtered = filtered.filter((u) => (u.provider ?? "email") === providerFilter);
  }

  // 정렬
  filtered = [...filtered].sort((a, b) => {
    const at = new Date(a.created_at).getTime();
    const bt = new Date(b.created_at).getTime();
    return sortOrder === "newest" ? bt - at : at - bt;
  });

  const suspendedCount = users.filter((u) => u.is_suspended).length;

  // provider 집계
  const providerCounts = users.reduce<Record<string, number>>((acc, u) => {
    const p = u.provider ?? "email";
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

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

      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex-1 flex items-center gap-2 px-4 py-2.5"
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
        <button
          type="button"
          onClick={() => setSortOrder((s) => s === "newest" ? "oldest" : "newest")}
          className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-bold active:scale-95 shrink-0"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E3DCD3",
            color: "#333",
          }}
        >
          <ArrowDownUp size={13} />
          {sortOrder === "newest" ? "최신 가입순" : "오래된순"}
        </button>
      </div>

      {/* Provider 필터 칩 */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
        <button
          type="button"
          onClick={() => setProviderFilter(null)}
          className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 shrink-0"
          style={{
            background: providerFilter === null ? "#2C2C2C" : "rgba(255,255,255,0.9)",
            color: providerFilter === null ? "#fff" : "#555",
            border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          전체 {users.length}
        </button>
        {Object.entries(providerCounts).sort((a,b) => b[1]-a[1]).map(([p, cnt]) => {
          const meta = PROVIDER_META[p] ?? { label: p, bg: "#EEE", fg: "#555", emoji: "" };
          const active = providerFilter === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProviderFilter(active ? null : p)}
              className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 shrink-0 flex items-center gap-1"
              style={{
                background: active ? meta.fg : meta.bg,
                color: active ? "#fff" : meta.fg,
              }}
            >
              {meta.emoji} {meta.label} {cnt}
            </button>
          );
        })}
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] font-bold text-text-main truncate">
                    {u.nickname}
                  </span>
                  {(() => {
                    const p = u.provider ?? "email";
                    const meta = PROVIDER_META[p] ?? { label: p, bg: "#EEE", fg: "#555", emoji: "" };
                    return (
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: meta.bg, color: meta.fg }}
                        title={`로그인: ${meta.label}`}
                      >
                        {meta.emoji} {meta.label}
                      </span>
                    );
                  })()}
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
                {/* 액션 버튼들 */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTitleTarget(titleTarget === u.id ? null : u.id)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg active:scale-95"
                    style={{ backgroundColor: "#F6F1EA", color: "#C47E5A" }}
                  >
                    {u.admin_title ? "🏷️ 타이틀 변경" : "🏷️ 타이틀 부여"}
                  </button>
                  {u.is_suspended ? (
                    <button
                      type="button"
                      onClick={() => handleUnsuspend(u)}
                      disabled={busyUserId === u.id}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50 flex items-center gap-1"
                      style={{ backgroundColor: "#E8F4E8", color: "#3F5B42" }}
                    >
                      {busyUserId === u.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                      정지 해제
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSuspend(u)}
                      disabled={busyUserId === u.id}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg active:scale-95 disabled:opacity-50 flex items-center gap-1"
                      style={{ backgroundColor: "#FBEAEA", color: "#B84545" }}
                    >
                      {busyUserId === u.id ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                      정지
                    </button>
                  )}
                </div>
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
