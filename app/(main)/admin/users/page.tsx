"use client";

// 가입자 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(원형 아바타), 로그인 방식·타이틀 회색 태그(이모지 참조 끊음), 필터 칩, 헤어라인 버튼. 토큰만.

import { useEffect, useState } from "react";
import {
  Loader2,
  Ban,
  CheckCircle,
  Mail,
  Clock,
  Search,
  ArrowDownUp,
  X,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_TITLES, findAdminTitle } from "@/lib/titles";
import { suspendUser, unsuspendUser } from "@/lib/support-repo";
import UIChip from "@/app/components/ui/Chip";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, HairlineButton, inputStyle,
} from "../_ui";

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

// 로그인 방식 라벨
const PROVIDER_LABEL: Record<string, string> = {
  google: "구글",
  kakao: "카카오",
  email: "이메일",
  apple: "애플",
  naver: "네이버",
  facebook: "페이스북",
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

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

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
    <AdminPage>
      <AdminHeader
        title="가입자 관리"
        description={
          <>
            전체 {users.length}명
            {suspendedCount > 0 && (
              <span style={{ color: "var(--color-error)" }}> · 정지 {suspendedCount}명</span>
            )}
          </>
        }
        back="/mypage"
        backLabel="마이페이지"
      />

      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 px-3 h-10 bg-surface" style={inputStyle}>
          <Search size={16} className="text-text-light shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="flex-1 min-w-0 text-[15px] bg-transparent outline-none text-text-main placeholder:text-text-muted"
          />
        </div>
        <HairlineButton
          size="md"
          onClick={() => setSortOrder((s) => s === "newest" ? "oldest" : "newest")}
          icon={<ArrowDownUp size={13} />}
        >
          {sortOrder === "newest" ? "최신 가입순" : "오래된순"}
        </HairlineButton>
      </div>

      {/* Provider 필터 칩 */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        <UIChip active={providerFilter === null} onClick={() => setProviderFilter(null)}>
          전체 <span className="tabular-nums">{users.length}</span>
        </UIChip>
        {Object.entries(providerCounts).sort((a, b) => b[1] - a[1]).map(([p, cnt]) => {
          const active = providerFilter === p;
          return (
            <UIChip key={p} active={active} onClick={() => setProviderFilter(active ? null : p)}>
              {PROVIDER_LABEL[p] ?? p} <span className="tabular-nums">{cnt}</span>
            </UIChip>
          );
        })}
      </div>

      {/* 유저 목록 */}
      <AdminSection padding={false}>
        {filtered.length === 0 ? (
          <EmptyState>{search ? "검색 결과가 없어요." : "가입자가 없어요."}</EmptyState>
        ) : (
          filtered.map((u) => {
            const p = u.provider ?? "email";
            const at = findAdminTitle(u.admin_title);
            return (
              <div
                key={u.id}
                className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-b-0"
                style={{ opacity: u.is_suspended ? 0.7 : 1 }}
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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-surface-alt)" }}>
                    <span className="text-[15px] font-bold text-text-sub">{u.nickname.charAt(0)}</span>
                  </div>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[15px] font-semibold text-text-main truncate">{u.nickname}</span>
                    <AdminTag>{PROVIDER_LABEL[p] ?? p}</AdminTag>
                    {u.is_suspended && <AdminTag tone="error">정지</AdminTag>}
                    {at && <AdminTag tone="primary">{at.name}</AdminTag>}
                  </div>
                  <p className="text-[13px] text-text-light flex items-center gap-1 truncate mt-0.5">
                    <Mail size={11} className="shrink-0" /> {u.email}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-[13px] text-text-light">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> 가입 {formatDate(u.created_at)}
                    </span>
                    <span>마지막 접속 {timeAgo(u.last_sign_in_at)}</span>
                  </div>
                  {u.is_suspended && u.suspended_reason && (
                    <p className="text-[13px] mt-1" style={{ color: "var(--color-error)" }}>
                      정지 사유: {u.suspended_reason}
                    </p>
                  )}
                  {/* 액션 버튼들 */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <HairlineButton onClick={() => setTitleTarget(titleTarget === u.id ? null : u.id)}>
                      {u.admin_title ? "타이틀 변경" : "타이틀 부여"}
                    </HairlineButton>
                    {u.is_suspended ? (
                      <HairlineButton
                        tone="sage"
                        onClick={() => handleUnsuspend(u)}
                        disabled={busyUserId === u.id}
                        icon={busyUserId === u.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      >
                        정지 해제
                      </HairlineButton>
                    ) : (
                      <HairlineButton
                        tone="error"
                        onClick={() => handleSuspend(u)}
                        disabled={busyUserId === u.id}
                        icon={busyUserId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                      >
                        정지
                      </HairlineButton>
                    )}
                  </div>
                  {/* 타이틀 선택 */}
                  {titleTarget === u.id && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {u.admin_title && (
                        <UIChip activeColor="var(--color-error)" onClick={() => handleSetTitle(u.id, null)} icon={<X size={12} />}>
                          제거
                        </UIChip>
                      )}
                      {ADMIN_TITLES.filter((t) => !t.hidden).map((t) => (
                        <UIChip key={t.id} active={u.admin_title === t.id} onClick={() => handleSetTitle(u.id, t.id)}>
                          {t.name}
                        </UIChip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </AdminSection>
    </AdminPage>
  );
}
