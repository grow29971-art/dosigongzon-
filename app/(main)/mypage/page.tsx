"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import PageIntroModal from "@/app/components/PageIntroModal";
import Image from "next/image";
import { User, LogOut, Loader2, Cat as CatIcon, MessageCircle, AlertTriangle, MapPin, ChevronRight, Camera, Pencil, Check, X, MessageSquare, Inbox, BookOpen, UserPlus, Trophy, Ban, ShieldCheck, TrendingUp, Star, Heart, Bot, Lock, FileText, Smile, Footprints } from "lucide-react";
import dynamic from "next/dynamic";
const InquiryModal = dynamic(() => import("@/app/components/InquiryModal"), { ssr: false });
const ActivityFeedPreview = dynamic(() => import("@/app/components/ActivityFeedPreview"), { ssr: false });
import InstallAppMenuItem from "@/app/components/InstallAppMenuItem";
import InviteSection from "@/app/components/InviteSection";
import EmailDigestToggle from "@/app/components/EmailDigestToggle";
import MarketingPushToggle from "@/app/components/MarketingPushToggle";
import PageIntroBanner from "@/app/components/PageIntroBanner";
import MyActivityDashboard from "@/app/components/MyActivityDashboard";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  listMyCats,
  listMyLikedCats,
  listMyComments,
  getMyActivitySummary,
  computeScore,
  computeLevel,
  uploadAvatar,
  updateMyAvatar,
  updateMyNickname,
  getDisplayName,
  getLevelPerks,
  type Cat,
  type CatCommentWithCat,
  type MyActivitySummary,
} from "@/lib/cats-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  getTitleStatuses,
  countUnlocked,
  CATEGORY_LABELS,
  TITLES,
  findAdminTitle,
  type TitleStatus,
} from "@/lib/titles";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount } from "@/lib/dm-repo";
import { countMyAcceptedCircleMembers } from "@/lib/circles-repo";
import UIListRow from "@/app/components/ui/ListRow";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { catArtWalkSvg } from "@/lib/cat-art";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default function MyPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  // 마이페이지 메뉴 간결화 (2026-07-15) — MAU 초기 저활용 진입점을 눈에서 숨김.
  // 라우트·코드는 유지하며, 각 플래그를 true로 되돌리면 복원.
  // SHOW_CARD_GAME 플래그 삭제 — 카드 시스템 전면 폐지(2026-08-27, 라우트·컴포넌트·데이터까지 제거)
  const SHOW_JOURNEY = false;        // 당신의 여정
  const SHOW_MONTHLY_REPORT = false; // 이번 달 성장 리포트
  const SHOW_CARETAKERS = false;     // 동네 길집사 찾기 — 인원 필요
  const SHOW_RANKING = false;        // 랭킹
  const SHOW_CIRCLE = false;         // 서클(그룹 돌봄)

  const [summary, setSummary] = useState<MyActivitySummary | null>(null);
  const [myCats, setMyCats] = useState<Cat[]>([]);
  const [likedCats, setLikedCats] = useState<Cat[]>([]);
  const [myComments, setMyComments] = useState<CatCommentWithCat[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadDM, setUnreadDM] = useState(0);
  const [circleMemberCount, setCircleMemberCount] = useState(0);
  const [adminTitle, setAdminTitle] = useState<string | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 함께한 N일 — 첫 고양이 등록일부터 매일 +1 (자부심 카운터)
  // 등록한 고양이 0건이면 0 (표시 안 됨)
  const joinedDays = (() => {
    if (myCats.length === 0) return 0;
    const oldestMs = Math.min(...myCats.map((c) => new Date(c.created_at).getTime()));
    if (!Number.isFinite(oldestMs)) return 0;
    return Math.max(1, Math.floor((Date.now() - oldestMs) / 86_400_000) + 1);
  })();

  // 닉네임 편집
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  const [nickSaving, setNickSaving] = useState(false);
  const [nickError, setNickError] = useState("");

  const handleStartEditNick = () => {
    setNickDraft(getDisplayName(user));
    setNickError("");
    setEditingNick(true);
  };
  const handleCancelEditNick = () => {
    setEditingNick(false);
    setNickError("");
  };
  const handleSaveNick = async () => {
    const trimmed = nickDraft.trim();
    if (!trimmed) {
      setNickError("닉네임을 입력해주세요.");
      return;
    }
    if (trimmed.length < 2) {
      setNickError("닉네임은 2자 이상이어야 합니다.");
      return;
    }
    if (trimmed.length > 20) {
      setNickError("20자 이내로 입력해주세요.");
      return;
    }
    setNickSaving(true);
    setNickError("");
    try {
      // 닉네임 중복 체크
      const res = await fetch("/api/check-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed, currentUserId: user?.id }),
      });
      const check = await res.json();
      if (!check.available) {
        setNickError("이미 사용 중인 닉네임이에요.");
        setNickSaving(false);
        return;
      }
      await updateMyNickname(trimmed);
      setEditingNick(false);
    } catch (err) {
      setNickError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setNickSaving(false);
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // 같은 파일 다시 선택 가능
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file);
      await updateMyAvatar(url);
      // user_metadata 변경 → AuthContext의 onAuthStateChange(USER_UPDATED)가 받아서 user 재설정
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setAvatarUploading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setMyCats([]);
      setLikedCats([]);
      setMyComments([]);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      getMyActivitySummary(),
      listMyCats(),
      listMyLikedCats(30),
      listMyComments(10),
      isCurrentUserAdmin(),
      getUnreadCount(),
      createClient().from("profiles").select("admin_title").eq("id", user.id).maybeSingle(),
      countMyAcceptedCircleMembers(),
    ])
      .then(([s, cats, liked, comments, admin, unread, profileRes, circleCount]) => {
        if (cancelled) return;
        setSummary(s);
        setMyCats(cats);
        setLikedCats(liked);
        setMyComments(comments);
        setIsAdmin(admin);
        setUnreadDM(unread);
        setAdminTitle((profileRes.data as { admin_title: string | null } | null)?.admin_title ?? null);
        setCircleMemberCount(circleCount);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "탈퇴합니다") return;
    setDeleting(true);
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("세션 없음");

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      alert("탈퇴 처리에 실패했어요. 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  const nickname = getDisplayName(user);
  const email = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="px-4 pt-14 pb-8">
      <PageIntroModal
        storageKey="dosigongzon_intro_mypage"
        badge="마이페이지"
        headerEmoji=""
        title="내 돌봄 발자취를 모아봐요"
        items={[
          { emoji: "", text: <>돌볼수록 <b className="text-text-main">레벨·업적·타이틀</b>이 쌓여요.</> },
          { emoji: "", text: <>내 고양이와 돌봄 기록을 관리해요.</> },
          { emoji: "", text: <>알림·서클·차단 등 설정도 여기서 할 수 있어요.</> },
        ]}
      />
      {/* 헤더 */}
      <div className="mb-6 px-1">
        <h1 className="text-[24px] font-bold text-text-main tracking-tight mb-1">
          마이페이지
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed">
          내 활동 기록과 계정 정보
        </p>
      </div>

      <div className="mb-3">
        <PageIntroBanner
          id="mypage"
          title="내 활동 · 보상 · 설정"
          description="레벨·업적·streak으로 활동이 보상돼요. 친구 초대(+15점), 주간 이메일, 앱 설치, 동네 푸시도 여기서 켜고 끌 수 있어요."
          ctaLabel="전체 기능 안내"
          ctaHref="/guide"
        />
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : user ? (
        <>
          {/* ── 프로필 ── */}
          <div
            className="flex items-center gap-4 px-4 py-4 mb-3"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* 아바타 (탭하면 파일 선택) — 원형 아바타는 full 허용 */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden press-strong transition-transform"
              style={{
                background: avatarUrl ? "var(--color-surface-alt)" : "var(--color-gray-200)",
                border: "1px solid var(--color-border)",
              }}
              aria-label="프로필 사진 변경"
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="64px" style={{ objectFit: "cover" }} />
              ) : (
                <User size={30} className="text-text-light" strokeWidth={1.8} />
              )}
              {/* 하단 카메라 배지 (원형 아이콘 버튼 — full 허용) */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {avatarUploading ? (
                  <Loader2 size={11} className="animate-spin text-text-sub" />
                ) : (
                  <Camera size={11} className="text-text-sub" strokeWidth={2.2} />
                )}
              </div>
              {/* 업로드 중 오버레이 */}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Loader2 size={18} className="text-white animate-spin" />
                </div>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarPick}
            />
            <div className="flex-1 min-w-0">
              {editingNick ? (
                <div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSaveNick();
                        if (e.key === "Escape") handleCancelEditNick();
                      }}
                      maxLength={20}
                      autoFocus
                      disabled={nickSaving}
                      className="flex-1 min-w-0 px-2 py-1.5 text-[15px] font-bold outline-none"
                      style={{
                        borderRadius: "var(--radius-input)",
                        backgroundColor: "var(--color-surface-alt)",
                        color: "var(--color-text-main)",
                        border: "1px solid var(--color-border)",
                      }}
                      placeholder="닉네임"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNick}
                      disabled={nickSaving}
                      className="w-7 h-7 flex items-center justify-center press-strong transition-transform text-white"
                      style={{ borderRadius: "var(--radius-input)", backgroundColor: "var(--color-primary)" }}
                      aria-label="닉네임 저장"
                    >
                      {nickSaving ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} strokeWidth={3} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditNick}
                      disabled={nickSaving}
                      className="w-7 h-7 flex items-center justify-center press-strong transition-transform text-text-light"
                      style={{ borderRadius: "var(--radius-input)", backgroundColor: "var(--color-gray-100)" }}
                      aria-label="닉네임 수정 취소"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-light mt-1 truncate">{email}</p>
                  {nickError && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--color-error)" }}>
                      {nickError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[17px] font-bold text-text-main truncate tracking-tight">
                      {nickname}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartEditNick}
                      className="w-6 h-6 flex items-center justify-center press-strong transition-transform shrink-0 text-text-light"
                      style={{ borderRadius: "var(--radius-square-sm)" }}
                      aria-label="닉네임 수정"
                    >
                      <Pencil size={12} strokeWidth={2} />
                    </button>
                  </div>
                  <p className="text-[13px] text-text-light mt-0.5 truncate">{email}</p>
                  {joinedDays > 0 && (
                    <p className="text-[13px] text-text-sub mt-1">
                      첫 등록 후 {joinedDays}일째 함께 돌봐요
                    </p>
                  )}
                  {avatarError && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--color-error)" }}>
                      {avatarError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── 활동 피드 미리보기 — 재방문 트리거 ── */}
          {/* /notifications 최근 4건 카드. 비어있으면 첫 등록 유도. */}
          <ActivityFeedPreview hasMyCat={myCats.length > 0} />

          {/* ── 레벨 ── */}
          {summary && (() => {
            const score = computeScore(summary);
            const lv = computeLevel(score);
            return (
              <div
                className="mb-3 px-4 py-4 dark-card-level"
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-bold text-text-sub tabular-nums">
                        LV.{lv.level}
                      </span>
                      <span className="text-[11px] text-text-light tabular-nums">
                        {lv.score}점
                      </span>
                    </div>
                    <p className="text-[17px] font-bold text-text-main tracking-tight mt-0.5">
                      {lv.title}
                    </p>
                  </div>
                </div>
                {/* 진행 바 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-text-sub font-semibold">
                      다음 레벨까지
                    </span>
                    <span className="text-[11px] font-semibold text-text-sub tabular-nums">
                      {lv.next
                        ? `${lv.score} / ${lv.next}`
                        : "MAX"}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden"
                    style={{ borderRadius: "var(--radius-square-sm)", backgroundColor: "var(--color-gray-200)" }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${lv.progress * 100}%`,
                        background: "var(--color-primary)",
                        borderRadius: "var(--radius-square-sm)",
                      }}
                    />
                  </div>
                </div>
                {/* 레벨 혜택 */}
                {(() => {
                  const perks = getLevelPerks(lv.level);
                  return (
                    <div className="mt-3 pt-3 border-t border-divider">
                      <p className="text-[11px] font-semibold text-text-light mb-2">Lv.{lv.level} 혜택</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                          <Bot size={14} />
                          <span>AI 대화</span>
                          <span className="font-semibold text-text-main ml-auto">{perks.aiChatPerMinute}회/분</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                          <Pencil size={14} />
                          <span>글 작성</span>
                          <span className="font-semibold text-text-main ml-auto">{perks.dailyPostLimit === 0 ? "무제한" : `${perks.dailyPostLimit}개/일`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-text-sub">
                          {perks.canUseSpecialEmoji ? <Smile size={14} /> : <Lock size={14} />}
                          <span>특별 이모지</span>
                          <span className={`font-semibold ml-auto ${perks.canUseSpecialEmoji ? "text-text-main" : "text-text-light"}`}>{perks.canUseSpecialEmoji ? "사용 가능" : "Lv.3+"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── 활동 요약 (3개 지표) — 흰 카드 1장, 세로 헤어라인으로 3칸 ── */}
          <div
            className="grid grid-cols-3 mb-5"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
            }}
          >
            <StatCard
              Icon={CatIcon}
              label="등록 고양이"
              value={summary?.catCount ?? 0}
              loading={dataLoading}
            />
            <StatCard
              Icon={MessageCircle}
              label="돌봄 기록"
              value={summary?.commentCount ?? 0}
              loading={dataLoading}
              divider
            />
            <StatCard
              Icon={AlertTriangle}
              label="학대 신고"
              value={summary?.alertCount ?? 0}
              loading={dataLoading}
              divider
            />
          </div>

          {/* ── 내 활동 대시보드 (이번 달·최다 고양이·시간대) ── */}
          <MyActivityDashboard />

          {/* ── 업적 (타이틀) ── */}
          {summary && (
            <TitleSection
              summary={summary}
              initialEquipped={
                (user?.user_metadata?.equipped_title as string | undefined) ?? null
              }
              adminTitleId={adminTitle}
            />
          )}

          {/* ── 내가 등록한 고양이 ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                내가 등록한 고양이 {myCats.length > 0 && `· ${myCats.length}`}
              </h2>
            </div>
            {dataLoading && myCats.length === 0 ? (
              <EmptyBox>불러오는 중...</EmptyBox>
            ) : myCats.length === 0 ? (
              <EmptyBox>
                <p className="mb-2">아직 등록한 고양이가 없어요</p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                >
                  지도에서 등록하기 <ChevronRight size={12} />
                </Link>
              </EmptyBox>
            ) : (
              <div className="card px-3 py-1">
                {myCats.map((cat) => (
                  <UIListRow
                    key={cat.id}
                    href="/map"
                    icon={<CatThumb id={cat.id} photoUrl={cat.photo_url} size={40} />}
                    title={cat.name}
                    subtitle={
                      <>
                        {cat.region && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin size={11} />
                            {cat.region}
                            {" · "}
                          </span>
                        )}
                        {formatRelative(cat.created_at)}
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── 좋아요한 고양이 ── */}
          {likedCats.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                  응원하는 고양이 · {likedCats.length}
                </h2>
              </div>
              <div
                className="flex gap-3 overflow-x-auto no-scrollbar px-1 -mx-1 pb-1"
              >
                {likedCats.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/cats/${cat.id}`}
                    className="shrink-0 flex flex-col items-center press-strong transition-transform"
                    style={{ width: 76 }}
                  >
                    <CatThumb id={cat.id} photoUrl={cat.photo_url} size={64} />
                    <p className="w-full text-[13px] font-semibold text-text-main truncate text-center mt-1.5">
                      {cat.name}
                    </p>
                    <p className="text-[11px] text-text-light inline-flex items-center gap-0.5">
                      <Heart size={10} />
                      {cat.like_count ?? 0}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── 최근 돌봄 기록 ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                최근 돌봄 기록 {myComments.length > 0 && `· ${myComments.length}`}
              </h2>
            </div>
            {dataLoading && myComments.length === 0 ? (
              <EmptyBox>불러오는 중...</EmptyBox>
            ) : myComments.length === 0 ? (
              <EmptyBox>지도에서 고양이를 골라 첫 기록을 남겨보세요</EmptyBox>
            ) : (
              <div className="card px-4 py-1">
                {myComments.map((c) => {
                  const isAlert = c.kind === "alert";
                  return (
                    <div
                      key={c.id}
                      className="py-3 border-b border-divider last:border-b-0"
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {isAlert && (
                          <AlertTriangle size={12} style={{ color: "var(--color-error)" }} />
                        )}
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: isAlert ? "var(--color-error)" : "var(--color-text-main)" }}
                        >
                          {c.cat?.name ?? "알 수 없는 고양이"}
                        </span>
                        {c.author_level && (
                          <span
                            className="text-[11px] font-medium px-1.5 py-[1px] chip-square tabular-nums text-text-sub"
                            style={{ border: "1px solid var(--color-border)" }}
                          >
                            Lv.{c.author_level}
                          </span>
                        )}
                        {c.cat?.region && (
                          <span className="text-[11px] text-text-light">
                            · {c.cat.region}
                          </span>
                        )}
                        <span className="text-[11px] text-text-light ml-auto">
                          {formatRelative(c.created_at)}
                        </span>
                      </div>
                      {c.body && (
                        <p
                          className="text-[13px] leading-relaxed"
                          style={{ color: isAlert ? "var(--color-error)" : "var(--color-text-sub)" }}
                        >
                          {c.body}
                        </p>
                      )}
                      {c.photo_url && (
                        <Image
                          src={c.photo_url}
                          alt=""
                          width={120}
                          height={90}
                          className="mt-2 object-cover"
                          style={{ width: 120, height: 90, borderRadius: "var(--radius-card-sm)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 친구 초대 ── */}
          <InviteSection />

          {/* ── 내 설정 ── */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                내 설정
              </h2>
            </div>
            {/* 카드 컬렉션 진입 카드 제거 — 카드 시스템 폐지 (2026-08-27 사장님 지시, 라우트도 삭제됨) */}
            {/* 흰 카드 1장 + 행 헤어라인(UIListRow 기본). 숨김 플래그 블록도 같은 행 문법. */}
            <div className="card px-3 py-1">
              {/* 내 돌봄 활동 확인서 — 기록을 증빙 자산으로 (2026-08-29 PMF 개편) */}
              <UIListRow
                href="/mypage/report"
                icon={<FileText size={20} strokeWidth={1.8} />}
                title="내 돌봄 활동 확인서"
                subtitle="민원·봉사 증빙·지원사업용 PDF 문서 만들기"
              />
              {SHOW_JOURNEY && (
                <UIListRow
                  href="/mypage/journey"
                  icon={<Footprints size={20} strokeWidth={1.8} />}
                  title="내 활동 기록"
                  subtitle="등록·기록·댓글 이력 보기"
                />
              )}
              {SHOW_MONTHLY_REPORT && (
                <UIListRow
                  href="/mypage/monthly-report"
                  icon={<TrendingUp size={20} strokeWidth={1.8} />}
                  title="이번 달 성장 리포트"
                  subtitle="이번 달 기록·등록·댓글 수"
                />
              )}
              <UIListRow
                href="/mypage/activity-regions"
                icon={<MapPin size={20} strokeWidth={1.8} />}
                title="활동 지역 설정"
                subtitle="최대 2곳까지 내 동네를 지정할 수 있어요"
              />
              <UIListRow
                href="/mypage/watching"
                icon={<Heart size={20} strokeWidth={1.8} />}
                title="내가 지켜보는 아이"
                subtitle="하트 누른 고양이 목록"
              />
              {SHOW_CARETAKERS && (
                <UIListRow
                  href="/caretakers"
                  icon={<UserPlus size={20} strokeWidth={1.8} />}
                  title="동네 길집사 찾기"
                  subtitle="같은 동네에서 활동하는 분들과 연결돼요"
                />
              )}
              {SHOW_RANKING && (
                <UIListRow
                  href="/ranking"
                  icon={<Trophy size={20} strokeWidth={1.8} />}
                  title="길집사 활동 랭킹"
                  subtitle="내 점수와 동네 순위"
                />
              )}
              {/* 다음 설정 항목들은 각자 위 헤어라인을 그리므로 이 행은 아래 선을 생략 */}
              <UIListRow
                href="/memorial"
                icon={<Star size={20} strokeWidth={1.8} />}
                title="고양이별"
                subtitle="먼저 떠난 아이들을 기억하는 곳이에요"
                divider={false}
              />
              {/* 설정 항목들 — 각 컴포넌트가 자체적으로 위 구분선을 그리는 행(row)으로 렌더 */}
              <InstallAppMenuItem />
              <EmailDigestToggle />
              <MarketingPushToggle />
              <UIListRow
                href="/guide"
                icon={<BookOpen size={20} strokeWidth={1.8} />}
                title="사용 가이드"
                subtitle="핵심 기능 10가지 설명"
                style={{ borderTop: "1px solid var(--color-divider)" }}
              />
            </div>
          </div>

          {/* ── 지원 / 문의 ── */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                지원
              </h2>
            </div>
            <div className="card px-3 py-1">
              <UIListRow
                onClick={() => setInquiryOpen(true)}
                icon={<MessageSquare size={20} strokeWidth={1.8} />}
                title="문의하기"
                subtitle="불편사항, 버그, 제안 등을 관리자에게 전달"
              />
              <UIListRow
                href="/mypage/inquiries"
                icon={<Inbox size={20} strokeWidth={1.8} />}
                title="내 문의 보기"
                subtitle="접수한 문의·관리자 답변 확인"
              />
              {SHOW_CIRCLE && (
                <UIListRow
                  href="/mypage/circle"
                  icon={<ShieldCheck size={20} strokeWidth={1.8} />}
                  title="내 서클"
                  subtitle={
                    circleMemberCount > 0
                      ? `${circleMemberCount}명의 이웃과 함께 안전하게 돌봐요`
                      : "믿는 이웃을 초대해 안전한 돌봄 시작하기"
                  }
                  value={circleMemberCount > 0 ? `${circleMemberCount}명` : undefined}
                />
              )}
              <UIListRow
                href="/mypage/blocked-users"
                icon={<Ban size={20} strokeWidth={1.8} />}
                title="차단한 사용자"
                subtitle="차단 목록 확인 및 해제"
              />
            </div>
          </div>

          {/* ── 관리자 대시보드 (단일 진입점) ── */}
          {isAdmin && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-[17px] font-bold text-text-main tracking-tight">
                  운영 관리
                </h2>
              </div>
              <div className="card px-3 py-1">
                <UIListRow
                  href="/admin"
                  icon={<User size={20} strokeWidth={1.8} />}
                  title="관리자 대시보드"
                  subtitle="통계 · 신고·문의 · 유저 · 뉴스 · 병원 · 약품 · 푸시 · 로그"
                />
              </div>
            </div>
          )}

          {/* ── 로그아웃 ── */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-[15px] font-semibold press-strong transition-transform"
            style={{
              borderRadius: "var(--radius-input)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text-sub)",
              border: "1px solid var(--color-border)",
            }}
          >
            <LogOut size={16} />
            로그아웃
          </button>

          {/* ── 회원탈퇴 ── */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full text-center py-3 text-[11px] text-text-light underline press-strong transition-transform mt-2"
          >
            회원탈퇴
          </button>

          {/* ── 푸터 ── */}
          <footer className="mt-8 text-center space-y-1 pb-2">
            <div className="flex items-center justify-center gap-3 text-[11px] text-text-light">
              <Link href="/terms" className="hover:underline">이용약관</Link>
              <span>·</span>
              <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
              <span>·</span>
              <Link href="/guide" className="hover:underline">사용 가이드</Link>
            </div>
            <p className="text-[11px] text-text-light">
              © 2026 도시공존 · 운영자 김성우
            </p>
          </footer>

          {/* 탈퇴 확인 모달 (모달 — 그림자 허용) */}
          {deleteConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
              <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
              <div
                className="relative w-full max-w-sm bg-white p-6"
                style={{ borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
              >
                <h2 className="text-[17px] font-bold text-text-main mb-2">
                  정말 탈퇴하시겠어요?
                </h2>
                <p className="text-[13px] text-text-sub leading-relaxed mb-1">
                  탈퇴하면 다음 데이터가 <b style={{ color: "var(--color-error)" }}>영구 삭제</b>됩니다.
                </p>
                <ul className="text-[13px] text-text-sub leading-relaxed mb-4 pl-4 list-disc">
                  <li>등록한 고양이 정보</li>
                  <li>돌봄 기록 및 댓글</li>
                  <li>커뮤니티 게시글</li>
                  <li>쪽지 내역</li>
                  <li>업적 및 레벨</li>
                </ul>
                <p className="text-[13px] text-text-sub mb-3">
                  확인을 위해 <b style={{ color: "var(--color-error)" }}>탈퇴합니다</b>를 입력해주세요.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="탈퇴합니다"
                  className="w-full px-4 py-3 rounded-lg bg-surface-alt text-[15px] text-text-main outline-none focus:ring-2 focus:ring-error/20 mb-4 placeholder:text-text-light"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-lg text-[15px] font-semibold bg-surface-alt text-text-sub press-strong transition-transform"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "탈퇴합니다" || deleting}
                    className="flex-1 py-3 rounded-lg text-[15px] font-semibold text-white press-strong transition-transform disabled:opacity-40"
                    style={{ backgroundColor: "var(--color-error)" }}
                  >
                    {deleting ? "처리 중..." : "탈퇴하기"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* 비로그인 */}
          <div className="card px-3 py-1 mb-4">
            <UIListRow
              href="/login?next=%2Fmypage"
              icon={
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-gray-200)" }}
                >
                  <User size={20} className="text-text-light" strokeWidth={1.8} />
                </div>
              }
              title="게스트"
              subtitle="로그인하고 길고양이 돌봄에 참여하세요"
              style={{ minHeight: 72 }}
            />
          </div>
        </>
      )}

      <p className="text-center text-[11px] text-text-light mt-6">도시공존 v0.1.0</p>

      {/* 문의 모달 */}
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
}

/* ═══ 고양이 썸네일 — 원형, 사진 없으면 cat-art ═══ */
function CatThumb({ id, photoUrl, size }: { id: string; photoUrl: string | null | undefined; size: number }) {
  const safe = sanitizeImageUrl(photoUrl ?? null, "");
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
    >
      {safe ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safe} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{ width: size * 0.7, height: size * 0.7 }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: catArtWalkSvg(id, Math.round(size * 0.7)) }}
        />
      )}
    </div>
  );
}

/* ═══ 지표 칸 — 흰 카드 안 3칸, 왼쪽 헤어라인 ═══ */
function StatCard({
  Icon,
  label,
  value,
  loading,
  divider,
}: {
  Icon: typeof CatIcon;
  label: string;
  value: number;
  loading: boolean;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center py-4 px-2 ${divider ? "border-l border-divider" : ""}`}
    >
      <Icon size={20} className="text-text-sub mb-1.5" strokeWidth={1.8} />
      <p className="text-[17px] font-bold tabular-nums tracking-tight text-text-main">
        {loading ? "—" : value}
      </p>
      <p className="text-[11px] text-text-sub mt-0.5">{label}</p>
    </div>
  );
}

/* ═══ 타이틀(업적) 섹션 ═══ */
function TitleSection({
  summary,
  initialEquipped,
  adminTitleId,
}: {
  summary: MyActivitySummary;
  initialEquipped: string | null;
  adminTitleId: string | null;
}) {
  const statuses = getTitleStatuses(summary);
  const unlockedCount = countUnlocked(summary);
  const total = TITLES.length;
  const [equipped, setEquipped] = useState<string | null>(initialEquipped);
  const [saving, setSaving] = useState(false);
  const myAdminTitle = findAdminTitle(adminTitleId);

  const handleToggle = async (id: string, isUnlocked: boolean) => {
    if (!isUnlocked || saving) return;
    const next = equipped === id ? null : id;
    const prev = equipped;
    setEquipped(next);
    setSaving(true);
    try {
      const { error } = await createClient().auth.updateUser({
        data: { equipped_title: next },
      });
      if (error) throw error;
    } catch {
      setEquipped(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5">
      {/* 관리자 부여 특별 타이틀 — 색·이모지 없이 회색 테두리 + 이름 */}
      {myAdminTitle && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h2 className="text-[17px] font-bold text-text-main tracking-tight">
              특별 타이틀
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(adminTitleId!, true)}
            disabled={saving}
            className="w-full flex items-center gap-3 px-4 py-3 press transition-transform"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              border: equipped === adminTitleId
                ? "1px solid var(--color-primary)"
                : "1px solid var(--color-border)",
              minHeight: 56,
            }}
          >
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-text-main">{myAdminTitle.name}</span>
                {equipped === adminTitleId && (
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 chip-square text-white" style={{ backgroundColor: "var(--color-primary)" }}>장착중</span>
                )}
              </div>
              <p className="text-[13px] text-text-sub mt-0.5">{myAdminTitle.description}</p>
            </div>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-[17px] font-bold text-text-main tracking-tight">
          업적
        </h2>
        <span className="text-[11px] font-semibold text-text-sub tabular-nums ml-0.5">
          {unlockedCount} / {total}
        </span>
        <span className="text-[11px] text-text-light ml-auto">
          {equipped ? "탭해서 해제" : "탭하면 장착돼요"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statuses.map((t) => (
          <TitleCard
            key={t.id}
            status={t}
            isEquipped={equipped === t.id}
            onToggle={() => handleToggle(t.id, t.isUnlocked)}
          />
        ))}
      </div>
    </div>
  );
}

function TitleCard({
  status,
  isEquipped,
  onToggle,
}: {
  status: TitleStatus;
  isEquipped: boolean;
  onToggle: () => void;
}) {
  const locked = !status.isUnlocked;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      className="relative overflow-hidden px-2 py-3 flex flex-col items-center justify-center text-center press-strong transition-transform disabled:active:scale-100"
      style={{
        background: locked ? "var(--color-surface-alt)" : "var(--color-surface)",
        borderRadius: "var(--radius-card-sm)",
        border: isEquipped
          ? "1px solid var(--color-primary)"
          : "1px solid var(--color-border)",
        minHeight: 72,
      }}
      title={status.description}
    >
      {isEquipped && (
        <span
          className="absolute top-1 right-1 text-[11px] font-semibold px-1.5 py-0.5 chip-square text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          장착
        </span>
      )}
      <p
        className="text-[13px] font-semibold leading-tight"
        style={{ color: locked ? "var(--color-text-light)" : "var(--color-text-main)" }}
      >
        {status.name}
      </p>
      <span className="text-[11px] mt-0.5 text-text-light">
        {CATEGORY_LABELS[status.category]}
      </span>

      {/* 진행도 바 (잠금 상태일 때만) */}
      {locked && status.progressValue > 0 && (
        <div
          className="w-full h-1 mt-1.5 overflow-hidden"
          style={{ borderRadius: "var(--radius-square-sm)", backgroundColor: "var(--color-gray-200)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${status.progressValue * 100}%`,
              backgroundColor: "var(--color-primary)",
              borderRadius: "var(--radius-square-sm)",
            }}
          />
        </div>
      )}
    </button>
  );
}

/* ═══ 빈 상태 — 흰 면 + 헤어라인, 한 줄 ═══ */
function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="py-6 text-center text-[13px] text-text-sub"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      {children}
    </div>
  );
}
