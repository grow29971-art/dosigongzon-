"use client";

// Private Circle 관리 페이지 — 내가 승인한 이웃에게만 핀 노출.
// 학대 우려 케어테이커가 안전하게 위치를 공유할 수 있는 신뢰 그룹.

import { useCallback, useEffect, useState } from "react";
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
  Link2,
  Copy,
  MessageCircle,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import { shareToKakao } from "@/lib/kakao-share";
import {
  listMyCircleMembers,
  listMyPendingInvitations,
  searchUsersByNickname,
  inviteToCircle,
  removeCircleMember,
  respondToInvitation,
  getOrCreateMyCircle,
  type CircleMember,
  type PendingInvitation,
} from "@/lib/circles-repo";
import { listJoinedCircles, listMyUnreadCircles, type JoinedCircle } from "@/lib/circle-chat-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl } from "@/lib/cats-repo";

type SearchUser = { id: string; nickname: string | null; avatar_url: string | null };
type CareShift = {
  id: string;
  requester_id: string;
  assignee_id: string;
  starts_at: string;
  note: string | null;
  status: "requested" | "accepted" | "completed";
};

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
  const [copied, setCopied] = useState(false);
  const [myCircleId, setMyCircleId] = useState<string | null>(null);
  const [joinedCircles, setJoinedCircles] = useState<JoinedCircle[]>([]);
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());
  const [shiftAssigneeId, setShiftAssigneeId] = useState("");
  const [shiftStartsAt, setShiftStartsAt] = useState("");
  const [shiftNote, setShiftNote] = useState("");
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [careShifts, setCareShifts] = useState<CareShift[]>([]);
  const [careShiftsLoading, setCareShiftsLoading] = useState(false);
  const [careShiftTransitioning, setCareShiftTransitioning] = useState<string | null>(null);

  const inviteUrl = user ? `https://dosigongzon.com/circle/join/${user.id}` : "";

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("초대 링크를 복사해주세요:", inviteUrl);
    }
  };

  const handleKakaoShare = async () => {
    if (!user) return;
    const myNickname = (user.user_metadata?.nickname as string | undefined) ?? "이웃";
    const ok = await shareToKakao({
      title: `🛡 ${myNickname}님의 도시공존 서클 초대`,
      description: "내 서클에 합류하면 함께 길고양이를 안전하게 돌볼 수 있어요.",
      imageUrl: "https://dosigongzon.com/opengraph-image",
      url: inviteUrl,
      buttonText: "초대 수락하기",
    });
    if (!ok) {
      // 폴백: 클립보드 복사
      await handleCopyInviteUrl();
      alert("카카오톡 공유가 작동하지 않아 링크를 복사했어요. 카톡에 붙여넣기 해주세요.");
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, inv, circle, joined, unread] = await Promise.all([
        listMyCircleMembers(),
        listMyPendingInvitations(),
        getOrCreateMyCircle(),
        listJoinedCircles(),
        listMyUnreadCircles(),
      ]);
      setMembers(m);
      setInvitations(inv);
      setMyCircleId(circle.id);
      setJoinedCircles(joined);
      const map = new Map<string, number>();
      for (const u of unread) map.set(u.circle_id, u.unread_count);
      setUnreadMap(map);
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

  const loadCareShifts = useCallback(async () => {
    if (!user || !isCoreJourneyEnabled("P3")) return;
    setCareShiftsLoading(true);
    try {
      const response = await fetch("/api/care-shifts");
      const result = (await response.json()) as { shifts?: CareShift[] };
      if (response.ok) setCareShifts(result.shifts ?? []);
    } catch (error) {
      console.error("[care-shifts] load failed", error);
    } finally {
      setCareShiftsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadCareShifts();
  }, [loadCareShifts]);

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

  const handleCreateCareShift = async () => {
    if (!myCircleId || !shiftAssigneeId || !shiftStartsAt || shiftSubmitting) return;
    setShiftSubmitting(true);
    try {
      const response = await fetch("/api/care-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          circle_id: myCircleId,
          assignee_id: shiftAssigneeId,
          starts_at: new Date(shiftStartsAt).toISOString(),
          note: shiftNote.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "교대 요청을 만들지 못했어요.");
      setShiftStartsAt("");
      setShiftNote("");
      await loadCareShifts();
      alert("돌봄 교대를 요청했어요.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "교대 요청을 만들지 못했어요.");
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCareShiftTransition = async (
    shift: CareShift,
    status: "accepted" | "completed",
  ) => {
    if (careShiftTransitioning) return;
    setCareShiftTransitioning(shift.id);
    try {
      const response = await fetch("/api/care-shifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shift.id, status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "교대 상태를 바꾸지 못했어요.");
      await loadCareShifts();
    } catch (error) {
      alert(error instanceof Error ? error.message : "교대 상태를 바꾸지 못했어요.");
    } finally {
      setCareShiftTransitioning(null);
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
  const showCareShift = isCoreJourneyEnabled("P3");

  return (
    <div className="min-h-dvh pb-6" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-2 sticky top-0 z-10" style={{ background: "#F7F4EE" }}>
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
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
            <b className="text-text-main"> &quot;내 서클&quot;</b>로 선택하면 적용돼요.
          </p>
        </div>
      </section>

      {showCareShift && (
        <section className="px-5 mt-5" aria-labelledby="care-shift-heading">
          <div
            className="rounded-2xl bg-white p-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(107,142,111,0.12)", color: "#4F6B53" }}
              >
                <Clock3 size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 id="care-shift-heading" className="text-[15px] font-extrabold text-text-main">
                  돌봄 교대
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-text-sub">
                  서클 이웃에게 빈 시간의 돌봄을 부탁하고, 수락부터 완료까지 함께 확인해요.
                </p>
              </div>
            </div>
            <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-text-sub">
              <li className="rounded-xl bg-[#F7F4EE] px-2 py-2">1. 요청</li>
              <li className="rounded-xl bg-[#F7F4EE] px-2 py-2">2. 수락</li>
              <li className="rounded-xl bg-[#F7F4EE] px-2 py-2">3. 완료</li>
            </ol>
            {acceptedMembers.length > 0 ? (
              <div className="mt-4 space-y-3 border-t border-black/5 pt-4">
                <label className="block text-[12px] font-bold text-text-main">
                  부탁할 이웃
                  <select
                    value={shiftAssigneeId}
                    onChange={(event) => setShiftAssigneeId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[13px] font-normal"
                  >
                    <option value="">서클 이웃 선택</option>
                    {acceptedMembers.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {member.member_nickname ?? "이웃"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[12px] font-bold text-text-main">
                  돌봄 시작 시각
                  <input
                    type="datetime-local"
                    value={shiftStartsAt}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    onChange={(event) => setShiftStartsAt(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[13px] font-normal"
                  />
                </label>
                <label className="block text-[12px] font-bold text-text-main">
                  메모 <span className="font-normal text-text-light">(선택)</span>
                  <textarea
                    value={shiftNote}
                    maxLength={500}
                    onChange={(event) => setShiftNote(event.target.value)}
                    placeholder="급식 위치나 필요한 돌봄을 알려주세요."
                    className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[13px] font-normal"
                  />
                </label>
                <button
                  type="button"
                  disabled={!shiftAssigneeId || !shiftStartsAt || shiftSubmitting}
                  onClick={handleCreateCareShift}
                  className="min-h-11 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
                >
                  {shiftSubmitting ? "요청 중..." : "돌봄 교대 요청"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-text-light">
                교대를 부탁하려면 먼저 서클 이웃의 초대 수락이 필요해요.
              </p>
            )}
            <div className="mt-4 border-t border-black/5 pt-4">
              <h3 className="text-[12px] font-extrabold text-text-main">내 돌봄 교대</h3>
              {careShiftsLoading ? (
                <div className="flex justify-center py-5" aria-label="돌봄 교대 불러오는 중">
                  <Loader2 size={18} className="animate-spin text-primary" />
                </div>
              ) : careShifts.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {careShifts.map((shift) => {
                    const assignee = acceptedMembers.find(
                      (member) => member.member_id === shift.assignee_id,
                    );
                    const statusLabel = {
                      requested: "요청됨",
                      accepted: "수락됨",
                      completed: "완료",
                    }[shift.status];
                    return (
                      <li key={shift.id} className="rounded-xl bg-[#F7F4EE] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-bold text-text-main">
                            {shift.requester_id === user.id
                              ? `${assignee?.member_nickname ?? "이웃"}에게 요청`
                              : "받은 교대 요청"}
                          </p>
                          <span className="shrink-0 text-[11px] font-bold text-primary">
                            {statusLabel}
                          </span>
                        </div>
                        <time className="mt-1 block text-[11px] text-text-sub" dateTime={shift.starts_at}>
                          {new Intl.DateTimeFormat("ko-KR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(shift.starts_at))}
                        </time>
                        {shift.note && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-text-sub">{shift.note}</p>
                        )}
                        {shift.assignee_id === user.id && shift.status !== "completed" && (
                          <button
                            type="button"
                            disabled={careShiftTransitioning !== null}
                            onClick={() =>
                              handleCareShiftTransition(
                                shift,
                                shift.status === "requested" ? "accepted" : "completed",
                              )
                            }
                            className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-40"
                          >
                            {careShiftTransitioning === shift.id
                              ? "처리 중..."
                              : shift.status === "requested"
                                ? "돌봄 수락"
                                : "돌봄 완료"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-text-light">아직 돌봄 교대 요청이 없어요.</p>
              )}
            </div>
          </div>
        </section>
      )}

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
                <Mail size={14} style={{ color: "var(--color-primary)" }} />
                <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">받은 초대</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 chip-square text-white" style={{ background: "var(--color-primary)" }}>
                  {invitations.length}
                </span>
              </div>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl p-3 flex items-center gap-3"
                    style={{ boxShadow: "var(--shadow-card)" }}
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

          {/* 서클 채팅 진입 */}
          {myCircleId && (
            <section className="px-5 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle size={14} style={{ color: "var(--color-primary)" }} />
                <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">서클 채팅</h2>
              </div>
              <Link
                href={`/circle/${myCircleId}/chat`}
                className="w-full block rounded-2xl p-4 active:scale-[0.99] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #FFF9F2 0%, #FCEFD9 100%)",
                  border: "1px solid rgba(173, 94, 59,0.22)",
                  boxShadow: "0 2px 10px rgba(173, 94, 59,0.10)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
                  >
                    <MessageCircle size={20} color="#fff" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold text-text-main">내 서클 채팅방 열기</p>
                    <p className="text-[11px] text-text-sub mt-0.5">
                      멤버끼리 한 채팅방에서 대화 · 실시간 동기화
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-primary)", opacity: 0.7 }} />
                </div>
              </Link>

              {/* 참여 중인 다른 서클 (멤버로 들어가 있는 곳) */}
              {joinedCircles.filter((c) => c.role === "member").length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-text-light mb-2 ml-1">참여 중인 다른 서클</p>
                  <div className="space-y-1.5">
                    {joinedCircles
                      .filter((c) => c.role === "member")
                      .map((c) => {
                        const unread = unreadMap.get(c.circle_id) ?? 0;
                        return (
                          <Link
                            key={c.circle_id}
                            href={`/circle/${c.circle_id}/chat`}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white active:scale-[0.99]"
                            style={{ boxShadow: "var(--shadow-card-sm)", border: "1px solid #F0E6D8" }}
                          >
                            <Avatar url={c.owner_avatar_url} size={36} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-extrabold text-text-main truncate">
                                {c.owner_nickname ?? "익명"}님의 서클
                              </p>
                              <p className="text-[10.5px] text-text-light">멤버 {c.member_count + 1}명</p>
                            </div>
                            {unread > 0 && (
                              <span
                                className="shrink-0 px-2 py-0.5 chip-square text-[10.5px] font-extrabold leading-none"
                                style={{ background: "#D85555", color: "#FFF" }}
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                            <ChevronRight size={14} className="shrink-0 text-text-light" />
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 카카오톡 초대 링크 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={14} style={{ color: "#FEE500" }} />
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">초대 링크</h2>
              <span className="text-[9px] font-extrabold tracking-[0.15em] px-1.5 py-0.5 chip-square" style={{ background: "#FEE500", color: "#191919" }}>
                빠른 초대
              </span>
            </div>
            <div
              className="rounded-2xl p-3"
              style={{ boxShadow: "var(--shadow-card)", background: "linear-gradient(135deg, #FFFEF5 0%, #FFF8DC 100%)", border: "1px solid rgba(254,229,0,0.4)" }}
            >
              <p className="text-[11.5px] leading-relaxed mb-2.5" style={{ color: "#6B5916" }}>
                링크 한 번이면 친한 이웃을 바로 서클에 초대할 수 있어요. 카카오톡으로 공유 → 받는 사람이 수락하면 즉시 멤버.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleKakaoShare}
                  className="flex-[1.5] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-extrabold active:scale-95"
                  style={{ background: "#FEE500", color: "#191919" }}
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M9 1.5C4.582 1.5 1 4.262 1 7.668c0 2.219 1.51 4.166 3.788 5.272-.167.625-.604 2.265-.69 2.617-.108.438.16.43.336.314.138-.092 2.198-1.5 3.083-2.107.49.073.99.111 1.483.111 4.418 0 8-2.762 8-6.207C17 4.262 13.418 1.5 9 1.5z" fill="#191919" />
                  </svg>
                  카카오톡 공유
                </button>
                <button
                  onClick={handleCopyInviteUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold active:scale-95"
                  style={{ background: "#FFFFFF", color: "#6B5916", border: "1px solid rgba(254,229,0,0.5)" }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "복사됨" : "링크 복사"}
                </button>
              </div>
            </div>
          </section>

          {/* 닉네임 검색 초대 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={14} style={{ color: "#4A7BA8" }} />
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">닉네임 검색 초대</h2>
            </div>
            <div className="bg-white rounded-2xl p-3" style={{ boxShadow: "var(--shadow-card)" }}>
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
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">내 서클 멤버</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 chip-square text-white" style={{ background: "#6B8E6F" }}>
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
        style={{ width: size, height: size, background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))" }}
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
      style={{ boxShadow: "var(--shadow-card)" }}
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
