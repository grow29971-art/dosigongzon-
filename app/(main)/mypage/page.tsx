"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import PageIntroModal from "@/app/components/PageIntroModal";
import Image from "next/image";
import {
  User,
  LogOut,
  Loader2,
  Cat as CatIcon,
  MessageCircle,
  AlertTriangle,
  MapPin,
  ChevronRight,
  Camera,
  Pencil,
  Check,
  X,
  MessageSquare,
  Inbox,
  BookOpen,
  UserPlus,
  Sparkles,
  Trophy,
  Ban,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
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
  getLevelColor,
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
  CATEGORY_COLORS,
  TITLES,
  findAdminTitle,
  type TitleStatus,
} from "@/lib/titles";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount } from "@/lib/dm-repo";
import { countMyAcceptedCircleMembers } from "@/lib/circles-repo";
import UIListRow from "@/app/components/ui/ListRow";

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
  const SHOW_CARD_GAME = false;      // 내 고양이 카드(CatchCat 게임)
  const SHOW_JOURNEY = false;        // 당신의 여정
  const SHOW_MONTHLY_REPORT = false; // 이번 달 성장 리포트
  const SHOW_CARETAKERS = false;     // 동네 케어테이커 찾기 — 인원 필요
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
    // theme-mono: 블랙앤그레이화이트 파일럿 (2026-07-18) — var() 기반 색을 무채색으로 전환
    <div className="theme-mono px-4 pt-14 pb-8">
      <PageIntroModal
        storageKey="dosigongzon_intro_mypage"
        badge="마이페이지"
        headerEmoji="👤"
        title="내 돌봄 발자취를 모아봐요"
        items={[
          { emoji: "🏆", text: <>돌볼수록 <b className="text-text-main">레벨·업적·타이틀</b>이 쌓여요.</> },
          { emoji: "🐱", text: <>내 고양이·돌봄 기록·포획 카드를 관리해요.</> },
          { emoji: "⚙️", text: <>알림·서클·차단 등 설정도 여기서 할 수 있어요.</> },
        ]}
      />
      {/* 헤더 */}
      <div className="mb-6 px-1">
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">
            마이페이지
          </h1>
          <span className="text-[11px] font-semibold text-text-light">
            My Page
          </span>
        </div>
        <p className="text-[12.5px] text-text-sub leading-relaxed">
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
          accent="#191F28"
        />
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : user ? (
        <>
          {/* ── 프로필 카드 ── */}
          <div
            className="flex items-center gap-4 px-5 py-4 mb-3"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              boxShadow: "0 6px 20px rgba(49,130,246,0.10), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            {/* 아바타 (탭하면 파일 선택) */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                boxShadow: "0 6px 14px rgba(49,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 3px #fff, 0 0 0 5px rgba(49,130,246,0.25)",
              }}
              aria-label="프로필 사진 변경"
            >
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="64px" style={{ objectFit: "cover" }} />
              ) : (
                <User size={32} color="#fff" strokeWidth={2} />
              )}
              {/* 하단 카메라 배지 */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #FFFFFF",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                {avatarUploading ? (
                  <Loader2 size={11} className="animate-spin" style={{ color: "var(--color-primary)" }} />
                ) : (
                  <Camera size={11} style={{ color: "var(--color-primary)" }} strokeWidth={2.5} />
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
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[15px] font-extrabold outline-none"
                      style={{
                        backgroundColor: "#F9FAFB",
                        color: "#191F28",
                        border: "1px solid #E5E8EB",
                      }}
                      placeholder="닉네임"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNick}
                      disabled={nickSaving}
                      className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                      style={{ backgroundColor: "#6B7684" }}
                    >
                      {nickSaving ? (
                        <Loader2 size={12} className="text-white animate-spin" />
                      ) : (
                        <Check size={12} color="#fff" strokeWidth={3} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditNick}
                      disabled={nickSaving}
                      className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                      style={{ backgroundColor: "#F2F4F6" }}
                    >
                      <X size={12} style={{ color: "#8B95A1" }} strokeWidth={3} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-light mt-1 truncate">{email}</p>
                  {nickError && (
                    <p className="text-[11px] mt-1" style={{ color: "#F04452" }}>
                      {nickError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[17px] font-extrabold text-text-main truncate tracking-tight">
                      {nickname}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartEditNick}
                      className="w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 transition-transform shrink-0"
                      style={{ backgroundColor: "#F2F4F6" }}
                      aria-label="닉네임 수정"
                    >
                      <Pencil size={11} style={{ color: "#8B95A1" }} strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[12px] text-text-light mt-0.5 truncate">{email}</p>
                  {joinedDays > 0 && (
                    <span
                      className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 chip-square text-[10.5px] font-extrabold"
                      style={{ background: "rgba(49,130,246,0.12)", color: "var(--color-primary-dark)" }}
                    >
                      🐾 첫 등록 후 {joinedDays}일째 함께 돌봐요
                    </span>
                  )}
                  {avatarError && (
                    <p className="text-[11px] mt-1" style={{ color: "#F04452" }}>
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

          {/* ── 레벨 카드 ── */}
          {summary && (() => {
            const score = computeScore(summary);
            const lv = computeLevel(score);
            return (
              <div
                className="mb-3 px-5 py-4 relative overflow-hidden dark-card-level"
                style={{
                  background: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 100%)",
                  borderRadius: 22,
                  boxShadow: "0 8px 24px rgba(49,130,246,0.12), 0 1px 3px rgba(0,0,0,0.03)",
                  border: "1.5px solid rgba(49,130,246,0.18)",
                }}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-[48px] h-[48px] rounded-full flex items-center justify-center shrink-0 text-2xl"
                    style={{
                      backgroundColor: "rgba(49,130,246,0.12)",
                    }}
                  >
                    {lv.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[11px] font-extrabold tracking-wider"
                        style={{ color: "var(--color-primary-dark)" }}
                      >
                        LV.{lv.level}
                      </span>
                      <span className="text-[11px] font-bold text-text-light tabular-nums">
                        {lv.score}점
                      </span>
                    </div>
                    <p className="text-[16px] font-extrabold text-text-main tracking-tight mt-0.5">
                      {lv.title}
                    </p>
                  </div>
                </div>
                {/* 진행 바 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] text-text-sub font-semibold">
                      다음 레벨까지
                    </span>
                    <span className="text-[10.5px] font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                      {lv.next
                        ? `${lv.score} / ${lv.next}`
                        : "MAX"}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--color-surface-alt)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${lv.progress * 100}%`,
                        background: "linear-gradient(90deg, var(--color-primary) 0%, #6B7684 100%)",
                        boxShadow: "0 0 8px rgba(49,130,246,0.5)",
                      }}
                    />
                  </div>
                </div>
                {/* 레벨 혜택 */}
                {(() => {
                  const perks = getLevelPerks(lv.level);
                  return (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: "#F2F4F6" }}>
                      <p className="text-[10px] font-bold text-text-light mb-2">Lv.{lv.level} 혜택</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex items-center gap-1.5 text-[10.5px]">
                          <span>🤖</span>
                          <span className="text-text-sub">AI 대화</span>
                          <span className="font-bold text-text-main ml-auto">{perks.aiChatPerMinute}회/분</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px]">
                          <span>📝</span>
                          <span className="text-text-sub">글 작성</span>
                          <span className="font-bold text-text-main ml-auto">{perks.dailyPostLimit === 0 ? "무제한" : `${perks.dailyPostLimit}개/일`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px]">
                          <span>{perks.canUseSpecialEmoji ? "✨" : "🔒"}</span>
                          <span className="text-text-sub">특별 이모지</span>
                          <span className="font-bold ml-auto" style={{ color: perks.canUseSpecialEmoji ? "#6B7684" : "#8B95A1" }}>{perks.canUseSpecialEmoji ? "사용 가능" : "Lv.3+"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── 활동 요약 (3개 지표) ── */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <StatCard
              Icon={CatIcon}
              label="등록 고양이"
              value={summary?.catCount ?? 0}
              color="#191F28"
              glow="49,130,246"
              loading={dataLoading}
            />
            <StatCard
              Icon={MessageCircle}
              label="돌봄 기록"
              value={summary?.commentCount ?? 0}
              color="#6B7684"
              glow="107,142,111"
              loading={dataLoading}
            />
            <StatCard
              Icon={AlertTriangle}
              label="학대 신고"
              value={summary?.alertCount ?? 0}
              color="#F04452"
              glow="216,85,85"
              loading={dataLoading}
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
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
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
                  className="inline-flex items-center gap-1 text-[12px] font-bold text-primary"
                >
                  지도에서 등록하기 <ChevronRight size={12} />
                </Link>
              </EmptyBox>
            ) : (
              <div className="space-y-2">
                {myCats.map((cat) => (
                  <Link
                    key={cat.id}
                    href="/map"
                    className="flex items-center gap-3 px-3 py-2.5 active:scale-[0.99] transition-transform"
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "var(--radius-card-sm)",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0"
                      style={{
                        background: cat.photo_url
                          ? `url('${cat.photo_url}') center/cover`
                          : "#F2F4F6",
                        border: "2px solid #fff",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      {!cat.photo_url && (
                        <div className="w-full h-full flex items-center justify-center">
                          <CatIcon size={18} style={{ color: "var(--color-primary)" }} strokeWidth={2} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-extrabold text-text-main truncate tracking-tight">
                        {cat.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {cat.region && (
                          <span className="text-[11px] text-text-sub flex items-center gap-0.5">
                            <MapPin size={10} />
                            {cat.region}
                          </span>
                        )}
                        <span className="text-[11px] text-text-light">
                          {cat.region && "·"} {formatRelative(cat.created_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-text-muted shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── 좋아요한 고양이 ── */}
          {likedCats.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                  응원하는 고양이 · {likedCats.length}
                </h2>
              </div>
              <div
                className="flex gap-2 overflow-x-auto scrollbar-hide px-1 -mx-1 pb-1"
              >
                {likedCats.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/cats/${cat.id}`}
                    className="shrink-0 active:scale-[0.97] transition-transform"
                    style={{ width: 96 }}
                  >
                    <div
                      className="relative w-24 h-24 rounded-2xl overflow-hidden mb-1.5"
                      style={{
                        background: cat.photo_url
                          ? `url('${cat.photo_url}') center/cover`
                          : "#F2F4F6",
                        boxShadow: "0 3px 10px rgba(0,0,0,0.08)",
                        border: "2px solid #fff",
                      }}
                    >
                      {!cat.photo_url && (
                        <div className="w-full h-full flex items-center justify-center">
                          <CatIcon size={24} style={{ color: "var(--color-primary)" }} strokeWidth={2} />
                        </div>
                      )}
                      <div
                        className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 chip-square"
                        style={{
                          background: "linear-gradient(135deg, #6B7684 0%, #4E5968 100%)",
                          boxShadow: "0 2px 6px rgba(232,107,140,0.4)",
                        }}
                      >
                        <span style={{ fontSize: 9 }}>❤️</span>
                        <span className="text-[9px] font-extrabold text-white">
                          {cat.like_count ?? 0}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] font-extrabold text-text-main truncate text-center">
                      {cat.name}
                    </p>
                    {cat.region && (
                      <p className="text-[10px] text-text-sub truncate text-center">
                        {cat.region}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── 최근 돌봄 기록 ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                최근 돌봄 기록 {myComments.length > 0 && `· ${myComments.length}`}
              </h2>
            </div>
            {dataLoading && myComments.length === 0 ? (
              <EmptyBox>불러오는 중...</EmptyBox>
            ) : myComments.length === 0 ? (
              <EmptyBox>
                <p>아직 남긴 기록이 없어요</p>
                <p className="text-[11px] text-text-light mt-1">
                  지도에서 고양이를 선택해 기록을 남겨보세요
                </p>
              </EmptyBox>
            ) : (
              <div className="space-y-2">
                {myComments.map((c) => {
                  const isAlert = c.kind === "alert";
                  return (
                    <div
                      key={c.id}
                      className="px-4 py-3"
                      style={{
                        background: "#FFFFFF",
                        borderRadius: "var(--radius-card-sm)",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                        border: "1px solid rgba(0,0,0,0.04)",
                        borderLeft: isAlert ? "3px solid #F04452" : "1px solid rgba(0,0,0,0.04)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {isAlert && (
                          <AlertTriangle size={11} style={{ color: "#F04452" }} />
                        )}
                        <span
                          className="text-[11px] font-extrabold"
                          style={{ color: isAlert ? "#F04452" : "var(--color-primary)" }}
                        >
                          {c.cat?.name ?? "알 수 없는 고양이"}
                        </span>
                        {c.author_level && (
                          <span
                            className="text-[9px] font-extrabold px-1.5 py-[1px] rounded-md tabular-nums"
                            style={{
                              backgroundColor: getLevelColor(c.author_level),
                              color: "#FFFFFF",
                              boxShadow: `0 1px 3px ${getLevelColor(c.author_level)}55`,
                            }}
                          >
                            Lv.{c.author_level}
                          </span>
                        )}
                        {c.cat?.region && (
                          <span className="text-[10px] text-text-light">
                            · {c.cat.region}
                          </span>
                        )}
                        <span className="text-[10px] text-text-light ml-auto">
                          {formatRelative(c.created_at)}
                        </span>
                      </div>
                      {c.body && (
                        <p
                          className="text-[12px] leading-relaxed"
                          style={{ color: isAlert ? "#B3242F" : "#333D4B" }}
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
                          className="mt-2 rounded-lg object-cover"
                          style={{ width: 120, height: 90 }}
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
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                내 설정
              </h2>
            </div>
            {/* 활동 그룹 */}
            <p className="text-[10.5px] font-extrabold tracking-[0.15em] mb-2 ml-1" style={{ color: "rgba(49,130,246,0.65)" }}>
              ACTIVITY
            </p>
            {SHOW_CARD_GAME && (
            <Link
              href="/mypage/cards"
              className="w-full flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform mb-2"
              style={{
                background: "linear-gradient(135deg, #191F28 0%, #191F28 100%)",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(99,102,241,0.25)",
                border: "1px solid rgba(99,102,241,0.30)",
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)" }}>
                <span className="text-[20px]">🃏</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-extrabold text-white">내 고양이 카드</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>CatchCat — 등록한 고양이 카드 컬렉션</p>
              </div>
              <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
            </Link>
            )}
            {SHOW_JOURNEY && (
            <Link
              href="/mypage/journey"
              className="w-full flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
              style={{
                background: "linear-gradient(135deg, #F9FAFB 0%, #F2F4F6 100%)",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(49,130,246,0.15), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(49,130,246,0.20)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <Sparkles size={18} color="#191F28" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                  당신의 여정
                </p>
                <p className="text-[11px] text-text-sub mt-0.5">
                  쌓아온 발자취와 따뜻한 순간들 보기
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-primary)", opacity: 0.7 }} />
            </Link>
            )}
            {SHOW_MONTHLY_REPORT && (
            <Link
              href="/mypage/monthly-report"
              className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 active:scale-[0.99] transition-transform"
              style={{
                background: "linear-gradient(135deg, #F2F4F6 0%, #F2F4F6 100%)",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(91,168,118,0.15), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(91,168,118,0.20)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#FFFFFF" }}
              >
                <TrendingUp size={18} color="#6B7684" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                  이번 달 성장 리포트
                </p>
                <p className="text-[11px] text-text-sub mt-0.5">
                  이번 달 내가 얼마나 채웠는지 한눈에 보기
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "#6B7684", opacity: 0.7 }} />
            </Link>
            )}
            {/* ── 토스식 그룹 카드 (2026-07-16): 개별 카드 나열 → 흰 카드 1장 + 행 구분선.
                숨김 플래그 블록을 복원할 땐 UIListRow로 전환해서 이 카드에 넣을 것. ── */}
            <div className="card px-3 py-1">
              <UIListRow
                href="/mypage/activity-regions"
                icon={<MapPin size={18} color="#191F28" strokeWidth={2} />}
                iconBg="var(--color-primary-soft)"
                title="활동 지역 설정"
                subtitle="최대 2곳까지 내 동네를 지정할 수 있어요"
              />
            {SHOW_CARETAKERS && (
            <Link
              href="/caretakers"
              className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 active:scale-[0.99] transition-transform"
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(107,142,111,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(107,142,111,0.12)" }}
              >
                <UserPlus size={18} color="#6B7684" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                  동네 케어테이커 찾기
                </p>
                <p className="text-[11px] text-text-sub mt-0.5">
                  같은 동네에서 활동하는 분들과 연결돼요
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "#6B7684", opacity: 0.7 }} />
            </Link>
            )}
            {SHOW_RANKING && (
            <Link
              href="/ranking"
              className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 active:scale-[0.99] transition-transform"
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(201,169,97,0.12), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(201,169,97,0.14)" }}
              >
                <Trophy size={18} color="#8B95A1" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                  케어테이커 활동 랭킹
                </p>
                <p className="text-[11px] text-text-sub mt-0.5">
                  내 활동 점수와 동네 케어테이커 순위를 확인해요
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "#8B95A1", opacity: 0.7 }} />
            </Link>
            )}
            {/* 설정 항목들 — 각 컴포넌트가 자체적으로 위 구분선을 그리는 행(row)으로 렌더 */}
            <InstallAppMenuItem />
            <EmailDigestToggle />
            <MarketingPushToggle />
            <UIListRow
              href="/guide"
              icon={<BookOpen size={18} color="#4E5968" strokeWidth={2} />}
              iconBg="rgba(139,101,184,0.12)"
              title="사용 가이드"
              subtitle="10가지 핵심 기능 설명을 한눈에"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            />
            </div>
          </div>

          {/* ── 지원 / 문의 ── */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                지원
              </h2>
            </div>
            {/* ── 토스식 그룹 카드 — 지원 항목 묶음 (복원 시 내 서클도 UIListRow로) ── */}
            <div className="card px-3 py-1">
            <UIListRow
              onClick={() => setInquiryOpen(true)}
              icon={<MessageSquare size={18} color="#4E5968" strokeWidth={2} />}
              iconBg="rgba(74,123,168,0.1)"
              title="문의하기"
              subtitle="불편사항, 버그, 제안 등을 관리자에게 전달"
            />
            <UIListRow
              href="/mypage/inquiries"
              icon={<Inbox size={18} color="#4E5968" strokeWidth={2} />}
              iconBg="rgba(72,165,158,0.1)"
              title="내 문의 보기"
              subtitle="접수한 문의·관리자 답변 확인"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            />
            {SHOW_CIRCLE && (
            <Link
              href="/mypage/circle"
              className="w-full flex items-center gap-3 px-4 py-3.5 mt-2 active:scale-[0.99] transition-transform"
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "0 4px 14px rgba(107,142,111,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(107,142,111,0.12)" }}
              >
                <ShieldCheck size={18} color="#4E5968" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                    내 서클
                  </p>
                  <span
                    className="text-[10.5px] font-extrabold px-1.5 py-0.5 chip-square"
                    style={{ background: "#4E5968", color: "#FFF" }}
                  >
                    {circleMemberCount}
                  </span>
                </div>
                <p className="text-[11px] text-text-sub mt-0.5">
                  {circleMemberCount > 0
                    ? `${circleMemberCount}명의 이웃과 함께 안전하게 돌봐요`
                    : "믿는 이웃을 초대해 안전한 돌봄 시작하기"}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "#4E5968", opacity: 0.7 }} />
            </Link>
            )}
            <UIListRow
              href="/mypage/blocked-users"
              icon={<Ban size={18} color="#F04452" strokeWidth={2} />}
              iconBg="rgba(184,69,69,0.1)"
              title="차단한 사용자"
              subtitle="차단 목록 확인 및 해제"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            />
            </div>
          </div>

          {/* ── 관리자 대시보드 (단일 진입점) ── */}
          {isAdmin && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                  운영 관리
                </h2>
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-4 active:scale-[0.99] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #191F28 0%, #333D4B 100%)",
                  borderRadius: 18,
                  boxShadow: "0 6px 20px rgba(44,44,44,0.30), 0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                  <User size={19} color="#fff" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold tracking-tight" style={{ color: "#fff" }}>
                    관리자 대시보드
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                    통계 · 신고·문의 · 유저 · 뉴스 · 병원 · 약품 · 푸시 · 로그
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />
              </Link>
            </div>
          )}

          {/* ── 로그아웃 ── */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[13px] font-bold active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: "#FFFFFF",
              color: "#8B95A1",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <LogOut size={14} />
            로그아웃
          </button>

          {/* ── 회원탈퇴 ── */}
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full text-center py-3 text-[11px] text-text-light underline active:scale-[0.97] transition-transform mt-2"
          >
            회원탈퇴
          </button>

          {/* ── 푸터 ── */}
          <footer className="mt-8 text-center space-y-1 pb-2">
            <div className="flex items-center justify-center gap-3 text-[10px] text-text-light">
              <Link href="/terms" className="hover:underline">이용약관</Link>
              <span>·</span>
              <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
              <span>·</span>
              <Link href="/guide" className="hover:underline">사용 가이드</Link>
            </div>
            <p className="text-[10px] text-text-light">
              © 2026 도시공존 · 운영자 김성우
            </p>
          </footer>

          {/* 탈퇴 확인 모달 */}
          {deleteConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
              <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
              <div className="relative w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl">
                <h2 className="text-[18px] font-extrabold text-text-main mb-2">
                  정말 탈퇴하시겠어요?
                </h2>
                <p className="text-[13px] text-text-sub leading-relaxed mb-1">
                  탈퇴하면 다음 데이터가 <b style={{ color: "#F04452" }}>영구 삭제</b>됩니다.
                </p>
                <ul className="text-[12px] text-text-sub leading-relaxed mb-4 pl-4 list-disc">
                  <li>등록한 고양이 정보</li>
                  <li>돌봄 기록 및 댓글</li>
                  <li>커뮤니티 게시글</li>
                  <li>쪽지 내역</li>
                  <li>업적 및 레벨</li>
                </ul>
                <p className="text-[12px] text-text-sub mb-3">
                  확인을 위해 <b style={{ color: "#F04452" }}>탈퇴합니다</b>를 입력해주세요.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="탈퇴합니다"
                  className="w-full px-4 py-3 rounded-xl bg-surface-alt text-[14px] text-text-main outline-none focus:ring-2 focus:ring-error/20 mb-4 placeholder:text-text-muted"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(""); }}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-xl text-[14px] font-bold bg-surface-alt text-text-sub active:scale-[0.97] transition-transform"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== "탈퇴합니다" || deleting}
                    className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white active:scale-[0.97] transition-transform disabled:opacity-40"
                    style={{ backgroundColor: "#F04452" }}
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
          <Link
            href="/login?next=%2Fmypage"
            className="flex items-center gap-4 px-5 py-5 mb-4 active:scale-[0.98] transition-transform"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              boxShadow: "0 6px 20px rgba(49,130,246,0.10), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                boxShadow: "var(--shadow-primary)",
              }}
            >
              <User size={28} color="#fff" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-extrabold text-text-main">게스트</p>
              <p className="text-[11.5px] text-text-light mt-0.5">
                로그인하고 길고양이 돌봄에 참여하세요
              </p>
            </div>
            <ChevronRight size={18} className="text-text-muted" />
          </Link>
        </>
      )}

      <p className="text-center text-[10px] text-text-muted mt-6">도시공존 v0.1.0</p>

      {/* 문의 모달 */}
      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} />
    </div>
  );
}

/* ═══ 지표 카드 ═══ */
function StatCard({
  Icon,
  label,
  value,
  color,
  glow,
  loading,
}: {
  Icon: typeof CatIcon;
  label: string;
  value: number;
  color: string;
  glow: string;
  loading: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center py-4 px-2"
      style={{
        background: "#FFFFFF",
        borderRadius: 18,
        boxShadow: `0 4px 16px rgba(${glow},0.10), 0 1px 3px rgba(0,0,0,0.03)`,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
        style={{ backgroundColor: `rgba(${glow},0.1)` }}
      >
        <Icon size={18} color={color} strokeWidth={2} />
      </div>
      <p
        className="text-[18px] font-extrabold tabular-nums tracking-tight"
        style={{ color }}
      >
        {loading ? "—" : value}
      </p>
      <p className="text-[10.5px] text-text-sub mt-0.5 font-semibold">{label}</p>
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
      {/* 관리자 부여 특별 타이틀 */}
      {myAdminTitle && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
              특별 타이틀
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleToggle(adminTitleId!, true)}
            disabled={saving}
            className="w-full flex items-center gap-3 p-3 active:scale-[0.98] transition-transform"
            style={{
              background: equipped === adminTitleId
                ? `linear-gradient(135deg, ${myAdminTitle.color}15 0%, ${myAdminTitle.color}08 100%)`
                : "#FFFFFF",
              borderRadius: "var(--radius-card-sm)",
              border: equipped === adminTitleId
                ? `2px solid ${myAdminTitle.color}`
                : "1px solid rgba(0,0,0,0.06)",
              boxShadow: equipped === adminTitleId
                ? `0 4px 14px ${myAdminTitle.color}20`
                : "var(--shadow-card)",
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[24px]"
              style={{ backgroundColor: `${myAdminTitle.color}15` }}
            >
              {myAdminTitle.emoji}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-extrabold text-text-main">{myAdminTitle.name}</span>
                {equipped === adminTitleId && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: myAdminTitle.color }}>장착중</span>
                )}
              </div>
              <p className="text-[11px] text-text-sub mt-0.5">{myAdminTitle.description}</p>
            </div>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
          업적
        </h2>
        <span className="text-[11px] font-bold text-text-sub tabular-nums ml-0.5">
          {unlockedCount} / {total}
        </span>
        <span className="text-[10px] text-text-light ml-auto">
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
  const categoryColor = CATEGORY_COLORS[status.category];

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      className="relative overflow-hidden p-3 flex flex-col items-center text-center active:scale-[0.97] transition-transform disabled:active:scale-100"
      style={{
        background: isEquipped
          ? `${categoryColor}08`
          : locked
            ? "#F9FAFB"
            : "#FFFFFF",
        borderRadius: "var(--radius-card-sm)",
        boxShadow: locked
          ? "none"
          : "var(--shadow-card)",
        border: isEquipped
          ? `2px solid ${categoryColor}`
          : locked
            ? "1.5px dashed #E5E8EB"
            : `1px solid rgba(0,0,0,0.06)`,
      }}
      title={status.description}
    >
      {isEquipped && (
        <span
          className="absolute top-1 right-1 text-[8px] font-extrabold px-1.5 py-0.5 chip-square"
          style={{ backgroundColor: categoryColor, color: "#fff" }}
        >
          장착
        </span>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[20px] mb-1.5"
        style={{
          background: locked ? "#F2F4F6" : `${categoryColor}12`,
          filter: locked ? "grayscale(100%) opacity(0.45)" : "none",
        }}
      >
        {status.emoji}
      </div>
      <p
        className="text-[10.5px] font-extrabold leading-tight"
        style={{ color: locked ? "#8B95A1" : "#191F28" }}
      >
        {status.name}
      </p>
      <span
        className="text-[9px] font-bold mt-0.5 uppercase tracking-wider"
        style={{ color: locked ? "#B0B8C1" : categoryColor }}
      >
        {CATEGORY_LABELS[status.category]}
      </span>

      {/* 진행도 바 (잠금 상태일 때만) */}
      {locked && status.progressValue > 0 && (
        <div
          className="w-full h-1 rounded-full mt-1.5 overflow-hidden"
          style={{ backgroundColor: "#E5E8EB" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${status.progressValue * 100}%`,
              backgroundColor: categoryColor,
              opacity: 0.55,
            }}
          />
        </div>
      )}
    </button>
  );
}

/* ═══ 빈 상태 박스 ═══ */
function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="py-6 text-center text-[12px] text-text-sub"
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-card-sm)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}
