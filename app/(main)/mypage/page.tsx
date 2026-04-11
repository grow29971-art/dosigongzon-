"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
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
  Newspaper,
  MessageSquare,
  Inbox,
  Stethoscope,
} from "lucide-react";
import InquiryModal from "@/app/components/InquiryModal";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  listMyCats,
  listMyComments,
  getMyActivitySummary,
  computeScore,
  computeLevel,
  uploadAvatar,
  updateMyAvatar,
  updateMyNickname,
  getDisplayName,
  getLevelColor,
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
  type TitleStatus,
} from "@/lib/titles";
import { createClient } from "@/lib/supabase/client";

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

  const [summary, setSummary] = useState<MyActivitySummary | null>(null);
  const [myCats, setMyCats] = useState<Cat[]>([]);
  const [myComments, setMyComments] = useState<CatCommentWithCat[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    if (trimmed.length > 20) {
      setNickError("20자 이내로 입력해주세요.");
      return;
    }
    setNickSaving(true);
    setNickError("");
    try {
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
      setMyComments([]);
      return;
    }
    let cancelled = false;
    setDataLoading(true);
    Promise.all([
      getMyActivitySummary(),
      listMyCats(),
      listMyComments(10),
      isCurrentUserAdmin(),
    ])
      .then(([s, cats, comments, admin]) => {
        if (cancelled) return;
        setSummary(s);
        setMyCats(cats);
        setMyComments(comments);
        setIsAdmin(admin);
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

  const nickname = getDisplayName(user);
  const email = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="px-4 pt-14 pb-8">
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
              boxShadow: "0 6px 20px rgba(196,126,90,0.10), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            {/* 아바타 (탭하면 파일 선택) */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative w-16 h-16 rounded-[20px] flex items-center justify-center shrink-0 overflow-hidden active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 6px 14px rgba(196,126,90,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
              aria-label="프로필 사진 변경"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={32} color="#fff" strokeWidth={2} />
              )}
              {/* 하단 카메라 배지 */}
              <div
                className="absolute bottom-0 right-0 w-6 h-6 rounded-[9px] flex items-center justify-center"
                style={{
                  background: "#FFFFFF",
                  border: "2px solid #FFFFFF",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                }}
              >
                {avatarUploading ? (
                  <Loader2 size={11} className="animate-spin" style={{ color: "#C47E5A" }} />
                ) : (
                  <Camera size={11} style={{ color: "#C47E5A" }} strokeWidth={2.5} />
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
                        if (e.key === "Enter") handleSaveNick();
                        if (e.key === "Escape") handleCancelEditNick();
                      }}
                      maxLength={20}
                      autoFocus
                      disabled={nickSaving}
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[15px] font-extrabold outline-none"
                      style={{
                        backgroundColor: "#F6F1EA",
                        color: "#2A2A28",
                        border: "1px solid #E3DCD3",
                      }}
                      placeholder="닉네임"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNick}
                      disabled={nickSaving}
                      className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                      style={{ backgroundColor: "#6B8E6F" }}
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
                      style={{ backgroundColor: "#EEE8E0" }}
                    >
                      <X size={12} style={{ color: "#A38E7A" }} strokeWidth={3} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-light mt-1 truncate">{email}</p>
                  {nickError && (
                    <p className="text-[11px] mt-1" style={{ color: "#B84545" }}>
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
                      style={{ backgroundColor: "#EEE8E0" }}
                      aria-label="닉네임 수정"
                    >
                      <Pencil size={11} style={{ color: "#A38E7A" }} strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[12px] text-text-light mt-0.5 truncate">{email}</p>
                  {avatarError && (
                    <p className="text-[11px] mt-1" style={{ color: "#B84545" }}>
                      {avatarError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── 레벨 카드 ── */}
          {summary && (() => {
            const score = computeScore(summary);
            const lv = computeLevel(score);
            return (
              <div
                className="mb-3 px-5 py-4 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #FFFFFF 0%, #FDF9F2 100%)",
                  borderRadius: 22,
                  boxShadow: "0 8px 24px rgba(196,126,90,0.12), 0 1px 3px rgba(0,0,0,0.03)",
                  border: "1.5px solid rgba(196,126,90,0.18)",
                }}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0 text-2xl"
                    style={{
                      background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                      boxShadow: "0 8px 18px rgba(196,126,90,0.40), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    {lv.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[11px] font-extrabold tracking-wider"
                        style={{ color: "#A8684A" }}
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
                    <span className="text-[10.5px] font-bold tabular-nums" style={{ color: "#C47E5A" }}>
                      {lv.next
                        ? `${lv.score} / ${lv.next}`
                        : "MAX"}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: "#EEE8E0" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${lv.progress * 100}%`,
                        background: "linear-gradient(90deg, #C47E5A 0%, #E88D5A 100%)",
                        boxShadow: "0 0 8px rgba(196,126,90,0.5)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── 활동 요약 (3개 지표) ── */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <StatCard
              Icon={CatIcon}
              label="등록 고양이"
              value={summary?.catCount ?? 0}
              color="#C47E5A"
              glow="196,126,90"
              loading={dataLoading}
            />
            <StatCard
              Icon={MessageCircle}
              label="돌봄 기록"
              value={summary?.commentCount ?? 0}
              color="#6B8E6F"
              glow="107,142,111"
              loading={dataLoading}
            />
            <StatCard
              Icon={AlertTriangle}
              label="학대 신고"
              value={summary?.alertCount ?? 0}
              color="#D85555"
              glow="216,85,85"
              loading={dataLoading}
            />
          </div>

          {/* ── 업적 (타이틀) ── */}
          {summary && (
            <TitleSection
              summary={summary}
              initialEquipped={
                (user?.user_metadata?.equipped_title as string | undefined) ?? null
              }
            />
          )}

          {/* ── 내가 등록한 고양이 ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C47E5A" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                      borderRadius: 16,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0"
                      style={{
                        background: cat.photo_url
                          ? `url('${cat.photo_url}') center/cover`
                          : "#EEE8E0",
                        border: "2px solid #fff",
                        boxShadow: "0 3px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      {!cat.photo_url && (
                        <div className="w-full h-full flex items-center justify-center">
                          <CatIcon size={18} style={{ color: "#C47E5A" }} strokeWidth={2} />
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

          {/* ── 최근 돌봄 기록 ── */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#6B8E6F" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                        borderRadius: 16,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                        border: "1px solid rgba(0,0,0,0.04)",
                        borderLeft: isAlert ? "3px solid #D85555" : "1px solid rgba(0,0,0,0.04)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {isAlert && (
                          <AlertTriangle size={11} style={{ color: "#D85555" }} />
                        )}
                        <span
                          className="text-[11px] font-extrabold"
                          style={{ color: isAlert ? "#D85555" : "#C47E5A" }}
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
                          style={{ color: isAlert ? "#8B2F2F" : "#4A3F35" }}
                        >
                          {c.body}
                        </p>
                      )}
                      {c.photo_url && (
                        <img
                          src={c.photo_url}
                          alt=""
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

          {/* ── 지원 / 문의 ── */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#4A7BA8" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
                지원
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setInquiryOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                boxShadow: "0 4px 14px rgba(74,123,168,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #4A7BA8 0%, #3A6590 100%)",
                  boxShadow: "0 5px 12px rgba(74,123,168,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
              >
                <MessageSquare size={20} color="#fff" strokeWidth={2.3} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                  문의하기
                </p>
                <p className="text-[11px] text-text-sub mt-0.5">
                  불편사항, 버그, 제안 등을 관리자에게 전달
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: "#4A7BA8", opacity: 0.7 }} />
            </button>
          </div>

          {/* ── 관리자 전용 ── */}
          {isAdmin && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#7A6B8E" }} />
                <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
                  관리자 메뉴
                </h2>
              </div>
              <div className="space-y-2">
                <Link
                  href="/admin/news"
                  className="flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    boxShadow: "0 4px 14px rgba(122,107,142,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #7A6B8E 0%, #695B7A 100%)",
                      boxShadow: "0 5px 12px rgba(122,107,142,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    <Newspaper size={20} color="#fff" strokeWidth={2.3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                      뉴스 관리
                    </p>
                    <p className="text-[11px] text-text-sub mt-0.5">
                      홈 화면 소식 & 일정 추가·수정·삭제
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0" style={{ color: "#7A6B8E", opacity: 0.7 }} />
                </Link>
                <Link
                  href="/admin/inbox"
                  className="flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    boxShadow: "0 4px 14px rgba(216,85,85,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #D85555 0%, #B84545 100%)",
                      boxShadow: "0 5px 12px rgba(216,85,85,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    <Inbox size={20} color="#fff" strokeWidth={2.3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                      신고·문의 관리
                    </p>
                    <p className="text-[11px] text-text-sub mt-0.5">
                      유저 신고와 문의를 확인하고 처리
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0" style={{ color: "#D85555", opacity: 0.7 }} />
                </Link>
                <Link
                  href="/admin/hospitals"
                  className="flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    boxShadow: "0 4px 14px rgba(107,142,111,0.10), 0 1px 2px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #6B8E6F 0%, #5A7C5E 100%)",
                      boxShadow: "0 5px 12px rgba(107,142,111,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                  >
                    <Stethoscope size={20} color="#fff" strokeWidth={2.3} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                      병원 관리
                    </p>
                    <p className="text-[11px] text-text-sub mt-0.5">
                      구조동물 치료 도움병원 추가·수정·삭제
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0" style={{ color: "#6B8E6F", opacity: 0.7 }} />
                </Link>
              </div>
            </div>
          )}

          {/* ── 로그아웃 ── */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[13px] font-bold active:scale-[0.97] transition-transform"
            style={{
              backgroundColor: "#FFFFFF",
              color: "#A38E7A",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </>
      ) : (
        <>
          {/* 비로그인 */}
          <Link
            href="/login"
            className="flex items-center gap-4 px-5 py-5 mb-4 active:scale-[0.98] transition-transform"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              boxShadow: "0 6px 20px rgba(196,126,90,0.10), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div
              className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 6px 14px rgba(196,126,90,0.35)",
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
        className="w-10 h-10 rounded-[13px] flex items-center justify-center mb-2"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)`,
          boxShadow: `0 5px 12px rgba(${glow},0.35), inset 0 1px 0 rgba(255,255,255,0.4)`,
        }}
      >
        <Icon size={18} color="#fff" strokeWidth={2.3} />
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
}: {
  summary: MyActivitySummary;
  initialEquipped: string | null;
}) {
  const statuses = getTitleStatuses(summary);
  const unlockedCount = countUnlocked(summary);
  const total = TITLES.length;
  const [equipped, setEquipped] = useState<string | null>(initialEquipped);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (id: string, isUnlocked: boolean) => {
    if (!isUnlocked || saving) return;
    const next = equipped === id ? null : id;
    // 낙관적 UI
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
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C9A961" }} />
        <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
          업적
        </h2>
        <span className="text-[11px] font-bold text-text-sub tabular-nums ml-0.5">
          {unlockedCount} / {total}
        </span>
        <span className="text-[10px] text-text-light ml-auto">
          {equipped ? "탭해서 해제" : "해제된 업적을 탭하면 장착돼요"}
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
      className="relative overflow-hidden p-2.5 flex flex-col items-center text-center active:scale-[0.97] transition-transform disabled:active:scale-100"
      style={{
        background: isEquipped
          ? `linear-gradient(135deg, ${categoryColor}18, ${categoryColor}08)`
          : locked
            ? "#F6F1EA"
            : "#FFFFFF",
        borderRadius: 14,
        boxShadow: isEquipped
          ? `0 6px 18px ${categoryColor}33, 0 1px 3px rgba(0,0,0,0.04)`
          : locked
            ? "inset 0 1px 2px rgba(0,0,0,0.03)"
            : `0 4px 12px ${categoryColor}22, 0 1px 2px rgba(0,0,0,0.03)`,
        border: isEquipped
          ? `2px solid ${categoryColor}`
          : locked
            ? "1px dashed #D6CDBE"
            : `1.5px solid ${categoryColor}55`,
      }}
      title={status.description}
    >
      {isEquipped && (
        <span
          className="absolute top-1 right-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: categoryColor, color: "#fff" }}
        >
          장착
        </span>
      )}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[18px] mb-1"
        style={{
          background: locked ? "#E8E0D2" : `${categoryColor}18`,
          filter: locked ? "grayscale(100%) opacity(0.55)" : "none",
        }}
      >
        {status.emoji}
      </div>
      <p
        className="text-[10.5px] font-extrabold leading-tight"
        style={{ color: locked ? "#A38E7A" : "#2A2A28" }}
      >
        {status.name}
      </p>
      <span
        className="text-[9px] font-bold mt-0.5 uppercase tracking-wider"
        style={{ color: locked ? "#C0B3A0" : categoryColor }}
      >
        {CATEGORY_LABELS[status.category]}
      </span>

      {/* 진행도 바 (잠금 상태일 때만) */}
      {locked && status.progressValue > 0 && (
        <div
          className="w-full h-1 rounded-full mt-1.5 overflow-hidden"
          style={{ backgroundColor: "#E3DCD3" }}
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
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}
