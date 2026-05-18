"use client";

// Private Circle 관리 페이지 — 내가 승인한 이웃에게만 핀 노출.
// 학대 우려 케어테이커가 안전하게 위치를 공유할 수 있는 신뢰 그룹.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  Users,
  UserPlus,
  Search,
  X,
  Check,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listMyCircleMembers,
  listMyPendingInvitations,
  searchUsersByNickname,
  inviteToCircle,
  removeCircleMember,
  respondToInvitation,
  type CircleMember,
  type PendingInvitation,
} from "@/lib/circles-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl } from "@/lib/cats-repo";

type SearchUser = { id: string; nickname: string | null; avatar_url: string | null };

export default function CirclePage() {
  const { user, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // 초대 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([listMyCircleMembers(), listMyPendingInvitations()]);
      setMembers(m);
      setInvitations(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUsersByNickname(q);
      // 이미 멤버인 사람 제외
      const memberIds = new Set(members.map((m) => m.member_id));
      setSearchResults(results.filter((r) => !memberIds.has(r.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (u: SearchUser) => {
    if (busy) return;
    setBusy(u.id);
    try {
      await inviteToCircle(u.id);
      setSearchResults((prev) => prev.filter((r) => r.id !== u.id));
      setSearchQuery("");
      setSearchOpen(false);
      await loadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "초대 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (m: CircleMember) => {
    if (busy) return;
    if (!confirm(`${m.member_nickname ?? "이 멤버"}를 서클에서 내보낼까요?`)) return;
    setBusy(m.member_id);
    try {
      await removeCircleMember(m.member_id);
      setMembers((prev) => prev.filter((x) => x.member_id !== m.member_id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "제거 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleRespond = async (inv: PendingInvitation, status: "accepted" | "rejected") => {
    if (busy) return;
    setBusy(inv.id);
    try {
      await respondToInvitation(inv.id, status);
      setInvitations((prev) => prev.filter((x) => x.id !== inv.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "응답 실패");
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="text-[14px] text-text-sub mb-3">로그인이 필요한 기능이에요.</p>
        <Link href="/login" className="inline-block px-5 py-2 rounded-xl bg-primary text-white font-bold text-[13px]">
          로그인
        </Link>
      </div>
    );
  }

  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");

  return (
    <div className="min-h-dvh pb-6" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-2 sticky top-0 z-10" style={{ background: "#F7F4EE" }}>
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="마이페이지로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[16px] font-extrabold text-text-main">내 서클</h1>
      </div>

      {/* 설명 카드 */}
      <section className="px-5 mt-2">
        <div
          className="rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            background: "linear-gradient(135deg, rgba(107,142,111,0.10) 0%, rgba(107,142,111,0.04) 100%)",
            border: "1px solid rgba(107,142,111,0.22)",
          }}
        >
          <ShieldCheck size={20} className="shrink-0 mt-0.5" style={{ color: "#4F6B53" }} />
          <p className="text-[12px] text-text-sub leading-relaxed">
            서클 멤버에게만 보이는 고양이를 등록할 수 있어요. 학대 우려가 큰 아이를
            <b className="text-text-main"> 믿는 이웃</b>과만 공유하세요. 등록할 때 공개 범위를
            <b className="text-text-main"> "내 서클"</b>로 선택하면 적용돼요.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center pt-12">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 받은 초대 */}
          {invitations.length > 0 && (
            <section className="px-5 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Mail size={14} style={{ color: "#C47E5A" }} />
                <h2 className="text-[14px] font-extrabold text-text-main">받은 초대</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#C47E5A" }}>
                  {invitations.length}
                </span>
              </div>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl p-3 flex items-center gap-3"
                    style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                  >
                    <Avatar url={inv.owner_avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold text-text-main truncate">
                        {inv.owner_nickname ?? "익명 케어테이커"}
                      </p>
                      <p className="text-[11px] text-text-light">서클 초대를 보냈어요</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRespond(inv, "accepted")}
                        disabled={busy === inv.id}
                        className="px-3 py-2 rounded-xl text-[12px] font-extrabold text-white active:scale-95 disabled:opacity-50"
                        style={{ background: "#6B8E6F" }}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => handleRespond(inv, "rejected")}
                        disabled={busy === inv.id}
                        className="px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95 disabled:opacity-50"
                        style={{ background: "#EEE8E0", color: "#8B7562" }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 멤버 초대 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={14} style={{ color: "#4A7BA8" }} />
              <h2 className="text-[14px] font-extrabold text-text-main">멤버 초대</h2>
            </div>
            <div className="bg-white rounded-2xl p-3" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#F6F1EA" }}>
                  <Search size={14} className="text-text-light shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="닉네임 검색 (2자 이상)"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-muted"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.trim().length < 2}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-[12.5px] font-extrabold active:scale-95 disabled:opacity-40"
                >
                  {searching ? <Loader2 size={13} className="animate-spin" /> : "검색"}
                </button>
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchResults.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                      style={{ background: "#F9F6F1" }}
                    >
                      <Avatar url={r.avatar_url} size={32} />
                      <p className="flex-1 min-w-0 text-[12.5px] font-bold text-text-main truncate">
                        {r.nickname ?? "익명"}
                      </p>
                      <button
                        onClick={() => handleInvite(r)}
                        disabled={busy === r.id}
                        className="px-3 py-1.5 rounded-lg text-[11.5px] font-extrabold text-white active:scale-95 disabled:opacity-50"
                        style={{ background: "#4A7BA8" }}
                      >
                        {busy === r.id ? <Loader2 size={11} className="animate-spin" /> : "초대"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {searchOpen && searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="mt-2 text-[11px] text-text-light text-center py-2">검색 결과가 없어요.</p>
              )}
            </div>
          </section>

          {/* 멤버 목록 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: "#6B8E6F" }} />
              <h2 className="text-[14px] font-extrabold text-text-main">내 서클 멤버</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#6B8E6F" }}>
                {acceptedMembers.length}
              </span>
            </div>
            {acceptedMembers.length === 0 && pendingMembers.length === 0 ? (
              <div
                className="rounded-2xl p-6 text-center"
                style={{ background: "#F9F6F1", border: "1px dashed #E3DCD3" }}
              >
                <p className="text-[12.5px] text-text-sub leading-relaxed">
                  아직 서클 멤버가 없어요.
                  <br />
                  위에서 닉네임을 검색해 초대해보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingMembers.map((m) => (
                  <MemberRow key={m.id} member={m} pending busy={busy === m.member_id} onRemove={() => handleRemove(m)} />
                ))}
                {acceptedMembers.map((m) => (
                  <MemberRow key={m.id} member={m} busy={busy === m.member_id} onRemove={() => handleRemove(m)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Avatar({ url, size = 40 }: { url: string | null; size?: number }) {
  const safe = sanitizeImageUrl(url, "");
  if (!safe) {
    return (
      <div
        className="shrink-0 rounded-full flex items-center justify-center text-white text-[13px] font-extrabold"
        style={{ width: size, height: size, background: "linear-gradient(135deg, #C47E5A, #A8684A)" }}
      >
        🐾
      </div>
    );
  }
  const thumb = thumbnailUrl(safe, size * 2) ?? safe;
  return (
    <Image
      src={thumb}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      unoptimized
    />
  );
}

function MemberRow({
  member,
  pending,
  busy,
  onRemove,
}: {
  member: CircleMember;
  pending?: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-3 flex items-center gap-3"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <Avatar url={member.member_avatar_url ?? null} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-extrabold text-text-main truncate">
          {member.member_nickname ?? "익명 케어테이커"}
        </p>
        <p className="text-[11px]" style={{ color: pending ? "#C9A961" : "#6B8E6F" }}>
          {pending ? "수락 대기 중" : "수락됨"}
        </p>
      </div>
      <button
        onClick={onRemove}
        disabled={busy}
        className="px-3 py-2 rounded-xl text-[12px] font-bold active:scale-95 disabled:opacity-50"
        style={{ background: "#EEE8E0", color: "#8B7562" }}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : "내보내기"}
      </button>
    </div>
  );
}
