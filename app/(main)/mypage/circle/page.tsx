"use client";

// Private Circle 관리 페이지 — 내가 승인한 이웃에게만 핀 노출.
// 학대 우려 길집사가 안전하게 위치를 공유할 수 있는 신뢰 그룹.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  User,
  Search,
  X,
  Check,
  ShieldCheck,
  Copy,
  MessageCircle,
  Clock3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  CARE_SHIFT_MAX_FUTURE_MS,
  describeCareShiftError,
  describeCareShiftValidationErrors,
  toDatetimeLocalValue,
} from "@/lib/care-shift";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import CareTeamCard from "@/app/components/CareTeamCard";
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
import UIListRow from "@/app/components/ui/ListRow";

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
  const [careShiftsLoadError, setCareShiftsLoadError] = useState<string | null>(null);
  const [careShiftTransitioning, setCareShiftTransitioning] = useState<string | null>(null);
  const careShiftsRequestId = useRef(0);
  const careShiftAuthContextId = useRef(0);
  // 토큰 갱신(TOKEN_REFRESHED)은 같은 사용자여도 user 객체를 새로 만든다.
  // 객체 정체성으로 인증 컨텍스트를 무효화하면 진행 중 요청의 제출 상태가
  // 영구히 잠기므로, 로그아웃·계정 전환만 구분하는 id를 기준으로 삼는다.
  const userId = user?.id ?? null;

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
    if (!userId || !isCoreJourneyEnabled("P3")) return;
    const requestId = ++careShiftsRequestId.current;
    setCareShiftsLoading(true);
    setCareShiftsLoadError(null);
    try {
      const response = await fetch("/api/care-shifts");
      const result = (await response.json()) as {
        shifts?: CareShift[];
        error?: unknown;
      };
      if (response.ok && requestId === careShiftsRequestId.current) {
        setCareShifts(result.shifts ?? []);
      } else if (!response.ok && requestId === careShiftsRequestId.current) {
        setCareShiftsLoadError(
          describeCareShiftError(result.error, "돌봄 교대 목록을 불러오지 못했어요."),
        );
      }
    } catch (error) {
      console.error("[care-shifts] load failed", error);
      if (requestId === careShiftsRequestId.current) {
        setCareShiftsLoadError("돌봄 교대 목록을 불러오지 못했어요.");
      }
    } finally {
      if (requestId === careShiftsRequestId.current) {
        setCareShiftsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !isCoreJourneyEnabled("P3")) {
      careShiftsRequestId.current += 1;
      careShiftAuthContextId.current += 1;
      setCareShifts([]);
      setCareShiftsLoadError(null);
      setCareShiftsLoading(false);
      setShiftSubmitting(false);
      setCareShiftTransitioning(null);
      return;
    }

    void loadCareShifts();
    return () => {
      careShiftsRequestId.current += 1;
      careShiftAuthContextId.current += 1;
    };
  }, [loadCareShifts, userId]);

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
      setShiftAssigneeId((prev) => (prev === m.member_id ? "" : prev));
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
    const authContextId = careShiftAuthContextId.current;
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
      const result = (await response.json()) as {
        error?: string;
        details?: unknown;
      };
      if (!response.ok) {
        const fallback = describeCareShiftError(
          result.error,
          "교대 요청을 만들지 못했어요.",
        );
        throw new Error(
          result.error === "invalid_params"
            ? describeCareShiftValidationErrors(result.details, fallback)
            : fallback,
        );
      }
      if (authContextId !== careShiftAuthContextId.current) return;
      setShiftStartsAt("");
      setShiftNote("");
      await loadCareShifts();
      if (authContextId !== careShiftAuthContextId.current) return;
      alert("돌봄 교대를 요청했어요.");
    } catch (error) {
      if (authContextId === careShiftAuthContextId.current) {
        alert(error instanceof Error ? error.message : "교대 요청을 만들지 못했어요.");
      }
    } finally {
      if (authContextId === careShiftAuthContextId.current) {
        setShiftSubmitting(false);
      }
    }
  };

  const handleCareShiftTransition = async (
    shift: CareShift,
    status: "accepted" | "completed",
  ) => {
    if (careShiftTransitioning) return;
    const authContextId = careShiftAuthContextId.current;
    setCareShiftTransitioning(shift.id);
    try {
      const response = await fetch("/api/care-shifts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shift.id, status }),
      });
      const result = (await response.json()) as { error?: string };
      if (authContextId !== careShiftAuthContextId.current) return;
      if (!response.ok) {
        if (result.error === "invalid_transition") {
          await loadCareShifts();
        }
        if (authContextId !== careShiftAuthContextId.current) return;
        throw new Error(
          describeCareShiftError(result.error, "교대 상태를 바꾸지 못했어요."),
        );
      }
      await loadCareShifts();
    } catch (error) {
      if (authContextId === careShiftAuthContextId.current) {
        alert(error instanceof Error ? error.message : "교대 상태를 바꾸지 못했어요.");
      }
    } finally {
      if (authContextId === careShiftAuthContextId.current) {
        setCareShiftTransitioning(null);
      }
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
        <p className="text-[15px] text-text-sub mb-3">로그인이 필요한 기능이에요.</p>
        <Link href="/login" className="inline-block px-5 py-2 rounded-xl bg-primary text-white font-bold text-[13px]">
          로그인
        </Link>
      </div>
    );
  }

  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const pendingMembers = members.filter((m) => m.status === "pending");
  const showCareShift = isCoreJourneyEnabled("P3");
  const showCareTeam = isCoreJourneyEnabled("P4");

  return (
    <div className="min-h-dvh pb-6" style={{ background: "var(--color-surface)" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-2 sticky top-0 z-10" style={{ background: "var(--color-surface)" }}>
        <Link
          href="/mypage"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          aria-label="마이페이지로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">내 서클</h1>
      </div>

      {/* 안내 — 흰 면 + 헤어라인, 한 줄 */}
      <section className="px-5 mt-2">
        <div className="card p-4 flex items-start gap-2.5">
          <ShieldCheck size={20} className="shrink-0 mt-0.5 text-text-sub" strokeWidth={1.8} />
          <p className="text-[13px] text-text-sub leading-relaxed">
            공개 범위를 <b className="text-text-main">&quot;내 서클&quot;</b>로 등록한 고양이는 믿는 이웃(서클 멤버)에게만 보여요.
          </p>
        </div>
      </section>

      {showCareTeam && <CareTeamCard />}

      {showCareShift && (
        <section className="px-5 mt-5" aria-labelledby="care-shift-heading">
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <Clock3 size={20} className="shrink-0 mt-0.5 text-text-sub" strokeWidth={1.8} aria-hidden="true" />
              <div>
                <h2 id="care-shift-heading" className="text-[15px] font-bold text-text-main">
                  돌봄 교대
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-text-sub">
                  서클 이웃에게 빈 시간의 돌봄을 부탁하고, 수락부터 완료까지 함께 확인해요.
                </p>
              </div>
            </div>
            <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-text-sub">
              <li className="px-2 py-2" style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)" }}>1. 요청</li>
              <li className="px-2 py-2" style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)" }}>2. 수락</li>
              <li className="px-2 py-2" style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)" }}>3. 완료</li>
            </ol>
            {acceptedMembers.length > 0 ? (
              <div className="mt-4 space-y-3 border-t border-divider pt-4">
                <label className="block text-[13px] font-semibold text-text-main">
                  부탁할 이웃
                  <select
                    value={shiftAssigneeId}
                    onChange={(event) => setShiftAssigneeId(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] font-normal"
                  >
                    <option value="">서클 이웃 선택</option>
                    {acceptedMembers.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {member.member_nickname ?? "이웃"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[13px] font-semibold text-text-main">
                  돌봄 시작 시각
                  <input
                    type="datetime-local"
                    value={shiftStartsAt}
                    min={toDatetimeLocalValue(new Date(Date.now() + 60_000))}
                    max={toDatetimeLocalValue(
                      new Date(Date.now() + CARE_SHIFT_MAX_FUTURE_MS),
                    )}
                    onChange={(event) => setShiftStartsAt(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] font-normal"
                  />
                </label>
                <label className="block text-[13px] font-semibold text-text-main">
                  메모 <span className="font-normal text-text-light">(선택)</span>
                  <textarea
                    value={shiftNote}
                    maxLength={500}
                    onChange={(event) => setShiftNote(event.target.value)}
                    placeholder="급식 위치나 필요한 돌봄을 알려주세요."
                    className="mt-1.5 min-h-20 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] font-normal"
                  />
                </label>
                <button
                  type="button"
                  disabled={!shiftAssigneeId || !shiftStartsAt || shiftSubmitting}
                  onClick={handleCreateCareShift}
                  className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40 press"
                >
                  {shiftSubmitting ? "요청 중..." : "돌봄 교대 요청"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-text-light">
                교대를 부탁하려면 먼저 서클 이웃의 초대 수락이 필요해요.
              </p>
            )}
            <div className="mt-4 border-t border-divider pt-4">
              <h3 className="text-[13px] font-semibold text-text-main">내 돌봄 교대</h3>
              {careShiftsLoading ? (
                <div className="flex justify-center py-5" aria-label="돌봄 교대 불러오는 중">
                  <Loader2 size={18} className="animate-spin text-primary" />
                </div>
              ) : careShiftsLoadError ? (
                <div className="mt-2">
                  <p className="text-[13px] text-text-light">{careShiftsLoadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCareShifts()}
                    className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-[15px] font-semibold text-text-main press"
                  >
                    다시 시도
                  </button>
                </div>
              ) : careShifts.length > 0 ? (
                <ul className="mt-1">
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
                      <li key={shift.id} className="py-3 border-b border-divider last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-semibold text-text-main">
                            {shift.requester_id === user.id
                              ? `${assignee?.member_nickname ?? "이웃"}에게 요청`
                              : "받은 교대 요청"}
                          </p>
                          <span className="shrink-0 text-[13px] font-medium text-text-sub">
                            {statusLabel}
                          </span>
                        </div>
                        <time className="mt-0.5 block text-[13px] text-text-sub" dateTime={shift.starts_at}>
                          {new Intl.DateTimeFormat("ko-KR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(shift.starts_at))}
                        </time>
                        {shift.note && (
                          <p className="mt-1 line-clamp-2 text-[13px] text-text-sub">{shift.note}</p>
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
                            className="mt-2 min-h-11 w-full rounded-lg bg-primary px-3 py-2 text-[15px] font-semibold text-white disabled:opacity-40 press"
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
                <p className="mt-2 text-[13px] text-text-light">아직 돌봄 교대 요청이 없어요.</p>
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
                <h2 className="text-[17px] font-bold text-text-main tracking-tight">받은 초대</h2>
                <span className="text-[13px] font-semibold text-text-sub tabular-nums">{invitations.length}</span>
              </div>
              <div className="card px-3 py-1">
                {invitations.map((inv) => (
                  <UIListRow
                    key={inv.id}
                    icon={<Avatar url={inv.owner_avatar_url} />}
                    title={inv.owner_nickname ?? "익명 길집사"}
                    subtitle="서클 초대를 보냈어요"
                    right={
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespond(inv, "accepted")}
                          disabled={busy === inv.id}
                          className="h-8 px-3 rounded-lg text-[13px] font-semibold text-white press-strong disabled:opacity-50 inline-flex items-center"
                          style={{ background: "var(--color-primary)" }}
                          aria-label="초대 수락"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleRespond(inv, "rejected")}
                          disabled={busy === inv.id}
                          className="h-8 px-3 rounded-lg text-[13px] font-semibold text-text-sub press-strong disabled:opacity-50 inline-flex items-center"
                          style={{ background: "var(--color-gray-100)" }}
                          aria-label="초대 거절"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* 서클 채팅 진입 */}
          {myCircleId && (
            <section className="px-5 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[17px] font-bold text-text-main tracking-tight">서클 채팅</h2>
              </div>
              <div className="card px-3 py-1">
                <UIListRow
                  href={`/circle/${myCircleId}/chat`}
                  icon={<MessageCircle size={20} strokeWidth={1.8} />}
                  title="내 서클 채팅방 열기"
                  subtitle="멤버끼리 한 채팅방에서 대화 · 실시간 동기화"
                />
                {/* 참여 중인 다른 서클 (멤버로 들어가 있는 곳) */}
                {joinedCircles
                  .filter((c) => c.role === "member")
                  .map((c) => {
                    const unread = unreadMap.get(c.circle_id) ?? 0;
                    return (
                      <UIListRow
                        key={c.circle_id}
                        href={`/circle/${c.circle_id}/chat`}
                        icon={<Avatar url={c.owner_avatar_url} size={36} />}
                        title={`${c.owner_nickname ?? "익명"}님의 서클`}
                        subtitle={`멤버 ${c.member_count + 1}명`}
                        value={
                          unread > 0 ? (
                            <span
                              className="px-2 py-0.5 chip-square text-[11px] font-semibold leading-none text-white"
                              style={{ background: "var(--color-error)" }}
                            >
                              {unread > 99 ? "99+" : unread}
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })}
              </div>
            </section>
          )}

          {/* 카카오톡 초대 링크 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">초대 링크</h2>
            </div>
            <div className="card p-4">
              <p className="text-[13px] text-text-sub leading-relaxed mb-3">
                링크를 받은 이웃이 수락하면 바로 서클 멤버가 돼요.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleKakaoShare}
                  className="flex-[1.5] h-10 flex items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold press-strong"
                  style={{ background: "#FEE500", color: "var(--color-gray-900)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M9 1.5C4.582 1.5 1 4.262 1 7.668c0 2.219 1.51 4.166 3.788 5.272-.167.625-.604 2.265-.69 2.617-.108.438.16.43.336.314.138-.092 2.198-1.5 3.083-2.107.49.073.99.111 1.483.111 4.418 0 8-2.762 8-6.207C17 4.262 13.418 1.5 9 1.5z" fill="currentColor" />
                  </svg>
                  카카오톡 공유
                </button>
                <button
                  onClick={handleCopyInviteUrl}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold press-strong text-text-main"
                  style={{ background: "var(--color-gray-100)" }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "복사됨" : "링크 복사"}
                </button>
              </div>
            </div>
          </section>

          {/* 닉네임 검색 초대 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">닉네임 검색 초대</h2>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 flex items-center gap-2 px-3 h-10"
                  style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-input)" }}
                >
                  <Search size={16} className="text-text-light shrink-0" />
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
                    className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-text-light"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.trim().length < 2}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-[15px] font-semibold press-strong disabled:opacity-40 inline-flex items-center"
                >
                  {searching ? <Loader2 size={14} className="animate-spin" /> : "검색"}
                </button>
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="mt-2">
                  {searchResults.map((r) => (
                    <UIListRow
                      key={r.id}
                      icon={<Avatar url={r.avatar_url} size={32} />}
                      title={r.nickname ?? "익명"}
                      right={
                        <button
                          onClick={() => handleInvite(r)}
                          disabled={busy === r.id}
                          className="h-8 px-3 rounded-lg text-[13px] font-semibold text-white press-strong disabled:opacity-50 inline-flex items-center"
                          style={{ background: "var(--color-primary)" }}
                        >
                          {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : "초대"}
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
              {searchOpen && searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <p className="mt-2 text-[13px] text-text-light text-center py-2">검색 결과가 없어요.</p>
              )}
            </div>
          </section>

          {/* 멤버 목록 */}
          <section className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">내 서클 멤버</h2>
              <span className="text-[13px] font-semibold text-text-sub tabular-nums">{acceptedMembers.length}</span>
            </div>
            {acceptedMembers.length === 0 && pendingMembers.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-[13px] text-text-sub">아직 멤버가 없어요. 위에서 닉네임을 검색해 초대해보세요.</p>
              </div>
            ) : (
              <div className="card px-3 py-1">
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
        className="shrink-0 rounded-full flex items-center justify-center text-text-light"
        style={{ width: size, height: size, background: "var(--color-gray-200)" }}
      >
        <User size={Math.round(size * 0.5)} strokeWidth={1.8} />
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
      style={{ width: size, height: size }}
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
    <UIListRow
      icon={<Avatar url={member.member_avatar_url ?? null} />}
      title={member.member_nickname ?? "익명 길집사"}
      subtitle={pending ? "수락 대기 중" : "수락됨"}
      right={
        <button
          onClick={onRemove}
          disabled={busy}
          className="h-8 px-3 rounded-lg text-[13px] font-semibold text-text-sub press-strong disabled:opacity-50 inline-flex items-center shrink-0"
          style={{ background: "var(--color-gray-100)" }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : "내보내기"}
        </button>
      }
    />
  );
}
