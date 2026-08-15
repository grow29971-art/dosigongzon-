"use client";

import { GEOLOCATION_ENABLED, GEO_DISABLED_MESSAGE } from "@/lib/geo";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X,
  MapPin,
  Heart,
  Plus,
  Loader2,
  Send,
  AlertTriangle,
  MessageCircle,
  Globe,
  Shield,
  Phone,
  Copy,
  Check,
  Camera,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ChevronDown,
  ChevronUp,
  Trash2,
  Star,
  LocateFixed,
  Stethoscope,
  Clock,
  ChevronRight,
  Pencil,
  Save,
  Share2,
  Search,
  SlidersHorizontal,
  BookOpen,
  Sparkles,
  PhoneCall,
  PawPrint,
} from "lucide-react";
import UIChip from "@/app/components/ui/Chip";
import dynamic from "next/dynamic";
import { CARD_THEME, pseudoDexNo, type CardRarity } from "@/app/components/CatCard";
// 모달·고급 패널은 첫 페인트 후로 코드 스플리팅 (열기 전엔 다운로드 안 함)
const AddCatModal = dynamic(() => import("@/app/components/AddCatModal"), { ssr: false });
const VisibilityIntroSheet = dynamic(() => import("@/app/components/VisibilityIntroSheet"), { ssr: false });
const CatQRModal = dynamic(() => import("@/app/components/CatQRModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/app/components/ReportModal"), { ssr: false });
import {
  listCats,
  listComments,
  createComment,
  uploadCommentPhoto,
  listAlertedCatIds,
  voteComment,
  getMyCommentVotes,
  getLevelColor,
  thumbnailUrl,
  optimizedImageUrl,
  MAP_CENTER,
  roamCoord,
  catRoamMode,
  setRoamWeather,
  getDisplayCoord,
  type Cat,
  type CatComment,
  type CommentKind,
  type VoteValue,
} from "@/lib/cats-repo";
import { sfx, primeSfx } from "@/lib/sfx";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/app/components/Toast";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { catArtWalkSvg, personMarkerSvg } from "@/lib/cat-art";
import { findLocationViolations } from "@/lib/location-patterns";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";
import { getMyBlockedIdSet } from "@/lib/blocks-repo";
import TitleBadge from "@/app/components/TitleBadge";
import SendDMButton from "@/app/components/SendDMButton";
import SafetyCallSheet from "@/app/components/SafetyCallSheet";
import { listRescueHospitals, type RescueHospital } from "@/lib/hospitals-repo";
import type { Post } from "@/lib/types";
import type {
  KakaoMapMouseEvent, KakaoMap, KakaoOverlay, KakaoCircle,
} from "@/lib/kakao-types";

// 지도 오버레이에 배회 애니메이션용 앱 데이터를 얹은 확장 타입 (SDK 외 프로젝트 전용).
// CustomOverlay 인스턴스에 런타임으로 붙이는 필드라 kakao-types.ts(순수 SDK)가 아닌 여기 둔다.
interface RoamOverlay extends KakaoOverlay {
  __roamCat?: Cat;
  __stateEl?: HTMLElement | null;
  __emoteEl?: HTMLElement | null;
  __flipEl?: HTMLElement | null; // 전신 고양이 좌우 반전 컨테이너 (.cat-walk-flip)
  __lastLng?: number;            // 직전 반영 경도 — 이동 방향 결정 + 미세이동 스킵 판정
  __lastLat?: number;            // 직전 반영 위도 — 미세이동 스킵 판정
}

// area_chats 행 — temp- 접두사 id는 낙관적 메시지(아직 서버 미반영)
type AreaChat = {
  id: string;
  area: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url?: string | null;
  author_level?: number | null;
  body: string;
  created_at: string;
};
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
const CareLogTab = dynamic(() => import("@/app/components/CareLogTab"), { ssr: false });
const CatCard = dynamic(() => import("@/app/components/CatCard"), { ssr: false });
import MapIntroModal from "@/app/components/MapIntroModal";
import CareTeamCard from "@/app/components/CareTeamCard";
import { getDisplayName as getChatDisplayName, updateCat, deleteCat, deleteComment, toggleCatLike, petCat, listMyLikedCatIds, GENDER_MAP, HEALTH_MAP, ADOPTION_MAP, VISIBILITY_MAP, type CatGender, type CatHealthStatus, type AdoptionStatus, type CatVisibility } from "@/lib/cats-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import {
  listMyActivityRegions,
  type ActivityRegion,
} from "@/lib/activity-regions-repo";
import Link from "next/link";
import { shareToKakao } from "@/lib/kakao-share";
// 코치마크/채팅 가이드는 첫 진입 시점에만 일시 노출. 첫 페인트 이후 lazy 로드.
const MapCoachmark = dynamic(() => import("@/app/components/MapCoachmark"), { ssr: false });
const MapChatGuideModal = dynamic(() => import("@/app/components/MapChatGuideModal"), { ssr: false });
import ReactionBar from "@/app/components/ReactionBar";
import SendToCatStar from "@/app/components/SendToCatStar";
import { listReactionsBatch, type ReactionSummary } from "@/lib/reactions-repo";
const CatLocationPicker = dynamic(() => import("@/app/components/CatLocationPicker"), { ssr: false });

const CAT_TAG_OPTIONS = [
  "TNR 완료","TNR 필요","이어팁","사람 친화","겁 많음","성묘",
  "어린 고양이","새끼 동반","야행성","온순","예민","식탐 많음",
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// 마커 둥실둥실 부유 래퍼 — 고양이별 주기(2.2~3.2s)·위상 변주 (globals.css cat-float)
// 배회 이동(setPosition)과 독립적으로 겹쳐 동작해 떠다니는 느낌을 만든다.
// 사용자 유래 문자열을 innerHTML에 넣기 전 HTML 이스케이프 (저장형 XSS 차단).
// region(동 이름)은 정상 경로에선 카카오 지오코딩 값이지만, 저장 경계가 UI가 아니라
// REST 직결로 <img onerror> 등을 심을 수 있어 렌더 시점에 반드시 이스케이프한다.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function floatWrap(inner: string, seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const dur = (2.2 + (h % 100) / 100).toFixed(2);
  const delay = (-((h >> 3) % 27) / 10).toFixed(1);
  return `<div class="cat-float" style="animation-duration:${dur}s;animation-delay:${delay}s">${inner}</div>`;
}

// 마커 뽀용 탄성 — 누를 때마다 젤리 바운스(cat-boing) + 햅틱 + 랜덤 이모지 팡.
// 마커 루트에 class="cat-press"와 --mk-tr(기존 translate) 지정 필요 (globals.css cat-boing).
const PRESS_POPS = ["💕", "✨", "🐾", "😻", "💛", "🐟"];
function attachPressFx(el: HTMLElement) {
  const target = el.querySelector<HTMLElement>(".cat-press");
  if (!target) return;
  el.addEventListener("pointerdown", () => {
    try { if ("vibrate" in navigator) navigator.vibrate(8); } catch {}
    // 연타 시에도 매번 처음부터 재생 — 클래스 제거 후 리플로우로 애니메이션 리셋
    target.classList.remove("cat-boing");
    void target.offsetWidth;
    target.classList.add("cat-boing");
    const pop = document.createElement("span");
    pop.className = "cat-press-pop";
    pop.textContent = PRESS_POPS[Math.floor(Math.random() * PRESS_POPS.length)];
    target.appendChild(pop);
    setTimeout(() => pop.remove(), 750);
  });
}

// 고양이 기분 이모지 스팬 — per-cat 지연으로 뿜는 타이밍을 흩뿌림 (globals.css cat-emote)
const STROLL_EMOTES = ["💕", "✨", "🐾", "😻", "🐟"];
function catStrollEmote(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return STROLL_EMOTES[h % STROLL_EMOTES.length];
}
function emoteSpan(seed: string, emoji: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  const delay = -((h % 90) / 10).toFixed(1); // -0 ~ -8.9s
  return `<span class="cat-emote" style="animation-delay:${delay}s">${emoji}</span>`;
}
// roam 상태 → 뿜을 이모지 (자면 💤 / 우다다면 💨 / 평소엔 고양이별 고정 감정)
function emoteForCat(catId: string, tMs?: number): string {
  const mode = catRoamMode(catId, tMs).mode;
  if (mode === "rest") return "💤";
  if (mode === "zoomies") return "💨";
  return catStrollEmote(catId);
}

// 지도 마커 캐시 (sessionStorage). 변경 발생 시 invalidate해서 stale 데이터 방지.
const MAP_CATS_CACHE_KEY = "dosi_map_cats_v1";
const MAP_CATS_CACHE_TTL_MS = 5 * 60 * 1000;
function invalidateMapCatsCache() {
  try { sessionStorage.removeItem(MAP_CATS_CACHE_KEY); } catch {}
}

export default function MapPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isLoggedIn = !!user;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<RoamOverlay[]>([]);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Cat | null>(null);
  // 상세 패널 메인 사진 로드 실패 시(스토리지 삭제·네트워크 오류) 깨진 이미지 아이콘 대신
  // placeholder로 대체 — 다른 고양이를 선택하면 다시 시도.
  const [selectedCatPhotoFailed, setSelectedCatPhotoFailed] = useState(false);
  useEffect(() => { setSelectedCatPhotoFailed(false); }, [selectedCat?.id]);
  const [catCardTab, setCatCardTab] = useState<"carelog" | "community" | "card">("carelog");
  // 선택된 고양이의 포획 카드 등급에 맞춰 상세 패널을 카드처럼 테마링
  const catRarity = (selectedCat?.card_rarity ?? "common") as CardRarity;
  const catCardTheme = CARD_THEME[catRarity] ?? CARD_THEME.common;
  const catDexNo = selectedCat ? pseudoDexNo(selectedCat.card_name ?? selectedCat.name) : "000";
  const [showCats, setShowCats] = useState(true);
  const [todayVisit, setTodayVisit] = useState<number | null>(null);
  const [showHospitals, setShowHospitals] = useState(true);
  const [showPharmacies, setShowPharmacies] = useState(true);
  const [mapError, setMapError] = useState("");

  // ── 고양이 좋아요 ──
  const [likedCatIds, setLikedCatIds] = useState<Set<string>>(new Set());
  const [likingCat, setLikingCat] = useState(false);

  // ── 공유 상태 ──
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  // ── 검색 / 필터 ──
  const [searchQ, setSearchQ] = useState("");
  const [searchQDebounced, setSearchQDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSearchQDebounced(searchQ), 200);
    return () => clearTimeout(id);
  }, [searchQ]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // ── P2 지도·발견 (핵심 여정 개편) — 첫 화면은 기본 탐색(지역·검색·마커·등록)만 남기고
  // 레이어 칩·활동 지역 탭·경보 카드·채팅 FAB은 "상세 도구" 2차 영역으로 접는다.
  // flag off / kill switch면 detailToolsVisible이 항상 true → 기존 UI 완전 유지.
  const SHOW_MAP_DISCOVERY = isCoreJourneyEnabled("P2");
  const [detailToolsOpen, setDetailToolsOpen] = useState(false);
  const detailToolsVisible = !SHOW_MAP_DISCOVERY || detailToolsOpen;
  type CatFilter = "all" | "tnr_needed" | "neutered" | "health_concern" | "alert";
  const [catFilter, setCatFilter] = useState<CatFilter>("all");

  // ── 활동 지역 ──
  const [activityRegions, setActivityRegions] = useState<ActivityRegion[]>([]);
  // 'all' = 전체, 1|2 = 해당 슬롯만 필터
  const [regionFilter, setRegionFilter] = useState<"all" | 1 | 2>("all");
  const regionCirclesRef = useRef<(KakaoCircle | KakaoOverlay)[]>([]);

  const [cats, setCats] = useState<Cat[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catsError, setCatsError] = useState("");
  const [alertedCats, setAlertedCats] = useState<Set<string>>(new Set());
  // 곁에 있어요 — 112/119 빠른 전화 시트 (A-1, 서버 무경유)
  const [safetyOpen, setSafetyOpen] = useState(false);

  // 검색어 매칭 개수 — "등록했는데 안 보인다" 문의 방지용 피드백.
  // 매칭이 있으면 지도가 자동으로 그쪽으로 이동하고(마커 렌더 useEffect), 없으면
  // "검색 결과가 없어요"를 보여줘서 등록 자체가 잘못됐는지 바로 알 수 있게 함.
  const searchMatchCount = useMemo(() => {
    const q = searchQDebounced.trim().toLowerCase();
    if (!q) return null;
    return cats.filter((c) => {
      const hay = [c.name, c.region ?? "", c.description ?? "", ...(c.tags ?? [])].join(" ").toLowerCase();
      return hay.includes(q);
    }).length;
  }, [cats, searchQDebounced]);

  const [abuseCardExpanded, setAbuseCardExpanded] = useState(false);
  // GPS 좌표는 state가 아니라 ref — watchPosition이 이동 중 초당 ~1회 픽스를 주는데,
  // state면 그때마다 이 거대 컴포넌트 전체가 리렌더된다. 오버레이는 명령형으로 직접 갱신.
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const applyUserPosRef = useRef<(() => void) | null>(null);

  // 병원 오버레이 (항상 표시)
  const [hospitals, setHospitals] = useState<RescueHospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<RescueHospital | null>(null);
  const hospitalOverlaysRef = useRef<KakaoOverlay[]>([]);

  // 현재 구 감지 + 채팅
  const [currentGu, setCurrentGu] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // 채팅 스코프 — currentGu(동네) 또는 "전체"(global). "전체"는 모든 지역이 함께 쓰는 방.
  const [chatArea, setChatArea] = useState("");
  const [chatMessages, setChatMessages] = useState<AreaChat[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 채팅 메시지 전송: 즉시 화면 표시 + DB 저장
  const handleChatSend = async () => {
    if (!chatArea || !chatText.trim() || chatSending || !user) return;
    const body = chatText.trim();
    setChatText("");
    setChatSending(true);

    // 낙관적 업데이트: 보내는 즉시 화면에 표시
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      area: chatArea,
      author_id: user.id,
      author_name: getChatDisplayName(user),
      body,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

    try {
      const supabase = createSupabaseClient();
      // 레벨 계산
      let level: number | null = null;
      try {
        const { getMyActivitySummary, computeScore, computeLevel } = await import("@/lib/cats-repo");
        const s = await getMyActivitySummary();
        level = computeLevel(computeScore(s)).level;
      } catch { /* skip */ }

      const { data, error } = await supabase
        .from("area_chats")
        .insert({
          area: chatArea,
          author_id: user.id,
          author_name: getChatDisplayName(user),
          author_avatar_url: user.user_metadata?.avatar_url ?? null,
          author_level: level,
          body,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // 임시 ID를 실제 ID로 교체
      setChatMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data : m)),
      );

      // 폴링이 1초마다 다른 클라이언트에 전달
    } catch (err) {
      // 실패 시 낙관적 메시지 제거
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(err instanceof Error ? err.message : "메시지 전송 실패");
    } finally {
      setChatSending(false);
    }
  };

  // 채팅방: Realtime 구독 + 30초 폴백 (탭 활성화 시에만)
  // ※ 이전: 1초 폴링 → egress 폭증 (50메시지 × 1Hz = 1.3GB/일/유저). 2026-05-09 변경.
  useEffect(() => {
    if (!chatOpen || !chatArea) return;

    setChatMessages([]);

    const supabase = createSupabaseClient();
    const fetchArea = chatArea;
    let active = true;
    let firstFetchDone = false;
    let lastCount = -1;
    let lastId = "";

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("area_chats")
        .select("*")
        .eq("area", fetchArea)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!active) return;
      if (fetchArea !== chatArea) return;

      const msgs: AreaChat[] = ((data ?? []) as AreaChat[]).filter((m) => m.area === fetchArea);

      const newLastId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";
      const needsUpdate = !firstFetchDone || msgs.length !== lastCount || newLastId !== lastId;
      if (!needsUpdate) return;

      firstFetchDone = true;
      lastCount = msgs.length;
      lastId = newLastId;

      setChatMessages((prev) => {
        const tempMsgs = prev.filter((m) => m.id.startsWith("temp-") && m.area === fetchArea);
        const remainingTemp = tempMsgs.filter(
          (t) => !msgs.some((m) => m.author_id === t.author_id && m.body === t.body),
        );
        return [...msgs, ...remainingTemp];
      });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };

    // 1) 초기 로드
    fetchMessages();

    // 2) Realtime — 새 메시지 즉시 수신 (egress 거의 없음, websocket 단일 연결)
    const channel = supabase
      .channel(`area-chats-${fetchArea}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "area_chats",
          filter: `area=eq.${fetchArea}`,
        },
        () => { if (active && document.visibilityState === "visible") fetchMessages(); },
      )
      .subscribe();

    // 3) 폴백 — Realtime 끊김 대비, 30초마다 + 탭 활성 시에만
    const fallbackInterval = setInterval(() => {
      if (active && document.visibilityState === "visible") fetchMessages();
    }, 30000);

    // 4) 탭 다시 활성화 시 즉시 동기화
    const onVis = () => {
      if (active && document.visibilityState === "visible") fetchMessages();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      active = false;
      clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [chatOpen, chatArea]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  // 등록 시작 전 공개 범위 안내 시트 + 선택된 visibility (시트 → 모달로 전달)
  const [visibilityIntroOpen, setVisibilityIntroOpen] = useState(false);
  const [pickedVisibility, setPickedVisibility] = useState<CatVisibility>("public");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | undefined>();

  // ── 댓글 상태 ──
  const [comments, setComments] = useState<CatComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>("note");
  const [togglingAlert, setTogglingAlert] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentPhotoFile, setCommentPhotoFile] = useState<File | null>(null);
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // 내 투표 상태 Map<commentId, 1|-1>
  const [myVotes, setMyVotes] = useState<Map<string, 1 | -1>>(new Map());
  // 댓글 이모지 리액션: comment_id → summary
  const [commentReactions, setCommentReactions] = useState<Map<string, ReactionSummary>>(new Map());
  // 신고 모달
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    type: "comment" | "cat";
    snapshot: string;
    authorUserId?: string | null;
    authorName?: string | null;
  } | null>(null);

  // 댓글 사진 프리뷰 URL 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (commentPhotoPreview) URL.revokeObjectURL(commentPhotoPreview);
    };
  }, [commentPhotoPreview]);

  const handleCommentPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (commentPhotoPreview) URL.revokeObjectURL(commentPhotoPreview);
    setCommentPhotoFile(file);
    setCommentPhotoPreview(URL.createObjectURL(file));
    // 같은 파일 다시 선택 가능하도록 value 초기화
    e.target.value = "";
  };

  const clearCommentPhoto = () => {
    if (commentPhotoPreview) URL.revokeObjectURL(commentPhotoPreview);
    setCommentPhotoFile(null);
    setCommentPhotoPreview(null);
  };

  // 선택된 고양이 변경 시 댓글 로드 + Realtime 구독
  useEffect(() => {
    if (!selectedCat) {
      setComments([]);
      setNewComment("");
      setCommentsError("");
      clearCommentPhoto();
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError("");

    const reload = async () => {
      try {
        const [list, blocked] = await Promise.all([
          listComments(selectedCat.id),
          getMyBlockedIdSet(),
        ]);
        if (cancelled) return;
        // 차단한 유저의 댓글은 가림
        const filtered = blocked.size === 0
          ? list
          : list.filter((c) => !c.author_id || !blocked.has(c.author_id));
        setComments(filtered);
        if (isLoggedIn && filtered.length > 0) {
          const votes = await getMyCommentVotes(filtered.map((c) => c.id));
          if (!cancelled) setMyVotes(votes);
        } else {
          setMyVotes(new Map());
        }
        if (filtered.length > 0) {
          const reactions = await listReactionsBatch("cat_comment", filtered.map((c) => c.id));
          if (!cancelled) setCommentReactions(reactions);
        } else {
          setCommentReactions(new Map());
        }
      } catch (err) {
        if (!cancelled) {
          setCommentsError(err instanceof Error ? err.message : "불러오기 실패");
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };

    reload();

    // Realtime — 같은 cat_id에 대한 새 댓글·삭제 감지
    const supabaseRt = createSupabaseClient();
    const channel = supabaseRt
      .channel(`cat-comments-${selectedCat.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cat_comments",
          filter: `cat_id=eq.${selectedCat.id}`,
        },
        () => { if (!cancelled) reload(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabaseRt.removeChannel(channel);
    };
  }, [selectedCat, isLoggedIn]);

  // ── 댓글 투표 토글 ──
  const handleVoteComment = async (commentId: string, next: 1 | -1) => {
    if (!isLoggedIn) {
      setCommentsError("로그인이 필요해요.");
      return;
    }
    const prevVote = myVotes.get(commentId) ?? 0;
    // 같은 걸 다시 누르면 취소, 다른 걸 누르면 전환
    const newVote: VoteValue = prevVote === next ? 0 : next;

    // 낙관적 업데이트
    setMyVotes((m) => {
      const nm = new Map(m);
      if (newVote === 0) nm.delete(commentId);
      else nm.set(commentId, newVote);
      return nm;
    });
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        let like = c.like_count;
        let dis = c.dislike_count;
        // 이전 투표 되돌리기
        if (prevVote === 1) like = Math.max(0, like - 1);
        if (prevVote === -1) dis = Math.max(0, dis - 1);
        // 새 투표 반영
        if (newVote === 1) like += 1;
        if (newVote === -1) dis += 1;
        return { ...c, like_count: like, dislike_count: dis };
      }),
    );

    try {
      await voteComment(commentId, newVote);
    } catch (err) {
      // 실패 시 롤백
      setMyVotes((m) => {
        const nm = new Map(m);
        if (prevVote === 0) nm.delete(commentId);
        else nm.set(commentId, prevVote);
        return nm;
      });
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          let like = c.like_count;
          let dis = c.dislike_count;
          // 낙관적 업데이트 되돌리기
          if (newVote === 1) like = Math.max(0, like - 1);
          if (newVote === -1) dis = Math.max(0, dis - 1);
          if (prevVote === 1) like += 1;
          if (prevVote === -1) dis += 1;
          return { ...c, like_count: like, dislike_count: dis };
        }),
      );
      setCommentsError(
        err instanceof Error ? err.message : "투표에 실패했어요.",
      );
    }
  };

  const handleSubmitComment = async () => {
    if (!selectedCat || submittingComment) return;
    // 텍스트 또는 사진 중 하나는 있어야 함
    if (!newComment.trim() && !commentPhotoFile) return;
    setSubmittingComment(true);
    setCommentsError("");
    try {
      // 사진이 있으면 먼저 업로드
      let photoUrl: string | null = null;
      if (commentPhotoFile) {
        photoUrl = await uploadCommentPhoto(commentPhotoFile);
      }

      const created = await createComment(
        selectedCat.id,
        newComment,
        commentKind,
        photoUrl,
      );
      setComments((prev) => [created, ...prev]);
      setNewComment("");
      setCommentKind("note");
      clearCommentPhoto();

      // 학대 신고 2건 이상이면 해당 고양이 마커에 학대경보 라벨 즉시 반영
      // (현재 로드된 comments + 방금 만든 created 합쳐서 alert 개수 체크)
      if (created.kind === "alert") {
        const alertCount =
          comments.filter((c) => c.kind === "alert").length + 1;
        if (alertCount >= 2) {
          setAlertedCats((prev) => {
            const next = new Set(prev);
            next.add(created.cat_id);
            return next;
          });
        }
      }
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : "댓글 작성 실패");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── 학대경보 원터치 토글 (2026-08-13 사장님 요청) ──
  // 기존엔 댓글창에서 ⚠️ 모드로 전환해 글을 써야 경보가 켜졌다. 이제 시트 버튼 한 번으로
  // 켜고/끄기 — 저장은 동일하게 kind="alert" 댓글이라 레벨 1 가드·킬스위치·48시간
  // 자동 해제 등 기존 방어선을 전부 그대로 통과한다. 끄기 = 내 경보 댓글 삭제(RLS 본인만).
  const ALERT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // listAlertedCatIds(2)와 동일 창
  const myActiveAlert =
    (user &&
      comments.find(
        (c) =>
          c.kind === "alert" &&
          c.author_id === user.id &&
          Date.now() - new Date(c.created_at).getTime() < ALERT_WINDOW_MS,
      )) ||
    null;

  // 마커 경보 상태를 5분 세션 캐시에도 반영 — 새로고침 시 옛 상태로 되돌아가지 않게
  const syncAlertedCache = (next: Set<string>) => {
    try {
      const raw = sessionStorage.getItem(MAP_CATS_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        cached.alerted = Array.from(next);
        sessionStorage.setItem(MAP_CATS_CACHE_KEY, JSON.stringify(cached));
      }
    } catch {}
  };

  const handleToggleAbuseAlert = async () => {
    if (!selectedCat || togglingAlert || commentsLoading) return;
    if (!isLoggedIn) {
      if (confirm("로그인하면 학대경보를 켤 수 있어요. 로그인할까요?")) window.location.href = "/login";
      return;
    }
    if (myActiveAlert) {
      if (!confirm(`${selectedCat.name}의 학대경보를 해제할까요?`)) return;
    } else if (
      !confirm(
        `${selectedCat.name} 주변에 학대·위험 의심 상황이 있나요?\n\n경보를 켜면 48시간 동안 지도 마커에 ⚠️ 학대경보가 표시되고, 112·상담센터 연락 버튼이 활성화돼요.\n\n긴급한 현장은 112에 먼저 신고해주세요.`,
      )
    ) {
      return;
    }
    setTogglingAlert(true);
    setCommentsError("");
    try {
      if (myActiveAlert) {
        await deleteComment(myActiveAlert.id);
        const remaining = comments.filter((c) => c.id !== myActiveAlert.id);
        setComments(remaining);
        const stillAlerted = remaining.some(
          (c) =>
            c.kind === "alert" &&
            Date.now() - new Date(c.created_at).getTime() < ALERT_WINDOW_MS,
        );
        if (!stillAlerted) {
          const next = new Set(alertedCats);
          next.delete(selectedCat.id);
          setAlertedCats(next);
          syncAlertedCache(next);
        }
      } else {
        const created = await createComment(
          selectedCat.id,
          "⚠️ 학대·위험 의심 경보 (지도에서 원터치로 켰어요)",
          "alert",
        );
        setComments((prev) => [created, ...prev]);
        const next = new Set(alertedCats);
        next.add(selectedCat.id);
        setAlertedCats(next);
        syncAlertedCache(next);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "학대경보 처리에 실패했어요.";
      // 버튼이 댓글 영역과 떨어져 있어 에러를 즉시 보여준다 (레벨 가드·킬스위치 안내 포함)
      setCommentsError(msg);
      alert(msg);
    } finally {
      setTogglingAlert(false);
    }
  };

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── DB에서 고양이 목록 + 학대 신고 목록 불러오기 (sessionStorage 5분 캐시) ──
  const fetchFresh = useCallback(async () => {
    try {
      const [data, alertedIds] = await Promise.all([
        listCats(),
        listAlertedCatIds(2),
      ]);
      setCats(data);
      setAlertedCats(alertedIds);
      try {
        sessionStorage.setItem(MAP_CATS_CACHE_KEY, JSON.stringify({
          ts: Date.now(),
          data,
          alerted: Array.from(alertedIds),
        }));
      } catch {}
    } catch (err) {
      setCatsError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoadingCats(false);
    }
  }, []);

  const fetchCats = useCallback(async () => {
    setCatsError("");
    // 캐시 즉시 적용 → 첫 페인트 빠르게
    try {
      const cached = sessionStorage.getItem(MAP_CATS_CACHE_KEY);
      if (cached) {
        const { ts, data, alerted } = JSON.parse(cached);
        if (Date.now() - ts < MAP_CATS_CACHE_TTL_MS) {
          setCats(data);
          setAlertedCats(new Set(alerted));
          setLoadingCats(false);
          // 백그라운드에서 새로고침 (stale-while-revalidate)
          setTimeout(() => fetchFresh(), 200);
          return;
        }
      }
    } catch {}
    setLoadingCats(true);
    await fetchFresh();
  }, [fetchFresh]);

  useEffect(() => {
    fetchCats();
    listRescueHospitals().then(setHospitals).catch(() => {});

    // 비크리티컬: 첫 페인트 후로 지연
    const idle: (cb: () => void) => void =
      (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb) => { setTimeout(cb, 800); });
    idle(() => {
      // 날씨 → 배회 위축 (비/눈/폭염이면 고양이들이 숨음)
      fetch("/api/weather")
        .then((r) => r.json())
        .then((w) => setRoamWeather(w?.weatherMain ?? null, typeof w?.feelsLike === "number" ? w.feelsLike : null))
        .catch(() => {});
      // 로그인 유저는 auth 헤더를 실어야 daily_visits(유저 단위 방문 원장)에 잡힌다
      // (2026-07-22 리텐션 회의: 지도 직행 유저 WAU 과소집계 수정)
      (async () => {
        const headers: Record<string, string> = {};
        try {
          const { data } = await createSupabaseClient().auth.getSession();
          if (data.session?.access_token) {
            headers["Authorization"] = `Bearer ${data.session.access_token}`;
          }
        } catch { /* 비로그인 — IP 기반 집계로 폴백 */ }
        fetch("/api/visit", { method: "POST", headers }).catch(() => {});
      })();
      // 라벨이 "방문자 N명"(누적) — 오늘 수치가 아니라 누적을 쓴다
      fetch("/api/visit").then((r) => r.json()).then((d) => setTodayVisit(d.cumulative)).catch(() => {});
    });
  }, [fetchCats]);

  // ── 활동 지역 로드 (로그인 유저만) ──
  useEffect(() => {
    if (!isLoggedIn) {
      setActivityRegions([]);
      return;
    }
    listMyActivityRegions().then(setActivityRegions).catch(() => {});
  }, [isLoggedIn, user?.id]);

  // ── 내가 좋아요 누른 고양이 로드 ──
  useEffect(() => {
    if (!isLoggedIn) {
      setLikedCatIds(new Set());
      return;
    }
    listMyLikedCatIds().then(setLikedCatIds).catch(() => {});
  }, [isLoggedIn, user?.id]);

  // ── 좋아요 토글 ──
  const handleToggleCatLike = async () => {
    if (!selectedCat) return;
    if (!isLoggedIn) {
      if (confirm("로그인하면 좋아요를 누를 수 있어요. 로그인할까요?")) window.location.href = "/login";
      return;
    }
    if (likingCat) return;
    setLikingCat(true);

    const catId = selectedCat.id;
    const wasLiked = likedCatIds.has(catId);
    const currentCount = selectedCat.like_count ?? 0;

    // 낙관적 업데이트
    setLikedCatIds((prev) => {
      const n = new Set(prev);
      if (wasLiked) n.delete(catId);
      else n.add(catId);
      return n;
    });
    setSelectedCat((prev) => prev && prev.id === catId ? { ...prev, like_count: Math.max(0, currentCount + (wasLiked ? -1 : 1)) } : prev);
    setCats((prev) => prev.map((c) => c.id === catId ? { ...c, like_count: Math.max(0, (c.like_count ?? 0) + (wasLiked ? -1 : 1)) } : c));

    try {
      const { liked, likeCount } = await toggleCatLike(catId);
      // 서버 실제 값으로 동기화
      setSelectedCat((prev) => prev && prev.id === catId ? { ...prev, like_count: likeCount } : prev);
      setCats((prev) => prev.map((c) => c.id === catId ? { ...c, like_count: likeCount } : c));
      setLikedCatIds((prev) => {
        const n = new Set(prev);
        if (liked) n.add(catId);
        else n.delete(catId);
        return n;
      });
    } catch (err) {
      // 롤백
      setLikedCatIds((prev) => {
        const n = new Set(prev);
        if (wasLiked) n.add(catId);
        else n.delete(catId);
        return n;
      });
      setSelectedCat((prev) => prev && prev.id === catId ? { ...prev, like_count: currentCount } : prev);
      setCats((prev) => prev.map((c) => c.id === catId ? { ...c, like_count: currentCount } : c));
      toast.error(err instanceof Error ? err.message : "좋아요 실패");
    } finally {
      setLikingCat(false);
    }
  };

  // ── 고양이 공유 (Web Share API → 링크 복사 폴백) ──
  const handleShareCat = async () => {
    if (!selectedCat) return;
    const url = `${window.location.origin}/cats/${selectedCat.id}`;
    const title = `${selectedCat.name} · ${selectedCat.region ?? "우리 동네"} | 도시공존`;
    const text = selectedCat.description
      ? selectedCat.description
      : `${selectedCat.region ?? "우리 동네"}에 사는 ${selectedCat.name}을(를) 함께 돌봐주세요 🐾`;

    const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;

    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url });
      } catch {
        // 사용자가 공유 취소 → 조용히 무시
      }
      return;
    }

    // 폴백: 링크 복사
    try {
      await nav?.clipboard?.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      window.prompt("아래 링크를 복사해서 공유하세요:", url);
    }
  };

  // ── 카카오톡으로 고양이 공유 ──
  const handleShareCatToKakao = async () => {
    if (!selectedCat) return;
    const url = `${window.location.origin}/cats/${selectedCat.id}`;
    const title = `${selectedCat.name} · ${selectedCat.region ?? "우리 동네"}`;
    const description = selectedCat.description
      ? selectedCat.description.slice(0, 100)
      : `${selectedCat.region ?? "우리 동네"}에 사는 ${selectedCat.name}을(를) 함께 돌봐주세요 🐾`;
    const imageUrl = `${window.location.origin}/cats/${selectedCat.id}/opengraph-image`;

    const ok = await shareToKakao({ title, description, imageUrl, url });
    if (!ok) {
      // Kakao SDK 실패 → 링크 복사 폴백
      try {
        await navigator.clipboard?.writeText(url);
        setShareStatus("copied");
        setTimeout(() => setShareStatus("idle"), 2000);
      } catch {
        window.prompt("아래 링크를 복사해서 공유하세요:", url);
      }
    }
  };

  // ── 카카오 SDK 직접 로드 ──
  useEffect(() => {
    if (!apiKey) return;

    // 이미 로드 완료
    if (window.kakao?.maps) {
      setScriptLoaded(true);
      return;
    }

    // SDK 로드 대기 (폴링 + 타임아웃)
    const waitForSdk = () => {
      const check = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(check);
          setScriptLoaded(true);
        }
      }, 100);
      // 15초 안에 안 되면 에러 표시
      setTimeout(() => {
        clearInterval(check);
        if (!window.kakao?.maps) {
          setMapError("지도 로드가 너무 오래 걸려요. 페이지를 새로고침해주세요.");
        }
      }, 15000);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="true"]'
    );
    if (existing) {
      waitForSdk();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => waitForSdk();
    script.onerror = () =>
      setMapError("지도를 불러올 수 없어요. 네트워크를 확인해주세요.");
    document.head.appendChild(script);
  }, [apiKey]);

  // ── 실시간 GPS 추적 (거부해도 기본 중심으로 폴백) ──
  // LBS 신고 전 측위 차단 — lib/geo.ts 참조.
  // watchPosition으로 유저가 움직이면 내 위치 마커도 따라 움직인다(2026-07-27).
  useEffect(() => {
    if (!GEOLOCATION_ENABLED) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        userPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        applyUserPosRef.current?.();
      },
      () => {
        // geolocation 거부·실패 시 기본 중심 좌표 사용 (조용히)
      },
      // maximumAge 짧게 — 이동 중 신선한 좌표로 마커가 부드럽게 따라오게
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 3_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── SDK 준비되면 지도 초기화 ──
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return;
    if (!window.kakao || !window.kakao.maps) {
      setMapError("Kakao Maps SDK를 불러오지 못했어요.");
      return;
    }

    window.kakao.maps.load(() => {
      const container = mapContainerRef.current;
      if (!container) return;

      // 초기 중심: GPS > 주 활동 지역 > 기본 중심
      const primary = activityRegions.find((r) => r.is_primary) ?? activityRegions[0];
      const initialCenter = userPosRef.current ?? (primary ? { lat: primary.lat, lng: primary.lng } : MAP_CENTER);
      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: 6,
      });
      mapInstanceRef.current = map;

      // 지도 길게 누르기 → 좌표 추출 → 등록 모달 열기
      // (kakao.maps에는 longpress 이벤트가 없어서 클릭으로 대체)
      window.kakao.maps.event.addListener<KakaoMapMouseEvent>(map, "rightclick", (e) => {
        const latlng = e.latLng;
        setPickedCoord({ lat: latlng.getLat(), lng: latlng.getLng() });
        setVisibilityIntroOpen(true);
      });

      // 지도 이동/줌 끝날 때 현재 구 감지 (시·도 + 구 조합으로 유니크하게)
      const detectGu = () => {
        if (!window.kakao?.maps?.services) return;
        const center = map.getCenter();
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result[0]) {
            const sido = (result[0].region_1depth_name || "")
              .replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
            const gu = result[0].region_2depth_name || "";
            // 예: "인천 남동구", "서울 중구", "부산 중구" → 같은 '중구'라도 다르게 구분
            const area = [sido, gu].filter(Boolean).join(" ");
            setCurrentGu(area);
          }
        });
      };
      window.kakao.maps.event.addListener(map, "idle", detectGu);
      // 초기 감지
      setTimeout(detectGu, 1000);

      setMapReady(true);
    });
    // userPos는 초기 중심 계산에만 쓰이고, GPS가 뒤늦게 오는 경우는 아래 effect가 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  // ?cat=xxx 쿼리로 특정 고양이에 포커스 (고양이 상세 → 지도에서 돌봄하기)
  const catFocusHandledRef = useRef(false);
  useEffect(() => {
    if (catFocusHandledRef.current) return;
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    if (cats.length === 0) return;

    const url = new URL(window.location.href);
    const catId = url.searchParams.get("cat");
    if (!catId) return;

    const cat = cats.find((c) => c.id === catId);
    if (!cat) return;

    catFocusHandledRef.current = true;

    const coord = roamCoord(cat, isLoggedIn);
    const map = mapInstanceRef.current;
    map.setCenter(new window.kakao.maps.LatLng(coord.lat, coord.lng));
    map.setLevel(3);
    setSelectedCat(cat);
    setCatCardTab("carelog");

    // 쿼리 제거 — 다음 렌더에서 재실행 방지 + 뒤로가기 깔끔
    url.searchParams.delete("cat");
    window.history.replaceState({}, "", url.toString());
  }, [mapReady, cats, isLoggedIn]);

  // ── /map?add=1 딥링크 — 진입 시 등록 플로우 자동 오픈 ──
  // 홈/온보딩의 '첫 고양이 등록' CTA가 지도에서 + 버튼을 찾게 하지 않고 바로 등록으로 잇는다.
  const addFlowHandledRef = useRef(false);
  useEffect(() => {
    if (addFlowHandledRef.current) return;
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") !== "1") return;
    addFlowHandledRef.current = true;
    url.searchParams.delete("add");
    window.history.replaceState({}, "", url.toString());
    if (!isLoggedIn) return; // 비로그인은 조용히 무시
    const center = mapInstanceRef.current.getCenter();
    setPickedCoord({ lat: center.getLat(), lng: center.getLng() });
    setVisibilityIntroOpen(true);
  }, [mapReady, isLoggedIn]);

  // ── GPS 좌표 반영 (리렌더 없는 명령형 경로) ──
  // 첫 픽스 1회만 중심 이동 (cat 포커스 중이면 스킵) — 매 업데이트마다 중심을 옮기면
  // 지도가 계속 튕겨 사용자가 지도를 못 움직인다. 이후 재중심은 "내 위치" 버튼으로.
  // 내 위치 마커(사람 캐릭터 + 펄스 링)는 있으면 위치만 갱신, 없을 때만 생성.
  // 캐릭터는 고양이귀 후드를 쓴 치비 사람 (lib/cat-art.ts personMarkerSvg, 테라코타 테마).
  const userCenteredOnceRef = useRef(false);
  const userLocationOverlayRef = useRef<KakaoOverlay | null>(null);
  const applyUserPos = () => {
    const p = userPosRef.current;
    const map = mapInstanceRef.current;
    if (!p || !map || !window.kakao?.maps) return;
    const pos = new window.kakao.maps.LatLng(p.lat, p.lng);

    if (!userCenteredOnceRef.current && !catFocusHandledRef.current) {
      userCenteredOnceRef.current = true;
      map.setCenter(pos);
    }

    // 이미 마커가 있으면 위치만 이동 (이동 중 깜빡임/애니메이션 리셋 방지)
    if (userLocationOverlayRef.current) {
      userLocationOverlayRef.current.setPosition(pos);
      return;
    }

    // 한 번만 펄스 keyframes 주입
    if (!document.getElementById("__user_location_pulse_css")) {
      const style = document.createElement("style");
      style.id = "__user_location_pulse_css";
      style.textContent = `
        @keyframes dosi-user-pulse {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0;   }
        }
      `;
      document.head.appendChild(style);
    }

    const el = document.createElement("div");
    el.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";
    // 사람 캐릭터 (2026-08-04 사용자 요청 — 냥줍 집사 아바타 이식, 테라코타 후드).
    // 발이 좌표 근처에 오도록 세로로 살짝 올려 앵커링. 몸통 숨쉬기는 .me-marker CSS.
    el.innerHTML = `
      <div class="me-marker" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-58%);z-index:2;
        display:flex;filter:drop-shadow(0 3px 5px rgba(44,44,44,0.35));">
        ${personMarkerSvg(46)}
      </div>
      <div style="
        position:absolute;left:50%;top:50%;
        width:44px;height:44px;border-radius:50%;
        background:rgba(173,94,59,0.28);
        animation:dosi-user-pulse 1.8s ease-out infinite;
        z-index:1;
      "></div>
    `;

    const ov = new window.kakao.maps.CustomOverlay({
      map,
      position: pos,
      content: el,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 100,
    });
    userLocationOverlayRef.current = ov;
  };
  // 렌더마다 최신 클로저로 교체 — watchPosition([] deps)이 항상 최신 함수를 부르게.
  applyUserPosRef.current = applyUserPos;

  // GPS 픽스가 지도 준비보다 먼저 도착한 경우 — 지도 준비 시 1회 반영
  useEffect(() => {
    if (mapReady) applyUserPosRef.current?.();
  }, [mapReady]);

  // 언마운트 시에만 내 위치 마커 제거 (실시간 갱신 중엔 유지)
  useEffect(() => {
    return () => {
      if (userLocationOverlayRef.current) {
        userLocationOverlayRef.current.setMap(null);
        userLocationOverlayRef.current = null;
      }
    };
  }, []);

  // ── 활동 지역 Circle 오버레이 ──
  useEffect(() => {
    if (!mapReady || !window.kakao) return;
    regionCirclesRef.current.forEach((ov) => ov.setMap(null));
    regionCirclesRef.current = [];

    if (activityRegions.length === 0) return;

    activityRegions.forEach((r) => {
      const color = r.slot === 1 ? "#AD5E3B" : "#4A7BA8";
      const active = regionFilter === "all" || regionFilter === r.slot;
      const circle = new window.kakao.maps.Circle({
        map: mapInstanceRef.current,
        center: new window.kakao.maps.LatLng(r.lat, r.lng),
        radius: r.radius_m,
        strokeWeight: active ? 2 : 1,
        strokeColor: color,
        strokeOpacity: active ? 0.8 : 0.3,
        strokeStyle: active ? "solid" : "dashed",
        fillColor: color,
        fillOpacity: active ? 0.08 : 0.02,
      });
      regionCirclesRef.current.push(circle);

      // 지역 이름 라벨 — 이름은 유저 자유입력이라 textContent로만 주입 (XSS 차단)
      const labelEl = document.createElement("div");
      const labelInner = document.createElement("div");
      labelInner.style.cssText = `transform:translate(-50%,-50%);padding:3px 10px;border-radius:12px;background:${color}dd;color:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 6px ${color}66;white-space:nowrap;opacity:${active ? 1 : 0.5};`;
      labelInner.textContent = `📍 ${r.name}`;
      labelEl.appendChild(labelInner);
      const label = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: new window.kakao.maps.LatLng(r.lat, r.lng),
        content: labelEl,
        zIndex: 8,
      });
      regionCirclesRef.current.push(label);
    });
  }, [mapReady, activityRegions, regionFilter]);

  const [isAdmin, setIsAdmin] = useState(false);

  // 배회 행동 상태 칩 갱신용 틱 (30초 — 상태는 분 단위로 바뀌므로 충분)
  const [roamTick, setRoamTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setRoamTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── 쓰다듬기 (pet) — 하트 팡 + 원형사진 흔들림 + 골골송 + 누적 카운터. 연타는 배치로 flush ──
  const [petCount, setPetCount] = useState(0);
  const [petHearts, setPetHearts] = useState<{ id: number; dx: number; r: number; ch: string }[]>([]);
  const [petPop, setPetPop] = useState(false);
  const pendingPetsRef = useRef(0);
  const petFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petHeartSeq = useRef(0);
  const petPhotoRef = useRef<HTMLDivElement | null>(null);
  const lastPurrAtRef = useRef(0);
  // 선택 고양이 바뀌면 카운터 동기화 + 남은 대기분 flush
  useEffect(() => {
    setPetCount(selectedCat?.pet_count ?? 0);
  }, [selectedCat?.id, selectedCat?.pet_count]);

  const doPet = useCallback(() => {
    if (!selectedCat) return;
    if (!isLoggedIn) {
      if (confirm("로그인하면 아이를 쓰다듬을 수 있어요. 로그인할까요?")) window.location.href = "/login";
      return;
    }
    // 낙관적 UI — 즉시 하트 + 카운트
    const CH = ["💕", "💛", "🐾", "✨", "😻"];
    const heart = { id: ++petHeartSeq.current, dx: Math.round((Math.random() - 0.5) * 44), r: Math.round((Math.random() - 0.5) * 40), ch: CH[Math.floor(Math.random() * CH.length)] };
    setPetHearts((prev) => [...prev.slice(-14), heart]);
    setPetCount((c) => c + 1);
    setPetPop(true);
    setTimeout(() => setPetPop(false), 280);
    setTimeout(() => setPetHearts((prev) => prev.filter((h) => h.id !== heart.id)), 1000);
    try { navigator.vibrate?.(8); } catch { /* 미지원 */ }
    // 원형 사진 흔들림 — 연타 시에도 처음부터 재생되도록 리플로우로 애니메이션 리셋
    const ph = petPhotoRef.current;
    if (ph) {
      ph.classList.remove("pet-wiggle");
      void ph.offsetWidth;
      ph.classList.add("pet-wiggle");
    }
    // 골골송 — 다마고치와 같은 합성음(파일 없음). 연타는 0.9초에 1번만 울려 소리 겹침 방지.
    if (Date.now() - lastPurrAtRef.current > 900) {
      lastPurrAtRef.current = Date.now();
      try { primeSfx(); sfx.purr({ duration: 0.9 }); } catch { /* 오디오 미지원 */ }
    }
    // 배치 flush (연타 모아 1회 RPC)
    pendingPetsRef.current += 1;
    const catId = selectedCat.id;
    if (petFlushTimerRef.current) clearTimeout(petFlushTimerRef.current);
    petFlushTimerRef.current = setTimeout(() => {
      const n = pendingPetsRef.current;
      pendingPetsRef.current = 0;
      if (n > 0) petCat(catId, n).catch(() => {});
    }, 700);
  }, [selectedCat, isLoggedIn]);

  // 관리자 여부 — 로그인 상태 변화에 반응해서 재확인.
  // (기존: 첫 페인트 직후 idle에서 1회만 체크 → 세션 복원이 늦으면 false로 영구 고정돼
  //  관리자 수정/삭제 버튼이 안 뜨는 케이스가 있었음)
  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    isCurrentUserAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [user?.id]);

  // ── 고양이 수정 모드 ──
  const [editingCat, setEditingCat] = useState(false);
  // 고양이별로 보내기 모달 (무지개다리 → 삭제 대신 추모 보관)
  const [starCat, setStarCat] = useState<{ id: string; name: string; photo_url: string | null } | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  // 위치 식별 + 어뷰징 실시간 검출
  const editDescViolations = useMemo(() => findLocationViolations(editDesc), [editDesc]);
  const editDescAbuseViolations = useMemo(() => findAbuseViolations(editDesc), [editDesc]);
  const [editRegion, setEditRegion] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editGender, setEditGender] = useState<CatGender>("unknown");
  const [editNeutered, setEditNeutered] = useState<boolean | null>(null);
  const [editHealth, setEditHealth] = useState<CatHealthStatus>("good");
  const [editAdoption, setEditAdoption] = useState<AdoptionStatus>(null);
  const [editVisibility, setEditVisibility] = useState<CatVisibility>("public");
  const [editSaving, setEditSaving] = useState(false);
  // 위치 변경 (편집 모드에서 지도 picker로 갱신)
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);

  // ── 동(region) 선택 시 해당 동 고양이 목록 ──
  const [selectedDong, setSelectedDong] = useState<string | null>(null);
  const selectedDongCats = selectedDong
    ? cats.filter((c) => c.region === selectedDong)
    : [];

  // ── cats를 동 단위로 그룹화 → 클러스터 마커 (뷰포트 기반) ──
  const catIdleListenerRef = useRef<(() => void) | null>(null);
  // 검색으로 찾은 고양이가 현재 뷰포트 밖에 있으면 필터링만 되고 아무것도
  // 안 보여서 "등록했는데 안 보인다"는 문의로 이어졌음 — 검색어가 바뀔 때마다
  // 매칭된 고양이들이 전부 보이도록 지도를 자동으로 이동/줌아웃한다.
  const lastPannedSearchRef = useRef<string>("");
  useEffect(() => {
    // 기존 마커/리스너 정리
    overlaysRef.current.forEach((ov) => ov.setMap(null));
    overlaysRef.current = [];
    if (catIdleListenerRef.current && mapInstanceRef.current && window.kakao) {
      window.kakao.maps.event.removeListener(mapInstanceRef.current, "idle", catIdleListenerRef.current);
      catIdleListenerRef.current = null;
    }

    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    if (!showCats) return;

    const map = mapInstanceRef.current;
    const MAX_CAT_OVERLAYS = 80; // DOM 폭주 방지

    // 검색어 + 속성 필터 적용 (뷰포트 무관 — 한 번만 계산)
    const q = searchQDebounced.trim().toLowerCase();
    const filtered = cats.filter((c) => {
      if (q) {
        const hay = [
          c.name,
          c.region ?? "",
          c.description ?? "",
          ...(c.tags ?? []),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (catFilter) {
        case "tnr_needed":
          return (c.tags ?? []).some((t) => t.includes("TNR 필요"));
        case "neutered":
          return c.neutered === true || (c.tags ?? []).some((t) => t.includes("TNR 완료"));
        case "health_concern":
          return c.health_status === "caution" || c.health_status === "danger";
        case "alert":
          return alertedCats.has(c.id);
        default:
          return true;
      }
    });

    // 검색어가 바뀌었고 매칭 결과가 있으면, 그 결과들이 전부 보이도록 지도 이동/줌아웃.
    // (뷰포트 밖에 있으면 필터만 되고 마커가 하나도 안 그려져서 "안 보인다"는 문의로 이어짐)
    if (q && q !== lastPannedSearchRef.current && filtered.length > 0) {
      lastPannedSearchRef.current = q;
      const bounds = new window.kakao.maps.LatLngBounds();
      filtered.forEach((c) => {
        const coord = roamCoord(c, isLoggedIn);
        bounds.extend(new window.kakao.maps.LatLng(coord.lat, coord.lng));
      });
      map.setBounds(bounds, 80, 80, 80, 80);
    } else if (!q) {
      lastPannedSearchRef.current = "";
    }

    // region(동)별 그룹핑 — 한 번만 (뷰포트 변해도 재그룹 불필요)
    const groups = new Map<string, Cat[]>();
    filtered.forEach((cat) => {
      const dong = cat.region || "기타";
      if (!groups.has(dong)) groups.set(dong, []);
      groups.get(dong)!.push(cat);
    });

    const geocoder = window.kakao.maps?.services
      ? new window.kakao.maps.services.Geocoder()
      : null;

    // 줌 티어 결정 (Kakao: 작은 숫자 = 가까운 줌)
    // tier=1: 작은 dot + count (광역 뷰)
    // tier=2: 사진 1장 + count (중간 뷰)
    // tier=3: 풀 마커 (사진 3 + dong + count) (동네 뷰)
    function getTier(level: number): 1 | 2 | 3 {
      if (level >= 9) return 1;
      if (level >= 6) return 2;
      return 3;
    }

    // 뷰포트 내 그룹만 렌더하는 함수 (idle마다 호출)
    function renderVisibleCats() {
      // 기존 마커 제거
      overlaysRef.current.forEach((ov) => ov.setMap(null));
      overlaysRef.current = [];

      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const minLat = sw.getLat();
      const maxLat = ne.getLat();
      const minLng = sw.getLng();
      const maxLng = ne.getLng();

      // 비로그인 시 사진·동 이름 노출 차단 — tier 1(도트 + 카운트)으로 강제.
      // 로그인 유저는 줌 레벨 기반 정상 tier.
      const tier = isLoggedIn ? getTier(map.getLevel()) : 1;
      // 광역 뷰는 마커 한도를 더 늘려도 되고(가벼우니), 가까운 뷰는 줄임
      const maxOverlays = tier === 1 ? 200 : tier === 2 ? 120 : 80;

      // 뷰포트 안의 그룹만 필터 (대표 좌표 기준)
      const visibleGroups: Array<[string, Cat[]]> = [];
      groups.forEach((dongCats, dong) => {
        const repCat = dongCats[0];
        const coord = roamCoord(repCat, isLoggedIn);
        if (
          coord.lat >= minLat &&
          coord.lat <= maxLat &&
          coord.lng >= minLng &&
          coord.lng <= maxLng
        ) {
          visibleGroups.push([dong, dongCats]);
        }
      });

      // 너무 많으면 우선순위 (학대경보 > 마릿수) 후 상한
      visibleGroups.sort((a, b) => {
        const aAlert = a[1].some((c) => alertedCats.has(c.id)) ? 1 : 0;
        const bAlert = b[1].some((c) => alertedCats.has(c.id)) ? 1 : 0;
        if (aAlert !== bAlert) return bAlert - aAlert;
        return b[1].length - a[1].length;
      });
      const toRender = visibleGroups.slice(0, maxOverlays);

      toRender.forEach(([dong, dongCats]) => {
        renderGroup(dong, dongCats, tier);
      });
    }

    // 실물 사진 뱃지 — 전신 캐릭터 옆에 붙는 원형 사진 (2026-08-04 사용자 요청, 26→40px 확대).
    // pos는 "top:...;left:...;" 형태의 위치 스타일. 사진 없거나 URL 비정상이면 생략.
    function photoBadge(cat: Cat, pos: string): string {
      const safe = cat.photo_url ? sanitizeImageUrl(cat.photo_url, "") : "";
      if (!safe) return "";
      return `<div style="position:absolute;${pos}width:40px;height:40px;border-radius:50%;border:2.5px solid #fff;background-image:url('${safe}');background-size:cover;background-position:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:4;"></div>`;
    }

    // 고양이 귀 — 원형 마커를 고양이 머리 실루엣으로 (2026-08-02 사용자 요청).
    // 원 뒤(z-index:0)에 삼각형 귀 2개를 세움. 마커 원은 wrapper 안에서 z-index:1 필요.
    function catEars(size: number, color: string): string {
      const w = Math.round(size * 0.4);
      const h = Math.round(size * 0.38);
      const top = -Math.round(h * 0.52);
      const inset = Math.max(1, Math.round(size * 0.02));
      // 30px 이상 큰 마커는 안쪽 귀 명암까지 (흰 귀는 어두운 명암, 색 귀는 밝은 명암)
      const inner = size >= 30
        ? `<div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:54%;height:58%;background:${color === "#fff" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.38)"};clip-path:polygon(50% 0%,0% 100%,100% 100%);"></div>`
        : "";
      const ear = (deg: number, pos: string) =>
        `<div style="position:absolute;top:${top}px;${pos};width:${w}px;height:${h}px;background:${color};clip-path:polygon(50% 0%,0% 100%,100% 100%);transform:rotate(${deg}deg);z-index:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.18));">${inner}</div>`;
      return ear(-18, `left:${inset}px`) + ear(18, `right:${inset}px`);
    }

    function renderGroup(dong: string, dongCats: Cat[], tier: 1 | 2 | 3) {
      if (dong === "기타" || !geocoder) {
        // region이 없는 고양이는 원래 좌표 사용 (개별 마커)
        dongCats.forEach((cat) => {
          const coord = roamCoord(cat, isLoggedIn);
          const pos = new window.kakao.maps.LatLng(coord.lat, coord.lng);
          // 마커 색은 파랑으로 통일 (2026-07-13 사용자 요청). 학대경보는 별도 ⚠️ 배지로 표시.
          const borderColor = "#AD5E3B";

          const el = document.createElement("div");
          // tier 1·2: 작은 dot, tier 3: 사진 마커
          if (tier <= 2) {
            el.innerHTML = floatWrap(`
              <div class="cat-press" style="transform:translate(-50%,-50%);--mk-tr:translate(-50%,-50%);position:relative;width:18px;height:18px;cursor:pointer;">
                ${catEars(18, borderColor)}
                <div style="position:relative;z-index:1;width:18px;height:18px;border-radius:50%;background:${borderColor};border:2px solid #fff;box-shadow:0 2px 6px ${borderColor}66;"></div>
              </div>
            `, cat.id);
          } else {
            // 전신 걷는 고양이 아트 (2026-08-04 냥줍 이식 — 원형 사진 마커 대체·축소)
            // art_key(AI 사진 판독 팔레트)가 있으면 실제 털색 반영, 없으면 id 해시 폴백.
            // 캐릭터 옆에 실물 사진 뱃지 (2026-08-04 사용자 요청).
            el.innerHTML = floatWrap(`
              <div class="cat-press" style="transform:translate(-50%,-100%);--mk-tr:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;">
                ${photoBadge(cat, "top:-16px;left:-34px;")}
                <div class="cat-walk-flip" style="display:flex;transform:scaleX(1);transition:transform 0.25s ease;filter:drop-shadow(0 2px 3px rgba(44,30,20,0.32));">
                  ${catArtWalkSvg(cat.art_key ?? cat.id, 54, { colors: cat.art_colors })}
                </div>
                <span class="roam-state" style="position:absolute;top:-10px;right:-8px;font-size:16px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">${catRoamMode(cat.id).emoji}</span>
                ${emoteSpan(cat.id, emoteForCat(cat.id))}
                <div style="width:32px;height:5px;border-radius:50%;background:rgba(40,30,20,0.18);margin-top:-3px;"></div>
              </div>
            `, cat.id);
          }
          el.onclick = () => {
            // 비로그인은 로그인 강요 대신 고양이 상세로 — "지도가 곧 온보딩" pick 동선
            // (2026-08-04: confirm→/login 게이트가 온보딩 pick 지점을 도달 불가로 만들어
            //  onboarding_pick 0건이던 퍼널 단절 수리. 상세는 비로그인 열람 설계 + 가입 CTA 보유)
            if (!isLoggedIn) { window.location.href = `/cats/${cat.id}`; return; }
            setSelectedCat(cat); setCatCardTab("carelog");
          };
          attachPressFx(el);
          const ov: RoamOverlay = new window.kakao.maps.CustomOverlay({ map: mapInstanceRef.current, position: pos, content: el, yAnchor: 1, zIndex: 10 });
          ov.__roamCat = cat; // 배회 애니메이션 기준
          ov.__stateEl = el.querySelector<HTMLElement>(".roam-state"); // 행동 상태 뱃지
          ov.__emoteEl = el.querySelector<HTMLElement>(".cat-emote"); // 기분 이모지
          ov.__flipEl = el.querySelector<HTMLElement>(".cat-walk-flip"); // 이동 방향 반전
          overlaysRef.current.push(ov);
        });
        return;
      }

      // 동 이름으로 중심 좌표 얻기
      const hasAlert = dongCats.some((c) => alertedCats.has(c.id));
      // 마커 색은 파랑으로 통일 (2026-07-13 사용자 요청). 학대경보는 별도 ⚠️ 배지로 표시.
      const clusterColor = "#AD5E3B";
      const count = dongCats.length;

      // 첫 번째 고양이의 좌표를 동 대표 좌표로 사용 (Geocoder보다 빠르고 정확)
      const repCat = dongCats[0];
      const repCoord = roamCoord(repCat, isLoggedIn);
      const pos = new window.kakao.maps.LatLng(repCoord.lat, repCoord.lng);

      // tier 별 분기 — 사진 로드 절감
      if (tier === 1) {
        // 광역 뷰: 작은 dot + 카운트만 (사진 0)
        const el = document.createElement("div");
        el.innerHTML = floatWrap(`
          <div class="cat-press" style="transform:translate(-50%,-50%);--mk-tr:translate(-50%,-50%);position:relative;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <div style="position:relative;width:24px;height:24px;">
              ${catEars(24, clusterColor)}
              <div style="position:relative;z-index:1;width:24px;height:24px;border-radius:50%;background:${clusterColor};border:2.5px solid #fff;box-shadow:0 2px 7px ${clusterColor}66;"></div>
            </div>
            ${count > 1 ? `<span style="background:${clusterColor};color:#fff;padding:2px 7px;border-radius:9px;font-size:11px;font-weight:800;box-shadow:0 1px 4px ${clusterColor}66;">${count}</span>` : ""}
          </div>
        `, repCat.id);
        el.onclick = () => {
          // 비로그인 → 대표 고양이 상세로 직행 (pick 지점).
          // 이전엔 "확대해서 개별 마커로 풀어준다"였는데, 비로그인은 tier가 1로 고정돼
          // (위 getTier 분기) 아무리 확대해도 다시 이 클러스터가 나오는 막다른 길이었다.
          // 그래서 onboarding_pick이 14일간 0건이었다. 상세는 비로그인 열람 설계 +
          // 가입 CTA 보유이므로 여기서 바로 잇는다. (2026-08-04)
          if (!isLoggedIn) { window.location.href = `/cats/${repCat.id}`; return; }
          setSelectedDong(dong);
          setSelectedCat(null);
        };
        attachPressFx(el);
        const ov: RoamOverlay = new window.kakao.maps.CustomOverlay({
          map: mapInstanceRef.current, position: pos, content: el, yAnchor: 0.5, zIndex: 10,
        });
        ov.__roamCat = repCat; // 배회 애니메이션 기준
        overlaysRef.current.push(ov);
        return;
      }

      // tier 2·3 — 전신 걷는 고양이 아트 (2는 1마리, 3은 3마리. 2026-08-04 사진 원형 대체·축소)
      const artLimit = tier === 2 ? 1 : 3;
      const artCats = dongCats.slice(0, artLimit);

      const el = document.createElement("div");
      el.innerHTML = floatWrap(`
        <div class="cat-press" style="transform:translate(-50%,-100%);--mk-tr:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;">
          ${hasAlert ? `<div style="position:relative;z-index:5;background:linear-gradient(135deg,#D85555,#B84545);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(216,85,85,0.5);margin-bottom:12px;animation:alert-pulse 1.6s ease-in-out infinite;">⚠️ 학대경보</div>` : ""}
          <div style="display:flex;align-items:flex-end;position:relative;">
            ${photoBadge(repCat, "top:-24px;left:-30px;")}
            ${artCats.map((c, i) => {
              const w = i === 0 ? 56 : 40;
              return `
              <div class="${i === 0 ? "cat-walk-flip" : ""}" style="display:flex;margin-left:${i > 0 ? "-12px" : "0"};z-index:${3 - i};transform:scaleX(1);transition:transform 0.25s ease;filter:drop-shadow(0 2px 3px rgba(44,30,20,0.3));">
                ${catArtWalkSvg(c.art_key ?? c.id, w, { colors: c.art_colors })}
              </div>`;
            }).join("")}
            <span class="roam-state" style="position:absolute;top:-12px;left:44px;font-size:16px;z-index:4;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">${catRoamMode(repCat.id).emoji}</span>
            ${emoteSpan(repCat.id, emoteForCat(repCat.id))}
          </div>
          <div style="margin-top:4px;padding:3px 12px;border-radius:12px;background:${clusterColor}ee;color:#fff;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px ${clusterColor}44;display:flex;align-items:center;gap:4px;">
            <span>🐾</span>
            <span>${escapeHtml(dong)}</span>
            <span style="background:rgba(255,255,255,0.3);padding:1px 6px;border-radius:8px;font-size:10px;">${count}</span>
          </div>
          <div style="width:10px;height:10px;background:${clusterColor};transform:rotate(45deg);margin-top:-7px;"></div>
        </div>
      `, repCat.id);
      el.onclick = () => {
        // 비로그인 → 대표 고양이 상세로 직행 (위 tier 1 분기와 동일한 이유).
        // 현재 비로그인은 tier 1 고정이라 이 경로에 도달하지 않지만, tier 정책이
        // 바뀌어도 pick 동선이 다시 끊기지 않도록 같이 맞춰 둔다.
        if (!isLoggedIn) { window.location.href = `/cats/${repCat.id}`; return; }
        setSelectedDong(dong);
        setSelectedCat(null);
      };
      attachPressFx(el);

      const ov = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: pos,
        content: el,
        yAnchor: 1,
        zIndex: 10,
      });
      const roamOv = ov as RoamOverlay;
      roamOv.__roamCat = repCat; // 배회 애니메이션 기준
      roamOv.__stateEl = el.querySelector<HTMLElement>(".roam-state"); // 행동 상태 뱃지
      roamOv.__emoteEl = el.querySelector<HTMLElement>(".cat-emote"); // 기분 이모지
      roamOv.__flipEl = el.querySelector<HTMLElement>(".cat-walk-flip"); // 이동 방향 반전
      overlaysRef.current.push(roamOv);
    }

    // 초기 렌더 + idle 리스너 (200ms 디바운스 — panning 중 중복 호출 절감)
    renderVisibleCats();
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const debouncedRender = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        debounceId = null;
        renderVisibleCats();
      }, 200);
    };
    catIdleListenerRef.current = debouncedRender;
    window.kakao.maps.event.addListener(map, "idle", debouncedRender);

    return () => {
      if (debounceId) clearTimeout(debounceId);
      if (catIdleListenerRef.current && map && window.kakao) {
        window.kakao.maps.event.removeListener(map, "idle", catIdleListenerRef.current);
      }
    };
    // activityRegions·regionFilter는 이 이펙트 본문에서 미사용 — 활동지역 오버레이는
    // 별도 이펙트(1128행대)가 담당한다. 여기 남겨두면 지역 로드/필터 토글마다
    // 마커 80~200개가 통째로 재생성되는 불필요 비용이 든다.
  }, [cats, mapReady, isLoggedIn, alertedCats, showCats, searchQDebounced, catFilter]);

  // ── 돌봄 기록 반응 연출 — 기록하면 그 고양이 마커가 아지트로 달려와 밥을 먹음 ──
  // run(2.5s 달려옴) → eat(60s 🍚) → return(2s 배회 위치로 복귀)
  const careFxRef = useRef<Map<string, { phase: "run" | "eat" | "return"; t0: number; from: { lat: number; lng: number } }>>(new Map());
  useEffect(() => {
    const onCare = (e: Event) => {
      const catId = (e as CustomEvent).detail?.cat_id as string | undefined;
      if (!catId) return;
      const cat = cats.find((c) => c.id === catId);
      if (!cat) return;
      careFxRef.current.set(catId, { phase: "run", t0: Date.now(), from: roamCoord(cat, isLoggedIn) });
    };
    window.addEventListener("cat-care-logged", onCare);
    return () => window.removeEventListener("cat-care-logged", onCare);
  }, [cats, isLoggedIn]);

  // ── 고양이 마커 배회 애니메이션 (위치 보호 2차 레이어) ──
  // roamCoord가 Date.now() 기반 결정적이라, 주기적으로 현재 시각 위치로 옮기기만 하면 됨.
  // 200ms 간격이면 이동폭이 틱당 수 m라 부드럽게 보임 (마커 최대 200개 × 5회/초 — 미미한 비용).
  useEffect(() => {
    if (!mapReady) return;
    const lerp = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, p: number) => ({
      lat: a.lat + (b.lat - a.lat) * p,
      lng: a.lng + (b.lng - a.lng) * p,
    });
    const id = setInterval(() => {
      if (!window.kakao || !mapInstanceRef.current || document.hidden) return;
      // 화면상 반 픽셀 미만 이동은 setPosition 스킵 — 줌아웃(마커 최대 200개)일수록
      // 배회 진폭이 픽셀 이하로 뭉개져 대부분의 DOM 쓰기·LatLng 할당이 사라진다.
      // 카카오 지도는 level이 1 오를 때마다 축척이 2배 — 대략 level 6 ≈ 3m/반픽셀.
      const level = mapInstanceRef.current.getLevel();
      const minDeltaDeg = (0.05 * Math.pow(2, level)) / 111111;
      overlaysRef.current.forEach((ov) => {
        const roamCat = ov.__roamCat;
        if (!roamCat) return;
        let coord = roamCoord(roamCat, isLoggedIn);
        let emojiOverride: string | null = null;

        // 돌봄 연출 진행 중이면 배회 대신 연출 좌표
        const fx = careFxRef.current.get(roamCat.id);
        if (fx) {
          const base = getDisplayCoord(roamCat, isLoggedIn);
          const elapsed = Date.now() - fx.t0;
          if (fx.phase === "run") {
            const p = Math.min(1, elapsed / 2500);
            coord = lerp(fx.from, base, 1 - Math.pow(1 - p, 3)); // ease-out
            emojiOverride = "💨";
            if (p >= 1) { fx.phase = "eat"; fx.t0 = Date.now(); }
          } else if (fx.phase === "eat") {
            coord = base;
            emojiOverride = "🍚";
            if (elapsed > 60000) { fx.phase = "return"; fx.t0 = Date.now(); fx.from = base; }
          } else {
            const p = Math.min(1, elapsed / 2000);
            coord = lerp(fx.from, roamCoord(roamCat, isLoggedIn), p);
            if (p >= 1) careFxRef.current.delete(roamCat.id);
          }
        }

        // 미세이동 스킵 — 연출(fx) 중에는 항상 반영 (달려가기/복귀가 끊기면 안 됨)
        const moved =
          fx != null ||
          ov.__lastLat == null ||
          ov.__lastLng == null ||
          Math.abs(coord.lat - ov.__lastLat) >= minDeltaDeg ||
          Math.abs(coord.lng - ov.__lastLng) >= minDeltaDeg;
        if (moved) {
          ov.setPosition(new window.kakao.maps.LatLng(coord.lat, coord.lng));
          // 전신 고양이는 이동 방향을 바라본다 (기본 동쪽 보기 → 서쪽 이동 시 반전)
          const flipEl: HTMLElement | null = ov.__flipEl ?? null;
          if (flipEl) {
            const last = ov.__lastLng;
            if (last != null && Math.abs(coord.lng - last) > 1e-7) {
              const t = coord.lng < last ? "scaleX(-1)" : "scaleX(1)";
              if (flipEl.style.transform !== t) flipEl.style.transform = t;
            }
          }
          ov.__lastLat = coord.lat;
          ov.__lastLng = coord.lng;
        }
        // 행동 상태 뱃지 (💤/🐾/💨, 날씨 시 ☔☃️🥵🧣, 연출 시 💨/🍚) — 바뀔 때만 DOM 갱신
        const stateEl: HTMLElement | null = ov.__stateEl ?? null;
        if (stateEl) {
          const emoji = emojiOverride ?? catRoamMode(roamCat.id).emoji;
          if (stateEl.textContent !== emoji) stateEl.textContent = emoji;
        }
        // 기분 이모지 (자면 💤 / 우다다면 💨 / 평소 고양이별 감정) — 바뀔 때만 갱신
        const emoteEl: HTMLElement | null = ov.__emoteEl ?? null;
        if (emoteEl) {
          const em = emoteForCat(roamCat.id);
          if (emoteEl.textContent !== em) emoteEl.textContent = em;
        }
      });
    }, 200);
    return () => clearInterval(id);
  }, [mapReady, isLoggedIn]);

  // ── 병원 마커 (뷰포트 기반 + 좌표 없으면 Geocoder 변환) ──
  const hospitalIdleListenerRef = useRef<(() => void) | null>(null);
  const geocodedCoordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  useEffect(() => {
    // 기존 마커 정리
    hospitalOverlaysRef.current.forEach((ov) => ov.setMap(null));
    hospitalOverlaysRef.current = [];
    // 기존 idle 리스너 해제
    if (hospitalIdleListenerRef.current && mapInstanceRef.current && window.kakao) {
      window.kakao.maps.event.removeListener(mapInstanceRef.current, "idle", hospitalIdleListenerRef.current);
      hospitalIdleListenerRef.current = null;
    }

    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    if (hospitals.length === 0) return;

    const map = mapInstanceRef.current;
    const MAX_MARKERS = 200;

    // 좌표 없는 병원을 Geocoder로 변환 (수동 등록된 약국 등)
    const geocoder = window.kakao.maps?.services
      ? new window.kakao.maps.services.Geocoder()
      : null;
    const noCoord = hospitals.filter((h) => h.lat == null || h.lng == null);
    for (const h of noCoord) {
      if (geocodedCoordsRef.current.has(h.id)) continue;
      const addr = h.address || `${h.city} ${h.district}`;
      if (!geocoder || !addr) continue;
      geocoder.addressSearch(addr, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          geocodedCoordsRef.current.set(h.id, {
            lat: parseFloat(result[0].y),
            lng: parseFloat(result[0].x),
          });
          // 변환 완료 후 마커 다시 그리기
          renderVisibleHospitals();
        }
      });
    }

    // 병원=에메랄드 그린 크로스 / 약국=웜 오렌지 알약 — 물방울 핀 + 이름 칩.
    // 핀 꼭짓점이 정확히 좌표에 꽂히고, 라벨은 좌표 아래에 매달린다.
    function createHospitalEl(h: RescueHospital) {
      const el = document.createElement("div");
      const isPharmacy = (h.tags ?? []).some((t: string) => t.includes("동물약국"));
      const isManual = h.source !== "kakao";
      const isLarge = isPharmacy || isManual; // 약국 + 수동 등록 = 큰 마커
      const c1 = isPharmacy ? "#FF9E43" : "#2BC47E";
      const c2 = isPharmacy ? "#F0762B" : "#149D5B";
      const uid = `hp${String(h.id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;

      // 아이콘 — 핀 중앙(22,19.5)에 배치. 병원=둥근 십자, 약국=알약(캡슐)
      const iconSvg = isPharmacy
        ? `<g transform="translate(11.5,9) scale(0.875)" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
             <path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7Z"/>
             <path d="m8.5 8.5 7 7"/>
           </g>`
        : `<path d="M22 13v13M15.5 19.5h13" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>`;

      if (isLarge) {
        // 수동 등록 병원명은 저장 경계(REST 직결)를 우회한 페이로드일 수 있어 반드시 이스케이프
        const label = escapeHtml(h.name.length > 14 ? h.name.slice(0, 14) + "…" : h.name);
        el.innerHTML = `
          <div style="position: relative; transform: translate(-50%, -100%); cursor: pointer; width: 44px; height: 54px;">
            <svg width="44" height="54" viewBox="0 0 44 54" style="display:block; filter: drop-shadow(0 5px 8px ${c2}66);">
              <defs>
                <linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="${c1}"/>
                  <stop offset="1" stop-color="${c2}"/>
                </linearGradient>
              </defs>
              <path d="M22 52C22 52 5 31.5 5 19.5C5 10.1 12.6 2.5 22 2.5C31.4 2.5 39 10.1 39 19.5C39 31.5 22 52 22 52Z"
                    fill="url(#${uid})" stroke="#fff" stroke-width="3"/>
              <circle cx="22" cy="19.5" r="12.5" fill="rgba(255,255,255,0.16)"/>
              ${iconSvg}
            </svg>
            <div style="
              position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
              margin-top: -2px; padding: 2.5px 9px; border-radius: 999px;
              background: rgba(255,255,255,0.97); color: ${c2};
              font-size: 10px; font-weight: 800; white-space: nowrap;
              letter-spacing: -0.3px; line-height: 1.35;
              box-shadow: 0 2px 10px rgba(0,0,0,0.16);
              border: 1px solid var(--color-divider);
            ">${label}</div>
          </div>
        `;
      } else {
        // 작은 마커 (카카오 병원): 원형 도트 + 십자, 좌표 정중앙 앵커
        el.innerHTML = `
          <div style="transform: translate(-50%, -50%); cursor: pointer;">
            <div style="
              width: 26px; height: 26px; border-radius: 50%;
              background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%);
              border: 2px solid #fff;
              box-shadow: 0 2px 7px ${c2}66;
              display: flex; align-items: center; justify-content: center;
            ">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M6 1.5v9M1.5 6h9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
        `;
      }
      el.onclick = () => setSelectedHospital(h);
      return el;
    }

    function getCoord(h: RescueHospital): { lat: number; lng: number } | null {
      if (h.lat != null && h.lng != null) return { lat: h.lat, lng: h.lng };
      return geocodedCoordsRef.current.get(h.id) ?? null;
    }

    // 뷰포트 내 병원만 마커로 표시
    function renderVisibleHospitals() {
      hospitalOverlaysRef.current.forEach((ov) => ov.setMap(null));
      hospitalOverlaysRef.current = [];

      const level = map.getLevel();
      // 줌 레벨별 표시: 약국은 가까이 줌해야만 (병원 등장 임계와 동일).
      // 넓게 보면 고양이만 깔끔하게 보이도록.
      if (level >= 12) return; // 너무 넓으면 전부 숨김

      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const visible = hospitals.filter((h) => {
        const isPharm = (h.tags ?? []).some((t: string) => t.includes("동물약국"));
        const isManual = h.source !== "kakao";

        // 필터 칩 적용
        if (isPharm && !showPharmacies) return false;
        if (!isPharm && !showHospitals) return false;

        // 약국: 동네 줌(level < 7)에서만 표시 — 일반 병원이 모두 보이는 시점
        if (isPharm && level >= 7) return false;

        // 줌 레벨별 단계 표시 (병원)
        if (level >= 9) {
          // 넓은 범위: 수동 등록 병원만 (약국은 위에서 걸러짐)
          if (!isManual) return false;
        } else if (level >= 7) {
          // 중간 범위: 수동 + pinned 병원만
          if (!isManual && !h.pinned) return false;
        }
        // level < 7: 전부 표시 (약국 포함)

        const coord = getCoord(h);
        if (!coord) return false;
        return (
          coord.lat >= sw.getLat() &&
          coord.lat <= ne.getLat() &&
          coord.lng >= sw.getLng() &&
          coord.lng <= ne.getLng()
        );
      });

      // 수동 등록(약국 등) 우선 → pinned 우선 → 나머지
      const sorted = visible.sort((a, b) => {
        const aManual = a.source !== "kakao" ? 1 : 0;
        const bManual = b.source !== "kakao" ? 1 : 0;
        if (bManual !== aManual) return bManual - aManual;
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      });
      const toRender = sorted.slice(0, MAX_MARKERS);

      for (const h of toRender) {
        const coord = getCoord(h)!;
        const position = new window.kakao.maps.LatLng(coord.lat, coord.lng);
        const el = createHospitalEl(h);
        const isImportant = h.source !== "kakao" || (h.tags ?? []).some((t: string) => t.includes("동물약국"));
        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content: el,
          yAnchor: 1,
          zIndex: isImportant ? 5 : 2, // 약국/수동 마커가 항상 위에
        });
        overlay.setMap(map);
        hospitalOverlaysRef.current.push(overlay);
      }
    }

    // 초기 렌더링
    renderVisibleHospitals();

    // 지도 이동/줌 시 재렌더링
    hospitalIdleListenerRef.current = renderVisibleHospitals;
    window.kakao.maps.event.addListener(map, "idle", renderVisibleHospitals);

    return () => {
      if (hospitalIdleListenerRef.current && map && window.kakao) {
        window.kakao.maps.event.removeListener(map, "idle", hospitalIdleListenerRef.current);
      }
    };
  }, [hospitals, mapReady, showHospitals, showPharmacies]);

  const handleCatCreated = (newCat: Cat) => {
    setCats((prev) => [newCat, ...prev]);
    invalidateMapCatsCache();
    setSelectedCat(newCat);
    // 지도 중심을 새 핀으로 이동 (본인이 방금 등록한 거라 정확 좌표 OK)
    if (mapInstanceRef.current && window.kakao) {
      const pos = new window.kakao.maps.LatLng(newCat.lat, newCat.lng);
      mapInstanceRef.current.setCenter(pos);
    }
  };

  // ── 학대 신고 기록 복사 (뒤에서 Clipboard API로) ──
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const handleCopyAlertRecord = async () => {
    if (!selectedCat) return;
    const alerts = comments.filter((c) => c.kind === "alert");
    const lines = [
      `[${selectedCat.name}] 학대/위험 신고 기록`,
      selectedCat.region ? `지역: ${selectedCat.region}` : null,
      "",
      ...alerts.map((a) => {
        const when = new Date(a.created_at).toLocaleString("ko-KR");
        return `• ${when} / ${a.author_name ?? "익명"}: ${a.body}`;
      }),
      "",
      `앱: https://city-amber-omega.vercel.app/map`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("idle");
    }
  };

  const alertCount = comments.filter((c) => c.kind === "alert").length;

  const handleLocateMe = () => {
    // 현재 활동 지역 필터가 slot이면 해당 지역으로, 아니면 주 활동 지역, 그것도 없으면 GPS
    const slotTarget =
      regionFilter !== "all"
        ? activityRegions.find((r) => r.slot === regionFilter)
        : activityRegions.find((r) => r.is_primary) ?? activityRegions[0];

    if (slotTarget && mapInstanceRef.current && window.kakao) {
      mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(slotTarget.lat, slotTarget.lng));
      mapInstanceRef.current.setLevel(4);
      return;
    }
    if (!GEOLOCATION_ENABLED) { toast.info(GEO_DISABLED_MESSAGE); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        userPosRef.current = { lat: latitude, lng: longitude };
        applyUserPosRef.current?.();
        if (mapInstanceRef.current && window.kakao) {
          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(latitude, longitude));
          mapInstanceRef.current.setLevel(4);
        }
      },
      () => {},
      // 사용자 명시 클릭이지만 60초 캐시 — 연속 누름 시 권한 팝업 반복 방지
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  };

  const handleAddClick = () => {
    if (!isLoggedIn) { if (confirm("로그인하면 고양이를 등록할 수 있어요. 로그인할까요?")) window.location.href = "/login"; return; }
    // 지도 중심을 기본 좌표로 사용
    if (mapInstanceRef.current && window.kakao) {
      const center = mapInstanceRef.current.getCenter();
      setPickedCoord({ lat: center.getLat(), lng: center.getLng() });
    } else {
      setPickedCoord(MAP_CENTER);
    }
    setVisibilityIntroOpen(true);
  };

  // ── API 키 미설정 ──
  if (!apiKey) {
    return (
      <div className="px-5 pt-14 pb-8">
        <h1 className="text-[24px] font-bold text-text-main tracking-tight mb-2">
          우리 동네 시민참여 돌봄 고양이
        </h1>
        <div className="card p-6 mt-6">
          <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center mb-3">
            <MapPin size={22} className="text-warning" />
          </div>
          <p className="text-[15px] font-bold text-text-main mb-2">
            지도 키가 설정되지 않았어요
          </p>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <code className="text-[13px] bg-surface-alt px-1.5 py-0.5 rounded">.env.local</code>에{" "}
            <code className="text-[13px] bg-surface-alt px-1.5 py-0.5 rounded">NEXT_PUBLIC_KAKAO_MAP_KEY</code>를
            추가하고 개발 서버를 재시작해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <MapIntroModal />
    <div
      className="relative no-dark"
      style={{
        // 100dvh가 부정확한 기기 대비 vh 폴백 + 최소 높이 보장
        height: "calc(100dvh - 5rem)",
        minHeight: "calc(100vh - 5rem)",
        // 부모 layout의 max-w-lg(512px) 제약을 깨고 화면 전체를 채움.
        // 갤럭시 폴드 펼친 상태(>512px)에서 양 옆이 비는 이슈 해결.
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
      }}
    >
      {/* 헤더 (슬림 — 호갱노노 스타일) */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 지역 + 마릿수 */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "var(--shadow-raised)" }}
          >
            <MapPin size={14} style={{ color: "var(--color-primary)" }} />
            <span className="text-[13px] font-bold text-text-main">{currentGu || "전체"}</span>
            <span className="text-[13px] font-bold" style={{ color: "var(--color-primary)" }}>
              {(() => {
                const map = mapInstanceRef.current;
                const bounds = map?.getBounds?.();
                if (!bounds || !window.kakao) return cats.length;
                return cats.filter((c) => {
                  const coord = roamCoord(c, isLoggedIn);
                  const pos = new window.kakao.maps.LatLng(coord.lat, coord.lng);
                  return bounds.contain(pos);
                }).length;
              })()}
            </span>
            <span className="text-[11px] text-text-light">/</span>
            <span className="text-[11px] font-bold text-text-light">{cats.length}</span>
            {todayVisit != null && (
              <>
                <span className="w-px h-3 mx-0.5" style={{ backgroundColor: "var(--color-gray-200)" }} />
                <span className="text-[11px] font-bold text-text-light">방문자 {todayVisit.toLocaleString()}명</span>
              </>
            )}
          </div>

          {/* P2 상세 도구 토글 — flag on일 때만 노출. 레이어 칩·지역 탭·경보 카드·채팅 FAB을 2차로 */}
          {SHOW_MAP_DISCOVERY && (
            <button
              type="button"
              onClick={() => setDetailToolsOpen((v) => !v)}
              className="px-3 py-2 rounded-xl text-[11px] font-bold press-strong transition-all shrink-0 flex items-center gap-1"
              style={{
                backgroundColor: detailToolsOpen ? "var(--color-primary)" : "rgba(255,255,255,0.85)",
                color: detailToolsOpen ? "#fff" : "var(--color-text-light)",
                boxShadow: detailToolsOpen ? "0 2px 8px rgba(173, 94, 59, 0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
              }}
              aria-expanded={detailToolsOpen}
            >
              <SlidersHorizontal size={12} />
              {detailToolsOpen ? "간단히" : "상세 도구"}
            </button>
          )}

          {/* 필터 칩 */}
          {detailToolsVisible && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { key: "cats", label: "고양이", active: showCats, toggle: () => setShowCats(!showCats), color: "#AD5E3B" },
              { key: "hospitals", label: "병원", active: showHospitals, toggle: () => setShowHospitals(!showHospitals), color: "#149D5B" },
              { key: "pharmacies", label: "약국", active: showPharmacies, toggle: () => setShowPharmacies(!showPharmacies), color: "#F0762B" },
            ].map((f) => (
              <UIChip key={f.key} onClick={f.toggle} active={f.active} activeColor={f.color} floating>
                {f.label}
              </UIChip>
            ))}
          </div>
          )}
        </div>

        {/* 고양이 검색 + 속성 필터 */}
        {showCats && (
          <div className="mt-2 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <div
                className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <Search size={13} className="text-text-sub shrink-0" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="이름·동네·태그로 찾기"
                  className="flex-1 text-[13px] font-semibold bg-transparent outline-none placeholder:text-text-light"
                />
                {searchQ && (
                  <button
                    type="button"
                    onClick={() => setSearchQ("")}
                    className="shrink-0 w-5 h-5 rounded-full bg-surface-alt flex items-center justify-center press-strong"
                    aria-label="검색어 지우기"
                  >
                    <X size={11} className="text-text-sub" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFilterPanel((v) => !v)}
                className="w-9 h-9 rounded-full flex items-center justify-center press-strong shrink-0"
                style={{
                  background: catFilter !== "all" || showFilterPanel
                    ? "var(--color-primary)"
                    : "rgba(255,255,255,0.95)",
                  color: catFilter !== "all" || showFilterPanel ? "#fff" : "var(--color-text-light)",
                  boxShadow: "var(--shadow-card)",
                }}
                aria-label="고양이 필터"
                aria-expanded={showFilterPanel}
                aria-controls="cat-filter-panel"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* 검색 결과 피드백 — 매칭 있으면 지도가 자동 이동하고, 없으면 바로 알려줌 */}
            {searchMatchCount !== null && (
              <div className="mt-1.5 pointer-events-none">
                <span
                  className="inline-flex items-center px-2.5 py-1 chip-square text-[11px] font-bold"
                  style={{
                    background: searchMatchCount > 0 ? "rgba(255,255,255,0.95)" : "rgba(216,85,85,0.92)",
                    color: searchMatchCount > 0 ? "var(--color-primary)" : "#fff",
                    boxShadow: "var(--shadow-raised)",
                  }}
                >
                  {searchMatchCount > 0 ? `${searchMatchCount}마리 찾음 — 지도로 이동할게요` : "검색 결과가 없어요"}
                </span>
              </div>
            )}

            {/* 속성 필터 칩 */}
            {showFilterPanel && (
              <div id="cat-filter-panel" className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                {([
                  { key: "all",             label: "전체",       color: "var(--color-gray-900)" },
                  { key: "alert",           label: "학대 경보",   color: "var(--color-error)" },
                  { key: "tnr_needed",      label: "TNR 필요",   color: "var(--color-care)" },
                  { key: "neutered",        label: "중성화 완료", color: "var(--color-sage)" },
                  { key: "health_concern",  label: "건강 주의",   color: "var(--color-warning)" },
                ] as { key: CatFilter; label: string; color: string }[]).map((f) => {
                  const active = catFilter === f.key;
                  return (
                    <UIChip key={f.key} onClick={() => setCatFilter(f.key)} active={active} activeColor={f.color} floating>
                      {f.label}
                    </UIChip>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 활동 지역 탭 (당근마켓 스타일) — P2 flag on이면 상세 도구를 연 경우에만 */}
        {isLoggedIn && detailToolsVisible && (
          <div className="flex gap-1.5 mt-2 pointer-events-auto overflow-x-auto no-scrollbar">
            {activityRegions.length > 0 ? (
              <>
                <UIChip onClick={() => setRegionFilter("all")} active={regionFilter === "all"} activeColor="var(--color-gray-900)" floating>
                  전체
                </UIChip>
                {activityRegions.map((r) => {
                  const color = r.slot === 1 ? "#AD5E3B" : "#4A7BA8";
                  const active = regionFilter === r.slot;
                  return (
                    <UIChip
                      key={r.slot}
                      onClick={() => {
                        setRegionFilter(r.slot as 1 | 2);
                        if (mapInstanceRef.current && window.kakao) {
                          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(r.lat, r.lng));
                          mapInstanceRef.current.setLevel(4);
                        }
                      }}
                      active={active}
                      activeColor={color}
                      floating
                    >
                      {r.name}
                      {r.is_primary && <Star size={9} fill="currentColor" className="shrink-0" />}
                    </UIChip>
                  );
                })}
                <Link
                  href="/mypage/activity-regions"
                  className="px-3 py-1.5 rounded-2xl text-[11px] font-bold press-strong transition-all shrink-0"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.7)",
                    color: "var(--color-text-light)",
                    boxShadow: "var(--shadow-card)",
                    border: "1px dashed rgba(163,142,122,0.4)",
                  }}
                >
                  지역 설정
                </Link>
              </>
            ) : (
              <Link
                href="/mypage/activity-regions"
                className="px-3 py-1.5 rounded-2xl text-[11px] font-bold press-strong transition-all shrink-0"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(173, 94, 59,0.35)",
                }}
              >
                내 활동 지역 추가하기
              </Link>
            )}
          </div>
        )}

        {/* 게스트 배너 — 로그인 유도 + 좌표 퍼징 안내 */}
        {!isLoggedIn && !loadingCats && (
          <div
            className="rounded-2xl px-4 py-2.5 pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex items-start gap-2.5"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Shield size={15} className="mt-0.5 shrink-0" style={{ color: "#fff" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">
                둘러보기 모드예요
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                로그인하면 고양이 정보 확인 · 돌봄 기록 · 채팅을 사용할 수 있어요
              </p>
            </div>
            <a
              href="/login?next=%2Fmap"
              className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold press-strong"
              style={{ backgroundColor: "var(--color-surface)", color: "var(--color-primary)" }}
            >
              로그인
            </a>
          </div>
        )}

        {/* 학대 경보 & 시민 참여 카드 — 현재 보이는 구 기준. P2 flag on이면 상세 도구 2차 영역 */}
        {detailToolsVisible && (() => {
          // 현재 지도 화면에 보이는 경보 고양이만 필터
          const map = mapInstanceRef.current;
          const bounds = map?.getBounds?.();
          const alertedInView = cats.filter((c) => {
            if (!alertedCats.has(c.id)) return false;
            if (!bounds || !window.kakao) return false;
            const coord = roamCoord(c, isLoggedIn);
            const pos = new window.kakao.maps.LatLng(coord.lat, coord.lng);
            return bounds.contain(pos);
          });
          const alertedCount = alertedInView.length;
          const hasAlert = alertedCount > 0;

          // 경보가 있는 동 목록
          const alertDongs = new Map<string, number>();
          alertedInView.forEach((c) => {
            const dong = c.region || "미확인";
            alertDongs.set(dong, (alertDongs.get(dong) ?? 0) + 1);
          });

          return (
            <div
              className="rounded-2xl pointer-events-auto overflow-hidden backdrop-blur-md"
              style={{
                background: hasAlert
                  ? "linear-gradient(135deg, rgba(216,85,85,0.12) 0%, rgba(184,69,69,0.08) 100%)"
                  : "rgba(255,255,255,0.9)",
                boxShadow: hasAlert
                  ? "0 4px 20px rgba(216,85,85,0.15)"
                  : "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <button
                type="button"
                onClick={() => setAbuseCardExpanded((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left press transition-transform"
              >
                {hasAlert ? (
                  <AlertTriangle size={16} color="var(--color-error)" strokeWidth={2.5} />
                ) : (
                  <Shield size={16} color="var(--color-sage)" strokeWidth={2.5} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight" style={{ color: hasAlert ? "var(--color-error)" : "var(--color-sage)" }}>
                    {hasAlert
                      ? `${currentGu || "전체"} 학대 경보 ${alertedCount}건`
                      : `${currentGu || "이 동네"} · 현재 경보 없음`}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: hasAlert ? "var(--color-error)" : "var(--color-sage)" }}>
                    {hasAlert
                      ? Array.from(alertDongs.entries()).map(([dong, cnt]) => `${dong} ${cnt}건`).join(" · ")
                      : "학대 징후 발견 시 시민 제보가 가장 큰 힘이에요"}
                  </p>
                </div>
                {abuseCardExpanded ? (
                  <ChevronUp size={14} style={{ color: hasAlert ? "var(--color-error)" : "var(--color-sage)" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: hasAlert ? "var(--color-error)" : "var(--color-sage)" }} />
                )}
              </button>

              {abuseCardExpanded && (
                <div className="px-4 pb-3 space-y-2.5" style={{ borderTop: "1px solid var(--color-divider)" }}>
                  <p className="text-[11px] leading-relaxed mt-2.5" style={{ color: "var(--color-gray-700)" }}>
                    동물보호법 제8조 위반 · <b>3년 이하 징역 또는 3,000만원 이하 벌금</b>
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: "var(--color-gray-700)" }}>
                    <span>· 증거 촬영(사진·영상·시간·장소)</span>
                    <span>· 지도에 경보 기록 남기기</span>
                    <span>· 구청·경찰·동물보호콜센터 신고</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="tel:112"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold press-strong transition-transform"
                      style={{ backgroundColor: "var(--color-gray-900)", color: "#fff" }}
                    >
                      <Phone size={11} strokeWidth={2.5} />
                      112 경찰 신고
                    </a>
                    <a
                      href="tel:1577-0954"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold press-strong transition-transform"
                      style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-gray-800)" }}
                    >
                      <Phone size={11} strokeWidth={2.5} />
                      1577-0954
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* P4 돌봄팀 진입 카드 — P4 flag on + P2 상세 도구 열림일 때만 2차 영역에 노출.
            지도(/map)는 이 카드의 '동네 채팅' 섹션이라 현재 위치 배지로 표시된다. */}
        {isCoreJourneyEnabled("P4") && detailToolsVisible && <CareTeamCard />}

      </div>

      {/* 지도 영역 */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{
          background: "var(--color-gray-50)",
          // 부모 높이 계산 실패 시도 최소 400px 확보 (빈 화면 방지)
          minHeight: 400,
        }}
      />

      {/* 저작권 표시 */}
      <div className="absolute bottom-1 left-2 z-[1] pointer-events-none">
        <span className="text-[9px]" style={{ color: "rgba(0,0,0,0.4)" }}>
          © Kakao Corp. · 공공데이터포털(data.go.kr)
        </span>
      </div>

      {/* 로딩 표시 */}
      {(loadingCats || !scriptLoaded) && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md pointer-events-auto">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span className="text-[13px] font-semibold text-text-main">
              {!scriptLoaded ? "지도 불러오는 중..." : "고양이 불러오는 중..."}
            </span>
          </div>
        </div>
      )}

      {/* 데이터 에러 */}
      {catsError && (
        <div className="absolute top-32 left-4 right-4 z-10">
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--color-gray-100)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>
              {catsError}
            </p>
            <button
              onClick={fetchCats}
              className="text-[13px] font-bold text-primary mt-1"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 지도 에러 */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl px-5 py-4 max-w-[280px] shadow-lg pointer-events-auto">
            <p className="text-[15px] font-bold text-text-main mb-1">지도를 불러올 수 없어요</p>
            <p className="text-[13px] text-text-sub leading-relaxed">{mapError}</p>
          </div>
        </div>
      )}

      {/* 채팅 FAB — 전체 채팅만 활성. 동네 채팅은 가입자 늘면 재활성화 예정.
          P2 flag on이면 상세 도구를 연 경우에만 (기능 자체는 유지, 2차 영역). */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && detailToolsVisible && (
        <div className="absolute bottom-6 left-4 z-30 flex flex-col items-start gap-1.5">
          {/* 전체 채팅 — 모든 지역이 함께 쓰는 방 */}
          <button
            type="button"
            onClick={() => {
              if (!isLoggedIn) {
                if (confirm("로그인하면 전체 채팅을 사용할 수 있어요. 로그인할까요?")) window.location.href = "/login";
                return;
              }
              setChatArea("전체");
              setChatOpen(true);
            }}
            className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 press-strong transition-transform"
            style={{
              background: "var(--color-sage)",
              borderRadius: "var(--radius-modal)",
              boxShadow: "0 6px 20px rgba(34,163,102,0.45), 0 0 0 2px rgba(255,255,255,0.8)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              <Globe size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">전체</p>
              <p className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>전체 채팅</p>
            </div>
          </button>

          {/* 동네 채팅 잠시 숨김 — 가입자가 적어 동네별로 분산되면 빈 채팅방이라 비활성. */}
          {/* 출시 후 동네별 가입자 늘면 다시 활성화 (block 통째로 복원). */}

          {currentGu && (
            <div
              className="px-3 py-2 rounded-2xl max-w-[160px]"
              style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "var(--shadow-raised)" }}
            >
              <p className="text-[11px] font-semibold text-text-main leading-snug">전체 채팅에서 동네 이웃을 만나보세요</p>
            </div>
          )}
        </div>
      )}

      {/* 내 위치 + 등록 FAB */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && (
        <div className="absolute bottom-6 right-4 z-30 flex flex-col gap-2.5 items-end">
          {/* 고양이별 — 먼저 떠난 아이들. 밤하늘 톤이라 다른 FAB과 구분된다 */}
          <Link
            href="/memorial"
            className="relative w-11 h-11 rounded-full flex items-center justify-center press-strong transition-transform overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #4a3a63 0%, #2b2140 100%)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.18) inset, 0 3px 8px rgba(30,20,50,0.28), 0 8px 18px rgba(30,20,50,0.18)",
            }}
            aria-label="고양이별 — 먼저 떠난 아이들"
            title="고양이별"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)" }} />
            <Star size={16} color="#FFE9A8" fill="#FFE9A8" className="relative" />
          </Link>

          {/* 곁에 있어요 — 112/119 빠른 전화 (A-1). 공포 프레임 대신 안심 톤 */}
          <button
            onClick={() => setSafetyOpen(true)}
            className="relative w-11 h-11 rounded-full flex items-center justify-center press-strong transition-transform overflow-hidden"
            style={{
              background: "var(--color-surface)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 -3px 6px rgba(60,70,110,0.08) inset, 0 3px 8px rgba(30,40,80,0.14), 0 8px 18px rgba(30,40,80,0.10)",
            }}
            aria-label="곁에 있어요 — 112/119 빠른 전화"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)" }} />
            <PhoneCall size={17} style={{ color: "var(--color-error)" }} strokeWidth={2.4} className="relative" />
          </button>
          <button
            onClick={handleLocateMe}
            className="relative w-11 h-11 rounded-full flex items-center justify-center press-strong transition-transform overflow-hidden"
            style={{
              background: "var(--color-surface)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 -3px 6px rgba(60,70,110,0.08) inset, 0 3px 8px rgba(30,40,80,0.14), 0 8px 18px rgba(30,40,80,0.10)",
            }}
            aria-label="내 위치"
          >
            {/* 유리질 광택 하이라이트 */}
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 rounded-t-full pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 100%)" }} />
            <LocateFixed size={18} style={{ color: "var(--color-primary)" }} strokeWidth={2.4} className="relative" />
          </button>
          <div className="relative">
            {/* 고양이 0마리 유저한텐 펄스 링으로 강조 */}
            {isLoggedIn && !cats.some((c) => c.caretaker_id === user?.id) && (
              <>
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: "rgba(173, 94, 59,0.45)" }}
                  aria-hidden="true"
                />
                <span
                  className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 chip-square text-white z-10"
                  style={{
                    background: "var(--color-like)",
                    boxShadow: "0 2px 6px rgba(232,107,140,0.4)",
                  }}
                >
                  NEW
                </span>
              </>
            )}
            <button
              onClick={handleAddClick}
              className="relative rounded-full flex items-center justify-center press-strong transition-transform overflow-hidden"
              style={{
                width: 58, height: 58,
                background: "linear-gradient(160deg, var(--color-primary-light) 0%, var(--color-primary) 45%, var(--color-primary-dark) 100%)",
                boxShadow: "0 0 0 4px #fff, 0 6px 14px rgba(173,94,59,0.45), 0 2px 4px rgba(173,94,59,0.3), inset 0 -3px 6px rgba(138,67,37,0.35)",
              }}
              aria-label="고양이 등록"
            >
              {/* 유리질 광택 하이라이트 (상단) */}
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)", borderRadius: "999px 999px 0 0" }} />
              {/* 바닥 접지 그림자용 살짝 어두운 하단 테두리 */}
              <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-2 rounded-full pointer-events-none"
                style={{ background: "rgba(20,35,90,0.25)", filter: "blur(3px)" }} />
              <Plus size={26} color="#fff" strokeWidth={2.5} className="relative" style={{ filter: "drop-shadow(0 1px 1px rgba(20,40,100,0.35))" }} />
            </button>
          </div>
          <div
            className="px-3 py-2 rounded-2xl max-w-[180px] text-right"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "var(--shadow-raised)" }}
          >
            <p className="text-[11px] font-semibold text-text-main leading-snug">우리 동네 고양이를 등록하고 품앗이 케어해보세요</p>
            <p className="text-[9px] text-text-light mt-0.5 leading-snug">
              고양이 위치는 보안상 동 단위로 표기돼요.
              <br />
              안심하고 등록해주세요 — 내가 못 가는 시간엔 이웃이 지켜줘요
            </p>
          </div>
        </div>
      )}

      {/* 곁에 있어요 — 112/119 빠른 전화 시트 (A-1, 서버 무경유) */}
      <SafetyCallSheet open={safetyOpen} onClose={() => setSafetyOpen(false)} />

      {/* 고양이별로 보내기 — 확인 → 승천 애니메이션 → 도착 */}
      {starCat && (
        <SendToCatStar
          cat={starCat}
          onClose={() => setStarCat(null)}
          onSent={() => {
            setCats((prev) => prev.filter((c) => c.id !== starCat.id));
            invalidateMapCatsCache();
            setSelectedCat(null);
          }}
        />
      )}

      {/* 첫 진입 유저용 코치마크 (내 고양이 0마리일 때만) */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && !addModalOpen && (
        <MapCoachmark
          isLoggedIn={isLoggedIn}
          hasMyCat={cats.some((c) => c.caretaker_id === user?.id)}
        />
      )}

      {/* 첫 진입 시 동네/전체 채팅 사용법 안내 (30일 dismiss) */}
      <MapChatGuideModal />

      {/* 채팅방 — 동네(현재 구) 또는 전체 */}
      {chatOpen && chatArea && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div
            className="pointer-events-auto animate-slide-up mx-4 mb-4 flex flex-col"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-sheet)",
              boxShadow: "var(--shadow-sheet)",
              border: "1px solid var(--color-divider)",
              height: "65dvh",
            }}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-divider shrink-0">
              {chatArea === "전체"
                ? <Globe size={16} style={{ color: "var(--color-sage)" }} />
                : <MessageCircle size={16} className="text-primary" />}
              <span className="text-[15px] font-bold text-text-main flex-1">
                {chatArea === "전체" ? "전체 채팅" : `${chatArea} 채팅`}
              </span>
              <span className="text-[11px] text-text-light">{chatMessages.length}개 메시지</span>
              <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center press-strong">
                <X size={16} className="text-text-sub" />
              </button>
            </div>

            {/* 일일 정리 안내 — 사용자가 메시지 사라지는 이유 알 수 있게 */}
            <div
              className="px-5 py-2 text-[11px] text-text-sub flex items-center gap-1.5 shrink-0"
              style={{ background: "rgba(173, 94, 59,0.06)", borderBottom: "1px solid var(--color-divider)" }}
            >
              <Clock size={12} className="shrink-0" />
              <span>채팅은 <b className="text-text-main">매일 새벽 4시</b>에 모두 정리됩니다 서버비 감당이안돼서요 ㅠㅠ</span>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-text-light">
                  <MessageCircle size={32} strokeWidth={1.2} className="mb-2 opacity-30" />
                  <p className="text-[13px]">아직 대화가 없어요</p>
                  <p className="text-[11px] mt-0.5">첫 메시지를 보내보세요!</p>
                </div>
              )}
              {chatMessages.map((msg) => {
                const isMe = user?.id === msg.author_id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                    {!isMe && (
                      msg.author_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnailUrl(msg.author_avatar_url, 56) ?? msg.author_avatar_url} alt="" loading="lazy" decoding="async" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[11px] font-bold text-primary">{(msg.author_name ?? "?")[0]}</span>
                        </div>
                      )
                    )}
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <div className="flex items-center gap-1 mb-0.5 px-1">
                          <span className="text-[11px] font-semibold text-text-sub">{msg.author_name ?? "익명"}</span>
                          {msg.author_level && (
                            <span
                              className="text-[9px] font-bold px-1 py-[1px] rounded-md tabular-nums"
                              style={{
                                backgroundColor: getLevelColor(msg.author_level),
                                color: "#FFFFFF",
                              }}
                            >
                              Lv.{msg.author_level}
                            </span>
                          )}
                          <SendDMButton userId={msg.author_id} userName={msg.author_name} currentUserId={user?.id} />
                        </div>
                      )}
                      <div
                        className="px-3.5 py-2 text-[13px] leading-relaxed"
                        style={{
                          backgroundColor: isMe ? "var(--color-primary)" : "var(--color-gray-50)",
                          color: isMe ? "#fff" : "var(--color-gray-900)",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        }}
                      >
                        {msg.body}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMe ? "justify-end" : ""}`}>
                        <span className="text-[9px] text-text-light">
                          {new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* 입력 */}
            {user ? (
              <div className="flex gap-2 px-4 py-3 border-t border-divider shrink-0">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="메시지를 입력하세요"
                  className="flex-1 px-3.5 py-2.5 rounded-2xl text-[13px] outline-none"
                  style={{ backgroundColor: "var(--color-gray-50)", border: "1px solid var(--color-border)" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && chatText.trim()) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleChatSend}
                  disabled={chatSending || !chatText.trim()}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 press-strong transition-transform"
                >
                  {chatSending ? <Loader2 size={16} className="animate-spin text-white" /> : <Send size={16} color="#fff" />}
                </button>
              </div>
            ) : (
              <p className="px-5 py-3 text-[11px] text-text-light text-center border-t border-divider">로그인하면 대화에 참여할 수 있어요</p>
            )}
          </div>
        </div>
      )}

      {/* 선택된 동 — 고양이 목록 */}
      {selectedDong && !selectedCat && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div
            className="relative pointer-events-auto animate-slide-up overflow-hidden"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-sheet)",
              boxShadow: "0 -4px 24px rgba(173, 94, 59,0.15), 0 2px 8px rgba(0,0,0,0.06)",
              border: "1.5px solid rgba(173, 94, 59,0.2)",
              maxHeight: "70dvh",
            }}
          >
            <button
              onClick={() => setSelectedDong(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center press-strong transition-transform shadow-md"
            >
              <X size={18} className="text-text-sub" />
            </button>

            <div className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <PawPrint size={18} style={{ color: "var(--color-primary)" }} />
                <h3 className="text-[17px] font-bold text-text-main">{selectedDong}</h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 chip-square"
                  style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
                >
                  {selectedDongCats.length}마리
                </span>
              </div>
              <p className="text-[11px] text-text-sub">고양이를 탭하면 상세 정보를 볼 수 있어요</p>
            </div>

            <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "calc(70dvh - 80px)" }}>
              {selectedDongCats.map((cat) => {
                // 48px 썸네일 — 변환 endpoint로 egress 절감 (원본 4MB → ~10KB)
                const photoUrl = thumbnailUrl(cat.photo_url, 96)
                  ?? sanitizeImageUrl(cat.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
                const isAlerted = alertedCats.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setSelectedCat(cat); setSelectedDong(null); setCatCardTab("carelog"); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl active:bg-black/[0.03] transition-colors text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                      style={{
                        border: `2.5px solid ${isAlerted ? "var(--color-error)" : "var(--color-primary)"}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold text-text-main truncate">{cat.name}</span>
                        {isAlerted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "var(--color-error)", color: "#fff" }}>경보</span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-text-sub truncate mt-0.5">{cat.description}</p>
                      )}
                      {(cat.tags ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {cat.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-text-light)" }}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-text-light shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 선택된 병원/약국 상세 카드 */}
      {selectedHospital && (() => {
        const isPharm = (selectedHospital.tags ?? []).some((t) => t.includes("동물약국"));
        const accent = isPharm ? "#F0762B" : "#149D5B"; // 마커·필터 칩과 동일 팔레트
        return (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div
            className="relative pointer-events-auto animate-slide-up overflow-hidden"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-sheet)",
              boxShadow: `0 -4px 24px ${accent}26, 0 2px 8px rgba(0,0,0,0.06)`,
              border: `1.5px solid ${accent}33`,
            }}
          >
            <button
              onClick={() => setSelectedHospital(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center press-strong transition-transform shadow-md"
            >
              <X size={18} className="text-text-sub" />
            </button>

            {/* 헤더 */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-12 h-12 flex items-center justify-center shrink-0"
                  style={{
                    borderRadius: isPharm ? 24 : 16,
                    background: `linear-gradient(135deg, ${accent} 0%, ${accent}DD 100%)`,
                    boxShadow: `0 6px 14px ${accent}55`,
                  }}
                >
                  {isPharm ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7Z"/>
                      <path d="m8.5 8.5 7 7"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5.5v13M5.5 12h13" stroke="#fff" strokeWidth="4" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[17px] font-bold text-text-main leading-tight">
                    {selectedHospital.name}
                  </h3>
                  <p className="text-[11px] text-text-sub mt-0.5">
                    {selectedHospital.city} {selectedHospital.district}
                  </p>
                </div>
              </div>

              {/* 태그 */}
              {selectedHospital.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {selectedHospital.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${accent}18`, color: accent }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 정보 리스트 */}
              <div className="space-y-2">
                {selectedHospital.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="shrink-0 mt-0.5" style={{ color: accent }} />
                    <span className="text-[13px] text-text-main">{selectedHospital.address}</span>
                  </div>
                )}
                {selectedHospital.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={14} className="shrink-0" style={{ color: accent }} />
                    <a
                      href={`tel:${selectedHospital.phone}`}
                      className="text-[13px] font-semibold"
                      style={{ color: accent }}
                    >
                      {selectedHospital.phone}
                    </a>
                  </div>
                )}
                {selectedHospital.hours && (
                  <div className="flex items-center gap-2.5">
                    <Clock size={14} className="shrink-0" style={{ color: accent }} />
                    <span className="text-[13px] text-text-main">{selectedHospital.hours}</span>
                  </div>
                )}
                {selectedHospital.note && (
                  <div
                    className="mt-2 px-3 py-2.5 rounded-xl text-[13px] leading-relaxed"
                    style={{ backgroundColor: `${accent}10`, color: `${accent}DD` }}
                  >
                    {selectedHospital.note}
                  </div>
                )}
              </div>
            </div>

            {/* 하단 버튼들 */}
            <div
              className="px-5 py-3 border-t flex flex-col gap-2"
              style={{ borderColor: `${accent}15` }}
            >
              {selectedHospital.phone && (
                <a
                  href={`tel:${selectedHospital.phone}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[15px] font-bold text-white press-strong transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${accent} 0%, ${accent}DD 100%)`,
                    boxShadow: `0 6px 18px ${accent}55`,
                  }}
                >
                  <Phone size={16} strokeWidth={2.5} />
                  {isPharm ? "약국 전화하기" : "병원 전화하기"}
                </a>
              )}
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`"${selectedHospital.name}"을(를) 폐업으로 신고할까요?\n신고하면 지도에서 숨겨집니다.`)) return;
                    try {
                      const { createClient: cc } = await import("@/lib/supabase/client");
                      const sb = cc();
                      const { data: { session } } = await sb.auth.getSession();
                      const res = await fetch("/api/hospitals/report-closed", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${session?.access_token ?? ""}`,
                        },
                        body: JSON.stringify({ hospitalId: selectedHospital.id }),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        toast.info(d.message);
                        setSelectedHospital(null);
                        setHospitals((prev) => prev.filter((h) => h.id !== selectedHospital.id));
                      } else {
                        toast.error(d.error ?? "신고 실패");
                      }
                    } catch { toast.error("신고 처리 중 오류가 발생했어요"); }
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl text-[13px] font-bold press-strong transition-transform"
                  style={{ backgroundColor: "var(--color-gray-50)", color: "var(--color-text-light)" }}
                >
                  <Flag size={13} />
                  폐업 신고
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* 선택된 고양이 카드 */}
      {selectedCat && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
        >
          {/* 본인 고양이면 수정/삭제 — 닫기 버튼과 마찬가지로 카드 높이와 무관하게
              항상 화면 상단에 고정(예전엔 카드 내부 흐름에 있어서 내용이 짧으면
              화면 아래쪽에 묻혀 안 보이거나 놓치기 쉬웠음) */}
          {(user?.id === selectedCat.caretaker_id || isAdmin) && !editingCat && (
            <div
              className="fixed flex items-center gap-2 pointer-events-auto"
              style={{ top: "calc(env(safe-area-inset-top) + 12px)", left: 16, zIndex: 30 }}
            >
              <button
                onClick={() => {
                  setEditingCat(true);
                  setEditName(selectedCat.name);
                  setEditDesc(selectedCat.description ?? "");
                  setEditRegion(selectedCat.region ?? "");
                  setEditTags(selectedCat.tags ?? []);
                  setEditGender(selectedCat.gender ?? "unknown");
                  setEditNeutered(selectedCat.neutered ?? null);
                  setEditHealth(selectedCat.health_status ?? "good");
                  setEditAdoption(selectedCat.adoption_status ?? null);
                  setEditVisibility(selectedCat.visibility ?? "public");
                  setEditLat(null);
                  setEditLng(null);
                }}
                className="w-11 h-11 rounded-full bg-white flex items-center justify-center press-strong transition-transform"
                style={{ boxShadow: "var(--shadow-fab)" }}
                aria-label="수정"
              >
                <Pencil size={17} className="text-primary" />
              </button>
              {/* 고양이별로 보내기 — 무지개다리를 건넌 아이용.
                  삭제는 care_logs·카드까지 CASCADE 로 지우므로 기록을 남기려면 이쪽이다. */}
              <button
                onClick={() =>
                  setStarCat({
                    id: selectedCat.id,
                    name: selectedCat.name,
                    photo_url: selectedCat.photo_url ?? null,
                  })
                }
                className="w-11 h-11 rounded-full flex items-center justify-center press-strong transition-transform"
                style={{
                  background: "linear-gradient(135deg, #3a2c4d, #6b5b8a)",
                  boxShadow: "0 4px 14px rgba(58,44,77,0.38)",
                }}
                aria-label="고양이별로 보내기"
                title="고양이별로 보내기"
              >
                <Star size={17} color="#FFE9A8" fill="#FFE9A8" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`"${selectedCat.name}" 을(를) 삭제할까요?`)) return;
                  try {
                    await deleteCat(selectedCat.id);
                    setCats((prev) => prev.filter((c) => c.id !== selectedCat.id));
                    invalidateMapCatsCache();
                    setSelectedCat(null);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "삭제 실패");
                  }
                }}
                className="w-11 h-11 rounded-full flex items-center justify-center press-strong transition-transform"
                style={{ background: "var(--color-error)", boxShadow: "0 4px 14px rgba(216,85,85,0.40)" }}
                aria-label="삭제"
              >
                <Trash2 size={17} color="#fff" />
              </button>
            </div>
          )}

          {/* 닫기 버튼 — 카드 높이와 무관하게 항상 화면 우측 상단에 고정 */}
          <button
            onClick={() => { setSelectedCat(null); setEditingCat(false); setEditLat(null); setEditLng(null); }}
            className="fixed w-11 h-11 rounded-full bg-white flex items-center justify-center press-strong transition-transform pointer-events-auto"
            style={{
              top: "calc(env(safe-area-inset-top) + 12px)", right: 16, zIndex: 30,
              boxShadow: "var(--shadow-fab)",
            }}
            aria-label="닫기"
          >
            <X size={20} className="text-text-main" strokeWidth={2.5} />
          </button>

          <div
            className="relative bg-white rounded-[28px] overflow-hidden pointer-events-auto animate-slide-up overflow-y-auto"
            style={{
              maxHeight: "calc(100dvh - max(env(safe-area-inset-top), 12px) - 80px)",
              border: `2.5px solid ${catCardTheme.frameOuter}`,
              boxShadow: `0 0 20px ${catCardTheme.accent}66, 0 -4px 24px rgba(0,0,0,0.12)`,
            }}
          >

            {/* 카드 페이스 — 포켓몬GO식 "인카운터" 헤더: 속성 컬러 리본 + 원형 사진 */}
            <div style={{ background: "var(--color-surface)" }}>
              {/* 속성 리본: 등급 뱃지 · 레벨 · 도감번호 — 진한 속성색 배경(GO 인카운터 카드 톤) */}
              <div
                className="flex items-center justify-between px-3.5"
                style={{ height: 34, background: catCardTheme.typeBg }}
              >
                <span
                  className="inline-flex items-center gap-1 chip-square px-2 py-0.5 text-[11px] font-bold tracking-wide"
                  style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
                >
                  <span>{catCardTheme.typeIcon}</span>
                  <span>{catCardTheme.label}</span>
                </span>
                <div className="flex items-center gap-2">
                  {selectedCat.card_level != null && selectedCat.card_level > 1 && (
                    <span
                      className="chip-square px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
                    >
                      Lv.{selectedCat.card_level}
                    </span>
                  )}
                  <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
                    No.{catDexNo}
                  </span>
                </div>
              </div>

              {/* 사진 — 둥근 원형 프레임(도감 인카운터 느낌), 흰 배경 위에 살짝 띄워서 */}
              <div className="px-4 pt-4 pb-1 flex justify-center" style={{ background: `linear-gradient(180deg, ${catCardTheme.typeBg}22, transparent 70%)` }}>
                <div
                  ref={petPhotoRef}
                  className="relative overflow-hidden bg-surface-alt rounded-full"
                  style={{ width: 148, height: 148, boxShadow: `0 0 0 5px #fff, 0 0 0 8px ${catCardTheme.typeBg}, 0 8px 20px rgba(0,0,0,0.15)` }}
                >
                  {selectedCat.photo_url && !selectedCatPhotoFailed ? (
                    <img
                      src={optimizedImageUrl(selectedCat.photo_url, 800) ?? selectedCat.photo_url}
                      alt={selectedCat.name}
                      className="w-full h-full object-cover"
                      decoding="async"
                      onError={() => setSelectedCatPhotoFailed(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-light">
                      <MapPin size={40} strokeWidth={1.2} />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 pb-2 flex items-center justify-center gap-2 flex-wrap">
                {selectedCat.region && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 chip-square" style={{ background: "var(--color-gray-100)" }}>
                    <MapPin size={12} className="text-primary" />
                    <span className="text-[13px] font-bold text-text-main">{selectedCat.region}</span>
                  </div>
                )}
                {selectedCat.caretaker_name && (
                  <div className="flex items-center gap-1 px-3 py-1.5 chip-square" style={{ background: "var(--color-gray-100)" }}>
                    <Heart size={11} className="text-primary" fill="currentColor" />
                    <span className="text-[11px] font-semibold text-text-sub">
                      {selectedCat.caretaker_name} 돌봄중
                    </span>
                  </div>
                )}
                {(() => {
                  const m = catRoamMode(selectedCat.id, roamTick);
                  return (
                    <div className="flex items-center gap-1 px-3 py-1.5 chip-square" style={{ background: "var(--color-gray-100)" }}>
                      <span className="text-[11px]">{m.emoji}</span>
                      <span className="text-[11px] font-semibold text-text-sub">지금 {m.label}</span>
                    </div>
                  );
                })()}
              </div>

              {/* 쓰다듬기 — 탭하면 하트 팡 + 누적 횟수 (순수 애정, 보상 없음) */}
              {!editingCat && (
                <div className="px-4 pb-1 flex justify-center">
                  <div className="relative">
                    {/* 하트 버스트 */}
                    {petHearts.map((h) => (
                      <span
                        key={h.id}
                        className="pet-heart"
                        style={{ ["--dx" as string]: `${h.dx}px`, ["--r" as string]: `${h.r}deg` }}
                      >
                        {h.ch}
                      </span>
                    ))}
                    <button
                      onClick={doPet}
                      className={`flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full press-strong transition-transform ${petPop ? "pet-pop" : ""}`}
                      style={{
                        background: "var(--color-like)",
                        boxShadow: "0 5px 16px rgba(232,107,140,0.40)",
                      }}
                      aria-label={`${selectedCat.name} 쓰다듬기`}
                    >
                      <span className="text-[13px] font-bold text-white">쓰다듬기</span>
                      {petCount > 0 && (
                        <span className="text-[11px] font-bold text-white/90 tabular-nums flex items-center gap-0.5">
                          <Heart size={10} fill="currentColor" /> {petCount.toLocaleString()}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 배회 마커 안내 — 탭하면 스토킹·학대 방지 설계 상세 설명 펼침 */}
              <details className="px-4 pb-1 group">
                <summary className="text-[11px] text-text-light text-center list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
                  마커는 아이들 보호를 위해 실제 위치와 다르게 계속 움직여요{" "}
                  <span className="underline underline-offset-2 font-semibold">자세히</span>
                </summary>
                <div
                  className="mt-2 rounded-2xl px-4 py-3.5 text-left"
                  style={{ backgroundColor: "var(--color-surface-alt)" }}
                >
                  <p className="text-[13px] font-bold text-text-main mb-2">
                    스토킹·학대를 막는 3중 위치 보호
                  </p>
                  <ul className="space-y-2 text-[11px] leading-relaxed text-text-sub">
                    <li>
                      <b className="text-text-main">① 등록 순간부터 흐려져요</b> — 등록할 때 서버가
                      좌표를 수백 m 옮겨서 저장해요. 정확한 자리는 저희 서버에도 남지 않아요.
                    </li>
                    <li>
                      <b className="text-text-main">② 마커는 일부러 돌아다녀요</b> — 지금 보이는
                      움직임은 실제 이동이 아니라, 위치를 특정하지 못하게 하는 보호 장치예요.
                      마커를 따라가도 그 자리에 아이가 없어요.
                    </li>
                    <li>
                      <b className="text-text-main">③ 로그인하지 않으면 더 넓게</b> — 비로그인
                      화면에는 최대 1km 가까이 흐려져서 동네 단위로만 보여요.
                    </li>
                  </ul>
                  <p className="text-[11px] leading-relaxed mt-2.5" style={{ color: "var(--color-text-light)" }}>
                    학대 신고가 접수되면 마커에 ⚠️ 경보가 붙어 이웃이 함께 지켜봐요. 아이들을
                    위해 급식소·쉼터의 정확한 위치는 글이나 설명에도 적지 말아주세요
                  </p>
                </div>
              </details>

              {selectedCat.card_flavor && (
                <p
                  className="text-[11px] italic leading-relaxed px-4 py-2.5 text-center"
                  style={{ color: "var(--color-text-light)" }}
                >
                  &ldquo;{selectedCat.card_flavor}&rdquo;
                </p>
              )}
            </div>

            {/* 정보 */}
            <div className="px-5 py-4">
              {/* 📸 오늘의 사진 안내 — 패널 열리자마자 보이게 */}
              {!editingCat && (() => {
                const todayKst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
                const todayPhotoCount = comments.filter(
                  (c) => c.photo_url && new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) === todayKst,
                ).length;
                const hasTodayPhoto = todayPhotoCount > 0;
                return (
                  <Link
                    href={`/cats/${selectedCat.id}`}
                    className="block mb-3 rounded-2xl px-3.5 py-3 press transition-transform"
                    style={{
                      background: hasTodayPhoto
                        ? "linear-gradient(135deg, rgba(91,168,118,0.14) 0%, rgba(107,142,111,0.10) 100%)"
                        : "linear-gradient(135deg, rgba(173, 94, 59,0.16) 0%, rgba(232,176,64,0.10) 100%)",
                      border: hasTodayPhoto
                        ? "1.5px solid rgba(91,168,118,0.35)"
                        : "1.5px dashed rgba(173, 94, 59,0.40)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: hasTodayPhoto ? "rgba(91,168,118,0.22)" : "rgba(173, 94, 59,0.18)",
                        }}
                      >
                        {hasTodayPhoto ? (
                          <Sparkles size={16} style={{ color: "var(--color-sage)" }} />
                        ) : (
                          <Camera size={16} style={{ color: "var(--color-primary)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-bold leading-tight"
                          style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary-dark)" }}
                        >
                          {hasTodayPhoto
                            ? `오늘 ${todayPhotoCount}장 채워졌어요`
                            : `오늘의 ${selectedCat.name} 사진을 올려주세요`}
                        </p>
                        <p
                          className="text-[11px] mt-0.5 leading-snug"
                          style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary-dark)" }}
                        >
                          {hasTodayPhoto
                            ? "다이어리에 차곡차곡 쌓이고 있어요"
                            : "아래 댓글창에서 사진 버튼으로 첨부해보세요"}
                        </p>
                      </div>
                      <BookOpen size={13} className="shrink-0" style={{ color: hasTodayPhoto ? "var(--color-sage)" : "var(--color-primary)" }} />
                    </div>
                  </Link>
                );
              })()}

              {editingCat ? (
                /* ═══ 수정 모드 ═══ */
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">이름</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={20}
                      className="w-full px-3 py-2 rounded-xl text-[15px] outline-none" style={{ backgroundColor: "var(--color-gray-50)", border: "1px solid var(--color-border)" }} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">설명</label>
                    <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: "var(--color-sage)" }}>
                      안전을 위해 정확한 위치(역·출구·시장·공원·아파트·주소 등)는 적지 마세요.
                    </p>
                    <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} maxLength={200}
                      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none"
                      style={{
                        backgroundColor: (editDescViolations.length > 0 || editDescAbuseViolations.length > 0) ? "var(--color-error-soft)" : "var(--color-gray-50)",
                        border: `1px solid ${(editDescViolations.length > 0 || editDescAbuseViolations.length > 0) ? "var(--color-error)" : "var(--color-gray-200)"}`,
                      }} />
                    {editDescViolations.length > 0 && (
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--color-error)" }}>
                        {editDescViolations.map((v) => `${v.label}(${v.match})`).join(", ")} — 일반 표현으로 바꿔주세요.
                      </p>
                    )}
                    {editDescAbuseViolations.length > 0 && (
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--color-error)" }}>
                        {formatAbuseMessage(editDescAbuseViolations)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">동네</label>
                    <input type="text" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} maxLength={20}
                      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "var(--color-gray-50)", border: "1px solid var(--color-border)" }} />
                  </div>

                  {/* 위치 변경 (등록자 본인 + 관리자) */}
                  {(user?.id === selectedCat.caretaker_id || isAdmin) && (
                    <div>
                      <label className="text-[11px] font-bold text-text-sub mb-1 block">지도 위치</label>
                      <button
                        type="button"
                        onClick={() => setPickingLocation(true)}
                        className="w-full px-3 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-between press"
                        style={{
                          backgroundColor: editLat !== null ? "#FFF2E8" : "var(--color-gray-50)",
                          border: editLat !== null ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          color: editLat !== null ? "var(--color-primary)" : "var(--color-text-light)",
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} />
                          {editLat !== null ? "새 위치 선택됨 (저장 시 반영)" : "지도에서 위치 변경"}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                      <p className="text-[11px] text-text-light mt-1">
                        동 단위로 위치를 옮길 수 있어요. 동이 바뀌면 새 동네 이름이 자동으로 입력돼요.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">태그</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CAT_TAG_OPTIONS.map((tag) => {
                        const active = editTags.includes(tag);
                        return (
                          <button key={tag} type="button"
                            onClick={() => setEditTags((prev) => active ? prev.filter((t) => t !== tag) : [...prev, tag])}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all ${active ? "bg-primary text-white" : "bg-surface-alt text-text-sub border border-border"}`}>
                            {active ? "✓ " : ""}{tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 성별/중성화/건강 */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(Object.entries(GENDER_MAP) as [CatGender, { label: string; emoji: string }][]).map(([k, v]) => (
                      <button key={k} type="button" onClick={() => setEditGender(k)}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${editGender === k ? "bg-primary text-white" : "bg-surface-alt text-text-sub border border-border"}`}>
                        {v.emoji} {v.label}
                      </button>
                    ))}
                    <span className="w-px bg-border mx-0.5" />
                    <button type="button" onClick={() => setEditNeutered(editNeutered === true ? null : true)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg ${editNeutered === true ? "bg-primary text-white" : "bg-surface-alt text-text-sub border border-border"}`}>
                      중성화
                    </button>
                    <span className="w-px bg-border mx-0.5" />
                    {(Object.entries(HEALTH_MAP) as [CatHealthStatus, { label: string; emoji: string; color: string }][]).map(([k, v]) => (
                      <button key={k} type="button" onClick={() => setEditHealth(k)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                        style={{ backgroundColor: editHealth === k ? v.color : undefined, color: editHealth === k ? "#fff" : v.color, border: editHealth === k ? "none" : `1px solid ${v.color}40` }}>
                        {v.emoji} {v.label}
                      </button>
                    ))}
                  </div>
                  {/* 입양·임시보호 상태 */}
                  <div className="flex gap-1.5 flex-wrap items-center pt-1">
                    <span className="text-[11px] font-bold text-text-sub mr-1">입양·임보</span>
                    <button type="button" onClick={() => setEditAdoption(null)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                      style={{
                        backgroundColor: editAdoption === null ? "var(--color-gray-100)" : undefined,
                        color: editAdoption === null ? "var(--color-text-light)" : "var(--color-text-light)",
                        border: editAdoption === null ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                      }}>
                      해당 없음
                    </button>
                    {(Object.entries(ADOPTION_MAP) as [Exclude<AdoptionStatus, null>, typeof ADOPTION_MAP["seeking_home"]][]).map(([k, info]) => (
                      <button key={k} type="button" onClick={() => setEditAdoption(k)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                        style={{
                          backgroundColor: editAdoption === k ? info.color : undefined,
                          color: editAdoption === k ? "#fff" : info.color,
                          border: editAdoption === k ? "none" : `1px solid ${info.color}40`,
                        }}>
                        {info.emoji} {info.short}
                      </button>
                    ))}
                  </div>
                  {/* 공개 범위 (Private Circle) */}
                  <div className="pt-2">
                    <label className="text-[11px] font-bold text-text-sub mb-1.5 block">공개 범위</label>
                    <div className="space-y-1">
                      {(Object.entries(VISIBILITY_MAP) as [CatVisibility, typeof VISIBILITY_MAP["public"]][]).map(([k, info]) => {
                        const active = editVisibility === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setEditVisibility(k)}
                            className="w-full p-2.5 rounded-xl text-left flex items-start gap-2 transition-all press"
                            style={{
                              backgroundColor: active ? `${info.color}15` : "var(--color-gray-50)",
                              border: `1.5px solid ${active ? info.color : "var(--color-gray-200)"}`,
                            }}
                          >
                            <span className="text-[15px] leading-none mt-0.5">{info.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold" style={{ color: active ? info.color : "var(--color-gray-800)" }}>
                                {info.label}
                              </p>
                              <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: active ? info.color : "var(--color-text-light)", opacity: active ? 0.85 : 1 }}>
                                {info.description}
                              </p>
                            </div>
                            {active && <span className="text-[13px] shrink-0" style={{ color: info.color }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={async () => {
                        if (!editName.trim()) return;
                        setEditSaving(true);
                        try {
                          const updated = await updateCat(selectedCat.id, {
                            name: editName.trim(),
                            description: editDesc.trim() || undefined,
                            region: editRegion.trim() || undefined,
                            tags: editTags,
                            gender: editGender,
                            neutered: editNeutered,
                            health_status: editHealth,
                            adoption_status: editAdoption,
                            visibility: editVisibility,
                            ...(editLat !== null && editLng !== null
                              ? { lat: editLat, lng: editLng }
                              : {}),
                          });
                          setSelectedCat(updated);
                          setCats((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                          invalidateMapCatsCache();
                          setEditingCat(false);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "수정 실패");
                        } finally {
                          setEditSaving(false);
                        }
                      }}
                      disabled={editSaving || !editName.trim() || editDescViolations.length > 0 || editDescAbuseViolations.length > 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 press-strong transition-all"
                    >
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                    </button>
                    <button onClick={() => { setEditingCat(false); setEditLat(null); setEditLng(null); }} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-text-light)" }}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* ═══ 보기 모드 ═══ */
                <>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h2 className="text-[20px] font-bold text-text-main tracking-tight">
                      {selectedCat.name}
                    </h2>
                    {selectedCat.region && (
                      <span className="text-[13px] text-text-light">
                        {selectedCat.region}에 살아요
                      </span>
                    )}
                  </div>
                  {/* 공개 범위 배지 */}
                  {selectedCat.visibility && selectedCat.visibility !== "public" && (
                    <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 chip-square text-[11px] font-bold"
                        style={{
                          background: `${VISIBILITY_MAP[selectedCat.visibility].color}15`,
                          color: VISIBILITY_MAP[selectedCat.visibility].color,
                          border: `1px solid ${VISIBILITY_MAP[selectedCat.visibility].color}40`,
                        }}
                      >
                        <span>{VISIBILITY_MAP[selectedCat.visibility].emoji}</span>
                        <span>{VISIBILITY_MAP[selectedCat.visibility].label}</span>
                      </span>
                      {/* circle 핀 + 본인 아닌 viewer = 서클 공동 돌봄 안내 */}
                      {selectedCat.visibility === "circle" && user?.id !== selectedCat.caretaker_id && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 chip-square text-[11px] font-bold"
                          style={{ background: "rgba(107,142,111,0.12)", color: "var(--color-sage)", border: "1px solid rgba(107,142,111,0.30)" }}
                        >
                          함께 돌볼 수 있어요
                        </span>
                      )}
                    </div>
                  )}

                  {/* 좋아요 버튼 */}
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleToggleCatLike}
                      disabled={likingCat}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl press-strong transition-transform disabled:opacity-60"
                      style={{
                        background: likedCatIds.has(selectedCat.id)
                          ? "var(--color-like)"
                          : "var(--color-gray-50)",
                        color: likedCatIds.has(selectedCat.id) ? "#fff" : "var(--color-text-light)",
                        boxShadow: likedCatIds.has(selectedCat.id)
                          ? "0 3px 10px rgba(232,107,140,0.35)"
                          : "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                      aria-label={likedCatIds.has(selectedCat.id) ? "좋아요 취소" : "좋아요"}
                    >
                      <Heart
                        size={13}
                        strokeWidth={2.5}
                        fill={likedCatIds.has(selectedCat.id) ? "#fff" : "none"}
                      />
                      <span className="text-[13px] font-bold">
                        {selectedCat.like_count ?? 0}
                      </span>
                    </button>
                    {/* 학대경보 원터치 토글 — 켜면 48h 마커 경보, 끄면 내 경보 삭제 */}
                    <button
                      type="button"
                      onClick={handleToggleAbuseAlert}
                      disabled={togglingAlert}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl press-strong transition-transform disabled:opacity-60"
                      style={{
                        background: myActiveAlert ? "var(--color-error)" : "var(--color-gray-50)",
                        color: myActiveAlert ? "#fff" : "var(--color-text-light)",
                        border:
                          !myActiveAlert && alertedCats.has(selectedCat.id)
                            ? "1px solid var(--color-error)"
                            : "none",
                        boxShadow: myActiveAlert
                          ? "0 3px 10px rgba(240,68,82,0.35)"
                          : "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                      aria-label={myActiveAlert ? "학대경보 해제" : "학대경보 켜기"}
                    >
                      {togglingAlert ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <AlertTriangle size={13} strokeWidth={2.5} />
                      )}
                      <span className="text-[13px] font-bold">
                        {myActiveAlert ? "경보 중" : "학대경보"}
                      </span>
                    </button>
                    {(selectedCat.like_count ?? 0) > 0 && (
                      <span className="text-[11px] text-text-light font-semibold">
                        {likedCatIds.has(selectedCat.id)
                          ? "마음이 전해졌어요"
                          : `${selectedCat.like_count}명이 응원해요`}
                      </span>
                    )}
                    {/* 공유 버튼들 */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {/* 카카오톡 공유 */}
                      <button
                        type="button"
                        onClick={handleShareCatToKakao}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl press-strong transition-transform"
                        style={{
                          background: "#FEE500",
                          color: "#3C1E1E",
                          boxShadow: "0 2px 6px rgba(254,229,0,0.45)",
                        }}
                        aria-label="카카오톡으로 공유"
                      >
                        <span className="text-[11px] font-bold">카톡</span>
                      </button>
                      {/* 기본 공유 / 복사 */}
                      <button
                        type="button"
                        onClick={handleShareCat}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl press-strong transition-transform"
                        style={{
                          background: shareStatus === "copied" ? "var(--color-sage)" : "var(--color-gray-50)",
                          color: shareStatus === "copied" ? "#fff" : "var(--color-text-light)",
                          boxShadow: "var(--shadow-card-sm)",
                        }}
                        aria-label="공유"
                      >
                        {shareStatus === "copied" ? (
                          <>
                            <Check size={12} strokeWidth={2.5} />
                            <span className="text-[11px] font-bold">복사됨</span>
                          </>
                        ) : (
                          <>
                            <Share2 size={12} strokeWidth={2.5} />
                            <span className="text-[11px] font-bold">공유</span>
                          </>
                        )}
                      </button>
                      {/* QR 코드 — 종이로 인쇄해 동네 오프라인 공유 */}
                      <button
                        type="button"
                        onClick={() => setQrModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl press-strong transition-transform"
                        style={{ background: "var(--color-gray-800)", color: "#fff", boxShadow: "var(--shadow-raised)" }}
                        aria-label="QR 코드"
                      >
                        <span style={{ fontSize: 13 }}>▦</span>
                        <span className="text-[11px] font-bold">QR</span>
                      </button>
                    </div>
                  </div>

                  {/* 프로필 뱃지: 성별 · 중성화 · 건강 */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedCat.gender && selectedCat.gender !== "unknown" && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-text-sub)" }}>
                        {GENDER_MAP[selectedCat.gender]?.emoji} {GENDER_MAP[selectedCat.gender]?.label}
                      </span>
                    )}
                    {selectedCat.neutered != null && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: selectedCat.neutered ? "var(--color-sage-soft)" : "var(--color-care-soft)", color: selectedCat.neutered ? "var(--color-sage)" : "var(--color-care)" }}>
                        {selectedCat.neutered ? "중성화 완료" : "중성화 필요"}
                      </span>
                    )}
                    {selectedCat.health_status && selectedCat.health_status !== "good" && (() => {
                      const h = HEALTH_MAP[selectedCat.health_status];
                      return (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${h.color}18`, color: h.color }}>
                          {h.emoji} {h.label}
                        </span>
                      );
                    })()}
                  </div>

                  {selectedCat.description && (
                    <p className="text-[15px] text-text-sub leading-relaxed mb-3">
                      {selectedCat.description}
                    </p>
                  )}
                  {selectedCat.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCat.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: "var(--color-gray-100)", color: "var(--color-primary)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ══ 학대/위험 신고 빠른 대응 ══ */}
              {alertCount > 0 && (
                <div
                  className="mt-4 rounded-2xl p-3"
                  style={{ backgroundColor: "var(--color-error-soft)", border: "1px solid var(--color-error)" }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={14} style={{ color: "var(--color-error)" }} />
                    <span className="text-[13px] font-bold" style={{ color: "var(--color-error)" }}>
                      위험 상황 {alertCount}건 신고됨 — 빠른 대응
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <a
                      href="tel:112"
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform press-strong"
                      style={{ backgroundColor: "var(--color-error)" }}
                    >
                      <Phone size={14} color="#fff" />
                      <span className="text-[11px] font-bold text-white">112 신고</span>
                    </a>
                    <a
                      href="tel:1577-0954"
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform press-strong"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      <Phone size={14} color="#fff" />
                      <span className="text-[11px] font-bold text-white">동물보호</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyAlertRecord}
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform press-strong"
                      style={{ backgroundColor: "var(--color-sage)" }}
                    >
                      {copyStatus === "copied" ? (
                        <Check size={14} color="#fff" />
                      ) : (
                        <Copy size={14} color="#fff" />
                      )}
                      <span className="text-[11px] font-bold text-white">
                        {copyStatus === "copied" ? "복사됨" : "기록 복사"}
                      </span>
                    </button>
                  </div>
                  <p
                    className="text-[11px] mt-2 leading-relaxed"
                    style={{ color: "var(--color-error)" }}
                  >
                    112: 긴급 학대 현장 · 1577-0954: 동물보호상담센터
                  </p>
                </div>
              )}

              {/* ══ 탭: 돌봄다이어리 | 커뮤니티 ══ */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--color-gray-100)" }}>
                <div className="flex gap-1 mb-3 px-1">
                  <button
                    type="button"
                    onClick={() => setCatCardTab("carelog")}
                    className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all"
                    style={{
                      backgroundColor: catCardTab === "carelog" ? "var(--color-primary)" : "var(--color-gray-50)",
                      color: catCardTab === "carelog" ? "#fff" : "var(--color-text-light)",
                    }}
                  >
                    돌봄다이어리
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatCardTab("community")}
                    className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all"
                    style={{
                      backgroundColor: catCardTab === "community" ? "var(--color-primary)" : "var(--color-gray-50)",
                      color: catCardTab === "community" ? "#fff" : "var(--color-text-light)",
                    }}
                  >
                    커뮤니티 {comments.length > 0 && `· ${comments.length}`}
                  </button>
                  {selectedCat.card_generated_at && (
                    <button
                      type="button"
                      onClick={() => setCatCardTab("card")}
                      className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all"
                      style={{
                        backgroundColor: catCardTab === "card" ? "#6366F1" : "#F0F0FF",
                        color: catCardTab === "card" ? "#fff" : "#6366F1",
                      }}
                    >
                      🃏 카드
                    </button>
                  )}
                </div>

                {/* 돌봄다이어리 탭 */}
                {catCardTab === "carelog" && (
                  <CareLogTab catId={selectedCat.id} isLoggedIn={isLoggedIn} currentUserId={user?.id} />
                )}

                {/* CatchCat 카드 탭 */}
                {catCardTab === "card" && selectedCat.card_generated_at && (
                  <div className="flex flex-col items-center py-3">
                    <CatCard
                      name={selectedCat.name}
                      photoUrl={selectedCat.photo_url}
                      card={{
                        card_rarity: (selectedCat.card_rarity ?? "common") as import("@/app/components/CatCard").CardRarity,
                        card_name: selectedCat.card_name,
                        card_traits: selectedCat.card_traits ?? [],
                        card_stats: selectedCat.card_stats,
                        card_flavor: selectedCat.card_flavor,
                        card_level: selectedCat.card_level,
                        card_exp: selectedCat.card_exp,
                        card_generated_at: selectedCat.card_generated_at,
                        best_win_streak: selectedCat.best_win_streak,
                        pve_win_count: selectedCat.pve_win_count,
                      }}
                      size="md"
                    />
                  </div>
                )}

                {/* 커뮤니티 탭 (기존 댓글) */}
                <div style={{ display: catCardTab === "community" ? "block" : "none" }}>
                {/* 댓글 목록 (최대 높이 제한, 스크롤) */}
                <div className="max-h-[180px] overflow-y-auto -mx-1 px-1 space-y-2">
                  {commentsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={14} className="text-text-light animate-spin" />
                    </div>
                  )}
                  {!commentsLoading && comments.length === 0 && !commentsError && (
                    <p className="text-[13px] text-text-light text-center py-3">
                      아직 기록이 없어요. 첫 기록을 남겨보세요.
                    </p>
                  )}
                  {comments.map((c) => {
                    const isAlert = c.kind === "alert";
                    return (
                      <div
                        key={c.id}
                        className="rounded-xl px-3 py-2"
                        style={{
                          backgroundColor: isAlert ? "var(--color-error-soft)" : "var(--color-gray-50)",
                          borderLeft: isAlert ? "3px solid var(--color-error)" : "none",
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isAlert && (
                            <AlertTriangle size={11} style={{ color: "var(--color-error)" }} />
                          )}
                          {/* 작성자 아바타 */}
                          {c.author_avatar_url ? (
                            <img
                              src={thumbnailUrl(c.author_avatar_url, 40) ?? c.author_avatar_url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-5 h-5 rounded-full object-cover shrink-0"
                              style={{ border: "1.5px solid #fff", boxShadow: "var(--shadow-raised)" }}
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: isAlert ? "var(--color-error-soft)" : "var(--color-gray-100)",
                                border: "1.5px solid #fff",
                              }}
                            >
                              <span
                                className="text-[9px] font-bold"
                                style={{ color: isAlert ? "var(--color-error)" : "var(--color-primary)" }}
                              >
                                {c.author_name?.charAt(0) ?? "?"}
                              </span>
                            </div>
                          )}
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: isAlert ? "var(--color-error)" : "var(--color-primary)" }}
                          >
                            {c.author_name ?? "익명"}
                          </span>
                          {c.author_level && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-[1px] rounded-md tabular-nums"
                              style={{
                                backgroundColor: getLevelColor(c.author_level),
                                color: "#FFFFFF",
                                boxShadow: `0 1px 3px ${getLevelColor(c.author_level)}55`,
                              }}
                            >
                              Lv.{c.author_level}
                            </span>
                          )}
                          <TitleBadge titleId={c.author_title} />

                          <span className="text-[11px] text-text-light ml-auto">
                            {formatRelativeTime(c.created_at)}
                          </span>
                          {user?.id === c.author_id && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm("이 댓글을 삭제할까요?")) return;
                                try {
                                  await deleteComment(c.id);
                                  setComments((prev) => prev.filter((cm) => cm.id !== c.id));
                                } catch { toast.error("삭제 실패"); }
                              }}
                              className="ml-1 text-text-light press-strong"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        {c.body && (
                          <p
                            className="text-[13px] leading-relaxed"
                            style={{ color: isAlert ? "var(--color-error)" : "var(--color-gray-700)" }}
                          >
                            {c.body}
                          </p>
                        )}
                        {c.photo_url && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(c.photo_url)}
                            className="mt-2 block rounded-xl overflow-hidden press transition-transform"
                            style={{
                              width: "100%",
                              maxWidth: 220,
                              aspectRatio: "4 / 3",
                              backgroundColor: "var(--color-gray-100)",
                            }}
                          >
                            <img
                              src={thumbnailUrl(c.photo_url, 440) ?? c.photo_url}
                              alt="돌봄 기록 사진"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </button>
                        )}
                        {/* 이모지 리액션 */}
                        <div className="mt-2">
                          <ReactionBar
                            targetType="cat_comment"
                            targetId={c.id}
                            summary={commentReactions.get(c.id)}
                            isLoggedIn={isLoggedIn}
                            onChange={(id, next) => {
                              setCommentReactions((prev) => {
                                const m = new Map(prev);
                                m.set(id, next);
                                return m;
                              });
                            }}
                            onRequireLogin={() => {
                              if (confirm("로그인하면 반응을 남길 수 있어요. 로그인할까요?")) {
                                window.location.href = "/login";
                              }
                            }}
                          />
                        </div>

                        {/* 좋아요/싫어요 버튼 */}
                        <div className="flex items-center gap-1.5 mt-2">
                          {(() => {
                            const myVote = myVotes.get(c.id) ?? 0;
                            const liked = myVote === 1;
                            const disliked = myVote === -1;
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleVoteComment(c.id, 1)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg press-strong transition-all"
                                  style={{
                                    backgroundColor: liked ? "var(--color-sage)" : "var(--color-surface)",
                                    border: `1px solid ${liked ? "var(--color-sage)" : "var(--color-gray-200)"}`,
                                    color: liked ? "#FFFFFF" : "var(--color-sage)",
                                  }}
                                  aria-label="좋아요"
                                >
                                  <ThumbsUp size={11} strokeWidth={2.2} fill={liked ? "#FFFFFF" : "none"} />
                                  <span className="text-[11px] font-bold tabular-nums">
                                    {c.like_count}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVoteComment(c.id, -1)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg press-strong transition-all"
                                  style={{
                                    backgroundColor: disliked ? "var(--color-gray-500)" : "var(--color-surface)",
                                    border: `1px solid ${disliked ? "var(--color-gray-500)" : "var(--color-gray-200)"}`,
                                    color: disliked ? "#FFFFFF" : "var(--color-text-light)",
                                  }}
                                  aria-label="싫어요"
                                >
                                  <ThumbsDown size={11} strokeWidth={2.2} fill={disliked ? "#FFFFFF" : "none"} />
                                  <span className="text-[11px] font-bold tabular-nums">
                                    {c.dislike_count}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReportTarget({
                                      id: c.id,
                                      type: "comment",
                                      snapshot: c.body?.slice(0, 200) ?? "",
                                      authorUserId: c.author_id ?? null,
                                      authorName: c.author_name ?? null,
                                    })
                                  }
                                  className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg press-strong transition-transform"
                                  style={{
                                    backgroundColor: "var(--color-surface)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                  aria-label="신고"
                                  title="신고하기"
                                >
                                  <Flag size={11} style={{ color: "var(--color-text-light)" }} strokeWidth={2.2} />
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {commentsError && (
                  <p className="text-[11px] mt-2" style={{ color: "var(--color-error)" }}>
                    {commentsError}
                  </p>
                )}

                {/* 사진 프리뷰 (선택됐을 때만) */}
                {commentPhotoPreview && (
                  <div className="mt-3 relative inline-block">
                    <img
                      src={commentPhotoPreview}
                      alt="선택된 사진"
                      className="rounded-xl object-cover"
                      style={{ width: 80, height: 80 }}
                    />
                    <button
                      type="button"
                      onClick={clearCommentPhoto}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-text-main flex items-center justify-center shadow-md"
                    >
                      <X size={11} color="#fff" strokeWidth={3} />
                    </button>
                  </div>
                )}

                {/* 숨겨진 파일 input */}
                <input
                  ref={commentFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCommentPhotoPick}
                />

                {/* 모드 안내 — alert 모드 켜졌을 때 강조 박스 */}
                {commentKind === "alert" ? (
                  <div
                    className="mt-3 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: "var(--color-error-soft)", border: "1.5px solid var(--color-error)" }}
                  >
                    <p className="text-[13px] font-bold leading-snug" style={{ color: "var(--color-error)" }}>
                      학대·위험 신고 모드
                    </p>
                    <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "var(--color-error)" }}>
                      지금 남기는 기록은 <b>학대/위험 신고</b>로 표시돼요. 2건 이상 쌓이면 마커에 경보 라벨이 뜨고,
                      112·동물보호상담센터 연락·신고 기록 복사 버튼이 자동 활성화돼요. 일반 돌봄 기록은 왼쪽 ⚠️
                      버튼을 다시 눌러 해제.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-text-light leading-relaxed px-1">
                    왼쪽 <b style={{ color: "var(--color-error)" }}>⚠️</b> 버튼을 누르면 <b>학대·위험 신고 모드</b>로 바뀌어요.
                    신고 누적 시 동네 이웃에게 즉시 알리는 용도.
                  </p>
                )}

                {/* 댓글 입력 */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCommentKind((k) => (k === "note" ? "alert" : "note"))
                    }
                    className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor:
                        commentKind === "alert" ? "var(--color-error-soft)" : "var(--color-gray-100)",
                      color: commentKind === "alert" ? "var(--color-error)" : "var(--color-text-light)",
                      border: commentKind === "alert" ? "1.5px solid var(--color-error)" : "none",
                    }}
                    aria-label={commentKind === "alert" ? "학대 신고 모드 해제" : "학대 신고 모드로 전환"}
                    title={commentKind === "alert" ? "학대 신고 모드 (끄려면 클릭)" : "학대·위험 신고 모드로 전환"}
                  >
                    <AlertTriangle size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => commentFileInputRef.current?.click()}
                    className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: commentPhotoFile ? "var(--color-sage-soft)" : "var(--color-gray-100)",
                      color: commentPhotoFile ? "var(--color-sage)" : "var(--color-text-light)",
                    }}
                    title="사진 첨부"
                    disabled={submittingComment}
                  >
                    <Camera size={14} />
                  </button>
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmitComment();
                    }}
                    placeholder={
                      commentKind === "alert"
                        ? "학대/위험 상황을 알려주세요"
                        // 이 입력창은 cat_comments 에 저장된다 — 옆 "돌봄다이어리" 탭(care_logs)에는
                        // 나타나지 않는다. "돌봄 기록"이라고 쓰면 같은 시트 안에 같은 이름의
                        // 입력창이 두 개가 되고, 여기 쓴 글이 기록에서 사라진 것처럼 보인다. (2026-08-09)
                        : "이 아이 이야기를 남겨주세요"
                    }
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[13px] outline-none"
                    style={{ backgroundColor: "var(--color-gray-50)", color: "var(--color-gray-900)" }}
                    disabled={submittingComment}
                  />
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    disabled={(!newComment.trim() && !commentPhotoFile) || submittingComment}
                    className="shrink-0 w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 transition-opacity"
                  >
                    {submittingComment ? (
                      <Loader2 size={14} className="text-white animate-spin" />
                    ) : (
                      <Send size={14} color="#fff" />
                    )}
                  </button>
                </div>
              </div>
            </div>
              </div>
          </div>
        </div>
      )}

      {/* 사진 확대 라이트박스 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={optimizedImageUrl(lightboxUrl, 1200, 80) ?? lightboxUrl}
            alt="확대 사진"
            className="max-w-full max-h-full rounded-2xl"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center press-strong transition-transform shadow-md"
            aria-label="닫기"
          >
            <X size={20} className="text-text-sub" />
          </button>
        </div>
      )}

      {/* 신고 모달 */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type ?? "comment"}
        targetId={reportTarget?.id ?? ""}
        targetSnapshot={reportTarget?.snapshot}
        authorUserId={reportTarget?.authorUserId ?? null}
        authorName={reportTarget?.authorName ?? null}
      />

      {/* 등록 시작 전 공개 범위 안내 시트 — 매번 노출 */}
      <VisibilityIntroSheet
        open={visibilityIntroOpen}
        onClose={() => setVisibilityIntroOpen(false)}
        onPick={(v) => {
          setPickedVisibility(v);
          setVisibilityIntroOpen(false);
          setAddModalOpen(true);
        }}
      />

      {/* 등록 모달 */}
      <AddCatModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleCatCreated}
        initialLat={pickedCoord?.lat}
        initialLng={pickedCoord?.lng}
        initialVisibility={pickedVisibility}
        showDiscoverySteps={SHOW_MAP_DISCOVERY}
        duplicateCandidates={cats}
      />

      {/* QR 코드 모달 — 오프라인 공유 */}
      {selectedCat && (
        <CatQRModal
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          catId={selectedCat.id}
          catName={selectedCat.name}
        />
      )}

      {/* 고양이 위치 변경 Picker (등록자 본인 + 관리자) */}
      {selectedCat && (user?.id === selectedCat.caretaker_id || isAdmin) && (
        <CatLocationPicker
          open={pickingLocation}
          initialLat={editLat ?? selectedCat.lat}
          initialLng={editLng ?? selectedCat.lng}
          initialRegion={editRegion || selectedCat.region || null}
          catName={editName || selectedCat.name}
          onCancel={() => setPickingLocation(false)}
          onConfirm={({ lat, lng, region }) => {
            setEditLat(lat);
            setEditLng(lng);
            setEditRegion(region);
            setPickingLocation(false);
          }}
        />
      )}
    </div>
    </>
  );
}
