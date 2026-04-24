"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  MapPin,
  Heart,
  Plus,
  Loader2,
  Send,
  AlertTriangle,
  MessageCircle,
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
  LocateFixed,
  Stethoscope,
  Clock,
  ChevronRight,
  Pencil,
  Save,
  Share2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import AddCatModal from "@/app/components/AddCatModal";
import ReportModal from "@/app/components/ReportModal";
import {
  listCats,
  listComments,
  createComment,
  uploadCommentPhoto,
  listAlertedCatIds,
  getDisplayCoord,
  voteComment,
  getMyCommentVotes,
  getLevelColor,
  MAP_CENTER,
  type Cat,
  type CatComment,
  type CommentKind,
  type VoteValue,
} from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/app/components/Toast";
import { sanitizeImageUrl } from "@/lib/url-validate";
import TitleBadge from "@/app/components/TitleBadge";
import SendDMButton from "@/app/components/SendDMButton";
import { listRescueHospitals, type RescueHospital } from "@/lib/hospitals-repo";
import type { Post } from "@/lib/types";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import CareLogTab from "@/app/components/CareLogTab";
import { getDisplayName as getChatDisplayName, updateCat, deleteCat, deleteComment, toggleCatLike, listMyLikedCatIds, GENDER_MAP, HEALTH_MAP, ADOPTION_MAP, type CatGender, type CatHealthStatus, type AdoptionStatus } from "@/lib/cats-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listMyActivityRegions,
  type ActivityRegion,
} from "@/lib/activity-regions-repo";
import Link from "next/link";
import { shareToKakao } from "@/lib/kakao-share";
import MapCoachmark from "@/app/components/MapCoachmark";
import ReactionBar from "@/app/components/ReactionBar";
import { listReactionsBatch, type ReactionSummary } from "@/lib/reactions-repo";
import CatLocationPicker from "@/app/components/CatLocationPicker";

const CAT_TAG_OPTIONS = [
  "TNR 완료","TNR 필요","이어팁","사람 친화","겁 많음","성묘",
  "어린 고양이","새끼 동반","야행성","온순","예민","식탐 많음",
];

declare global {
  interface Window {
    kakao: any;
  }
}

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

export default function MapPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isLoggedIn = !!user;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Cat | null>(null);
  const [catCardTab, setCatCardTab] = useState<"carelog" | "community">("carelog");
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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  type CatFilter = "all" | "tnr_needed" | "neutered" | "health_concern" | "alert";
  const [catFilter, setCatFilter] = useState<CatFilter>("all");

  // ── 활동 지역 ──
  const [activityRegions, setActivityRegions] = useState<ActivityRegion[]>([]);
  // 'all' = 전체, 1|2 = 해당 슬롯만 필터
  const [regionFilter, setRegionFilter] = useState<"all" | 1 | 2>("all");
  const regionCirclesRef = useRef<any[]>([]);

  const [cats, setCats] = useState<Cat[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catsError, setCatsError] = useState("");
  const [alertedCats, setAlertedCats] = useState<Set<string>>(new Set());
  const [abuseCardExpanded, setAbuseCardExpanded] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // 병원 오버레이 (항상 표시)
  const [hospitals, setHospitals] = useState<RescueHospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<RescueHospital | null>(null);
  const hospitalOverlaysRef = useRef<any[]>([]);

  // 현재 구 감지 + 채팅
  const [currentGu, setCurrentGu] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id:string;area:string;author_id:string|null;author_name:string|null;author_avatar_url?:string|null;author_level?:number|null;body:string;created_at:string}[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 채팅 메시지 전송: 즉시 화면 표시 + DB 저장
  const handleChatSend = async () => {
    if (!currentGu || !chatText.trim() || chatSending || !user) return;
    const body = chatText.trim();
    setChatText("");
    setChatSending(true);

    // 낙관적 업데이트: 보내는 즉시 화면에 표시
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      area: currentGu,
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
          area: currentGu,
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

  // 채팅방: 히스토리 로드 + 1초 폴링 (다른 사람 메시지 실시간 수신)
  useEffect(() => {
    if (!chatOpen || !currentGu) return;

    // ★ 구가 바뀌면 이전 구 메시지를 즉시 비운다 (크로스 구 유출 방지)
    setChatMessages([]);

    const supabase = createSupabaseClient();
    const fetchArea = currentGu; // 이 effect가 담당하는 구 — 폴링 중 값 고정
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
        .limit(50) as { data: any };

      if (!active) return;
      // 혹시 모를 경쟁 상태: 응답이 도착했을 때 이미 다른 구로 바뀌었다면 무시
      if (fetchArea !== currentGu) return;

      const msgs: any[] = (data ?? []).filter((m: any) => m.area === fetchArea);

      const newLastId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";
      const needsUpdate = !firstFetchDone || msgs.length !== lastCount || newLastId !== lastId;
      if (!needsUpdate) return;

      firstFetchDone = true;
      lastCount = msgs.length;
      lastId = newLastId;

      setChatMessages((prev) => {
        // temp- 메시지(낙관적)는 아직 DB에 없고 현재 구에 속한 것만 유지
        const tempMsgs = prev.filter((m) => m.id.startsWith("temp-") && m.area === fetchArea);
        const remainingTemp = tempMsgs.filter(
          (t) => !msgs.some((m: any) => m.author_id === t.author_id && m.body === t.body),
        );
        return [...msgs, ...remainingTemp];
      });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [chatOpen, currentGu]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | undefined>();

  // ── 댓글 상태 ──
  const [comments, setComments] = useState<CatComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>("note");
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

  // 선택된 고양이 변경 시 댓글 로드
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
    listComments(selectedCat.id)
      .then(async (list) => {
        if (cancelled) return;
        setComments(list);
        // 내가 누른 투표들 로드
        if (isLoggedIn && list.length > 0) {
          const votes = await getMyCommentVotes(list.map((c) => c.id));
          if (!cancelled) setMyVotes(votes);
        } else {
          setMyVotes(new Map());
        }
        // 이모지 리액션 배치 조회 (로그인 여부와 무관, 카운트는 공개)
        if (list.length > 0) {
          const reactions = await listReactionsBatch("cat_comment", list.map((c) => c.id));
          if (!cancelled) setCommentReactions(reactions);
        } else {
          setCommentReactions(new Map());
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCommentsError(err instanceof Error ? err.message : "불러오기 실패");
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
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

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── DB에서 고양이 목록 + 학대 신고 목록 불러오기 ──
  const fetchCats = useCallback(async () => {
    setLoadingCats(true);
    setCatsError("");
    try {
      const [data, alertedIds] = await Promise.all([
        listCats(),
        listAlertedCatIds(2),
      ]);
      setCats(data);
      setAlertedCats(alertedIds);
    } catch (err) {
      setCatsError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    fetchCats();
    listRescueHospitals().then(setHospitals).catch(() => {});
    isCurrentUserAdmin().then(setIsAdmin).catch(() => {});
    // 방문자 카운트 (비회원 포함)
    fetch("/api/visit", { method: "POST" }).catch(() => {});
    fetch("/api/visit").then((r) => r.json()).then((d) => setTodayVisit(d.today)).catch(() => {});
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => waitForSdk();
    script.onerror = () =>
      setMapError("지도를 불러올 수 없어요. 네트워크를 확인해주세요.");
    document.head.appendChild(script);
  }, [apiKey]);

  // ── 접속 시 GPS 위치 요청 (거부해도 기본 중심으로 폴백) ──
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.log("[map] geolocation denied or failed:", err.message);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
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
      const initialCenter = userPos ?? (primary ? { lat: primary.lat, lng: primary.lng } : MAP_CENTER);
      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
        level: 6,
      });
      mapInstanceRef.current = map;

      // 지도 길게 누르기 → 좌표 추출 → 등록 모달 열기
      // (kakao.maps에는 longpress 이벤트가 없어서 클릭으로 대체)
      window.kakao.maps.event.addListener(map, "rightclick", (e: any) => {
        const latlng = e.latLng;
        setPickedCoord({ lat: latlng.getLat(), lng: latlng.getLng() });
        setAddModalOpen(true);
      });

      // 지도 이동/줌 끝날 때 현재 구 감지 (시·도 + 구 조합으로 유니크하게)
      const detectGu = () => {
        if (!window.kakao?.maps?.services) return;
        const center = map.getCenter();
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result: any, status: any) => {
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

    const coord = getDisplayCoord(cat, isLoggedIn);
    const map = mapInstanceRef.current;
    map.setCenter(new window.kakao.maps.LatLng(coord.lat, coord.lng));
    map.setLevel(3);
    setSelectedCat(cat);
    setCatCardTab("carelog");

    // 쿼리 제거 — 다음 렌더에서 재실행 방지 + 뒤로가기 깔끔
    url.searchParams.delete("cat");
    window.history.replaceState({}, "", url.toString());
  }, [mapReady, cats, isLoggedIn]);

  // ── 지도 초기화 후에 GPS가 뒤늦게 도착하면 중심 이동 (단, cat 포커스 중이면 스킵) ──
  useEffect(() => {
    if (!mapReady || !userPos || !mapInstanceRef.current || !window.kakao) return;
    if (catFocusHandledRef.current) return;
    const map = mapInstanceRef.current;
    map.setCenter(new window.kakao.maps.LatLng(userPos.lat, userPos.lng));
  }, [mapReady, userPos]);

  // ── 내 위치 마커 (파란 점 + 펄스 링) ──
  const userLocationOverlayRef = useRef<any>(null);
  useEffect(() => {
    if (!mapReady || !userPos || !window.kakao) return;
    const map = mapInstanceRef.current;

    // 기존 마커 제거
    if (userLocationOverlayRef.current) {
      userLocationOverlayRef.current.setMap(null);
    }

    // 한 번만 펄스 keyframes 주입
    if (!document.getElementById("__user_location_pulse_css")) {
      const style = document.createElement("style");
      style.id = "__user_location_pulse_css";
      style.textContent = `
        @keyframes dosi-user-pulse {
          0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0;    }
        }
      `;
      document.head.appendChild(style);
    }

    const el = document.createElement("div");
    el.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";
    el.innerHTML = `
      <div style="
        position:absolute;left:50%;top:50%;
        transform:translate(-50%,-50%);
        width:18px;height:18px;border-radius:50%;
        background:#4A90E2;
        box-shadow:0 0 0 3px rgba(255,255,255,0.95), 0 2px 6px rgba(0,0,0,0.25);
        z-index:2;
      "></div>
      <div style="
        position:absolute;left:50%;top:50%;
        width:18px;height:18px;border-radius:50%;
        background:rgba(74,144,226,0.35);
        animation:dosi-user-pulse 1.8s ease-out infinite;
        z-index:1;
      "></div>
    `;

    const ov = new window.kakao.maps.CustomOverlay({
      map,
      position: new window.kakao.maps.LatLng(userPos.lat, userPos.lng),
      content: el,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 100,
    });
    userLocationOverlayRef.current = ov;

    return () => {
      if (userLocationOverlayRef.current) {
        userLocationOverlayRef.current.setMap(null);
        userLocationOverlayRef.current = null;
      }
    };
  }, [mapReady, userPos]);

  // ── 활동 지역 Circle 오버레이 ──
  useEffect(() => {
    if (!mapReady || !window.kakao) return;
    regionCirclesRef.current.forEach((ov) => ov.setMap(null));
    regionCirclesRef.current = [];

    if (activityRegions.length === 0) return;

    activityRegions.forEach((r) => {
      const color = r.slot === 1 ? "#C47E5A" : "#4A7BA8";
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

      // 지역 이름 라벨
      const labelEl = document.createElement("div");
      labelEl.innerHTML = `
        <div style="transform:translate(-50%,-50%);padding:3px 10px;border-radius:12px;background:${color}dd;color:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 6px ${color}66;white-space:nowrap;opacity:${active ? 1 : 0.5};">
          📍 ${r.name}
        </div>
      `;
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

  // ── 고양이 수정 모드 ──
  const [editingCat, setEditingCat] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editGender, setEditGender] = useState<CatGender>("unknown");
  const [editNeutered, setEditNeutered] = useState<boolean | null>(null);
  const [editHealth, setEditHealth] = useState<CatHealthStatus>("good");
  const [editAdoption, setEditAdoption] = useState<AdoptionStatus>(null);
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

  // ── cats를 동 단위로 그룹화 → 클러스터 마커 ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;

    overlaysRef.current.forEach((ov) => ov.setMap(null));
    overlaysRef.current = [];

    if (!showCats) return;

    // 검색어 + 속성 필터 적용
    const q = searchQ.trim().toLowerCase();
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

    // region(동)별 그룹핑 — 고양이는 전부 표시 (활동 지역은 Circle 시각 표시만)
    const groups = new Map<string, Cat[]>();
    filtered.forEach((cat) => {
      const dong = cat.region || "기타";
      if (!groups.has(dong)) groups.set(dong, []);
      groups.get(dong)!.push(cat);
    });

    const geocoder = window.kakao.maps?.services
      ? new window.kakao.maps.services.Geocoder()
      : null;

    groups.forEach((dongCats, dong) => {
      if (dong === "기타" || !geocoder) {
        // region이 없는 고양이는 원래 좌표 사용 (개별 마커)
        dongCats.forEach((cat) => {
          const coord = getDisplayCoord(cat, isLoggedIn);
          const pos = new window.kakao.maps.LatLng(coord.lat, coord.lng);
          const photoUrl = sanitizeImageUrl(cat.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
          const isAlerted = alertedCats.has(cat.id);
          const borderColor = isAlerted ? "#D85555" : "#C47E5A";

          const el = document.createElement("div");
          el.innerHTML = `
            <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;">
              <div style="width:48px;height:48px;border-radius:50%;border:3px solid ${borderColor};background:white;box-shadow:0 4px 12px ${borderColor}55;overflow:hidden;background-image:url('${photoUrl}');background-size:cover;background-position:center;"></div>
              <div style="width:10px;height:10px;background:${borderColor};transform:rotate(45deg);margin-top:-7px;"></div>
            </div>
          `;
          el.onclick = () => {
            if (!isLoggedIn) { if (confirm("로그인하면 고양이 정보를 볼 수 있어요. 로그인할까요?")) window.location.href = "/login"; return; }
            setSelectedCat(cat); setCatCardTab("carelog");
          };
          const ov = new window.kakao.maps.CustomOverlay({ map: mapInstanceRef.current, position: pos, content: el, yAnchor: 1, zIndex: 10 });
          overlaysRef.current.push(ov);
        });
        return;
      }

      // 동 이름으로 중심 좌표 얻기
      const hasAlert = dongCats.some((c) => alertedCats.has(c.id));
      const tnrNeeded = dongCats.some((c) => (c.tags ?? []).some((t) => t.includes("TNR 필요")));
      const clusterColor = hasAlert ? "#D85555" : tnrNeeded ? "#E88D5A" : "#C47E5A";
      const count = dongCats.length;

      // 첫 번째 고양이의 좌표를 동 대표 좌표로 사용 (Geocoder보다 빠르고 정확)
      const repCat = dongCats[0];
      const repCoord = getDisplayCoord(repCat, isLoggedIn);
      const pos = new window.kakao.maps.LatLng(repCoord.lat, repCoord.lng);

      // 대표 사진 (최대 3개)
      const photos = dongCats.slice(0, 3).map((c) =>
        sanitizeImageUrl(c.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F")
      );

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          ${hasAlert ? `<div style="background:linear-gradient(135deg,#D85555,#B84545);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(216,85,85,0.5);margin-bottom:4px;animation:alert-pulse 1.6s ease-in-out infinite;">⚠️ 학대경보</div>` : ""}
          <div style="display:flex;gap:-8px;align-items:center;">
            ${photos.map((url, i) => `
              <div style="width:${i === 0 ? 52 : 40}px;height:${i === 0 ? 52 : 40}px;border-radius:50%;border:3px solid ${i === 0 ? clusterColor : "#fff"};background:white;box-shadow:0 3px 10px rgba(0,0,0,0.15);overflow:hidden;background-image:url('${url}');background-size:cover;background-position:center;margin-left:${i > 0 ? "-12px" : "0"};z-index:${3 - i};position:relative;"></div>
            `).join("")}
          </div>
          <div style="margin-top:4px;padding:3px 12px;border-radius:12px;background:${clusterColor}ee;color:#fff;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px ${clusterColor}44;display:flex;align-items:center;gap:4px;">
            <span>🐾</span>
            <span>${dong}</span>
            <span style="background:rgba(255,255,255,0.3);padding:1px 6px;border-radius:8px;font-size:10px;">${count}</span>
          </div>
          <div style="width:10px;height:10px;background:${clusterColor};transform:rotate(45deg);margin-top:-7px;"></div>
        </div>
      `;
      el.onclick = () => {
        if (!isLoggedIn) { if (confirm("로그인하면 고양이 정보를 볼 수 있어요. 로그인할까요?")) window.location.href = "/login"; return; }
        setSelectedDong(dong);
        setSelectedCat(null);
      };

      const ov = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: pos,
        content: el,
        yAnchor: 1,
        zIndex: 10,
      });
      overlaysRef.current.push(ov);
    });
  }, [cats, mapReady, isLoggedIn, alertedCats, showCats, activityRegions, regionFilter, searchQ, catFilter]);

  // ── 병원 마커 (뷰포트 기반 + 좌표 없으면 Geocoder 변환) ──
  const hospitalIdleListenerRef = useRef<any>(null);
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
      geocoder.addressSearch(addr, (result: any, status: any) => {
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

    function createHospitalEl(h: RescueHospital) {
      const el = document.createElement("div");
      const isPharmacy = (h.tags ?? []).some((t: string) => t.includes("동물약국"));
      const isManual = h.source !== "kakao";
      const isLarge = isPharmacy || isManual; // 약국 + 수동 등록 = 큰 마커
      const mc1 = isPharmacy ? "#E88D5A" : "#22B573";
      const mc2 = isPharmacy ? "#C47E5A" : "#1A9A5E";
      const sz = isLarge ? 42 : 28; // 카카오 병원은 작게
      const iconSz = isLarge ? (isPharmacy ? 20 : 22) : 14;
      const icon = isPharmacy
        ? `<svg width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.5 20H6a2 2 0 01-2-2V8l4-4h8l4 4v4"/>
            <path d="M8 4v4h4"/>
            <circle cx="17" cy="17" r="4"/>
            <path d="M15 17h4"/>
            <path d="M17 15v4"/>
           </svg>`
        : `<svg width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" fill="#fff"/></svg>`;

      // 큰 마커 (약국/수동): 아이콘 + 라벨 + 포인터
      if (isLarge) {
        const label = h.name.length > 14 ? h.name.slice(0, 14) + "…" : h.name;
        el.innerHTML = `
          <div style="
            transform: translate(-50%, -100%);
            display: flex; flex-direction: column; align-items: center; cursor: pointer;
          ">
            <div style="
              width: ${sz}px; height: ${sz}px;
              border-radius: ${isPharmacy ? "50%" : "14px"};
              background: linear-gradient(135deg, ${mc1} 0%, ${mc2} 100%);
              border: 2.5px solid #fff;
              box-shadow: 0 4px 14px ${mc1}55;
              display: flex; align-items: center; justify-content: center;
            ">
              ${icon}
            </div>
            <div style="
              margin-top: 3px; padding: 2px 8px; border-radius: 8px;
              background: #fff; color: ${mc1};
              font-size: 9.5px; font-weight: 800; white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              letter-spacing: -0.3px;
              border: 1.5px solid ${mc1}30;
            ">${label}</div>
            <div style="
              width: 6px; height: 6px;
              background: #fff;
              border-right: 1.5px solid ${mc1}30;
              border-bottom: 1.5px solid ${mc1}30;
              transform: rotate(45deg);
              margin-top: -5px;
            "></div>
          </div>
        `;
      } else {
        // 작은 마커 (카카오 병원): 아이콘만, 라벨 없음
        el.innerHTML = `
          <div style="
            transform: translate(-50%, -100%);
            display: flex; flex-direction: column; align-items: center; cursor: pointer;
          ">
            <div style="
              width: ${sz}px; height: ${sz}px;
              border-radius: 10px;
              background: linear-gradient(135deg, ${mc1} 0%, ${mc2} 100%);
              border: 2px solid #fff;
              box-shadow: 0 2px 8px ${mc1}44;
              display: flex; align-items: center; justify-content: center;
            ">
              ${icon}
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
      // 줌 레벨별 표시: 6~7 약국만, 8+ 전부, 9+ 숨김 없음(전부 표시)
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

        // 줌 레벨별 단계 표시
        if (level >= 9) {
          // 넓은 범위: 수동 등록(약국 포함)만
          if (!isManual) return false;
        } else if (level >= 7) {
          // 중간 범위: 수동 + pinned 병원만
          if (!isManual && !h.pinned) return false;
        }
        // level < 7: 전부 표시

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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
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
    setAddModalOpen(true);
  };

  // ── API 키 미설정 ──
  if (!apiKey) {
    return (
      <div className="px-5 pt-14 pb-8">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight mb-2">
          우리 동네 시민참여 돌봄 고양이
        </h1>
        <div className="card p-6 mt-6">
          <div className="w-12 h-12 rounded-2xl bg-warning/20 flex items-center justify-center mb-3">
            <MapPin size={22} className="text-warning" />
          </div>
          <p className="text-[15px] font-bold text-text-main mb-2">
            지도 키가 설정되지 않았어요
          </p>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <code className="text-[12px] bg-surface-alt px-1.5 py-0.5 rounded">.env.local</code>에{" "}
            <code className="text-[12px] bg-surface-alt px-1.5 py-0.5 rounded">NEXT_PUBLIC_KAKAO_MAP_KEY</code>를
            추가하고 개발 서버를 재시작해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative no-dark"
      style={{
        // 100dvh가 부정확한 기기 대비 vh 폴백 + 최소 높이 보장
        height: "calc(100dvh - 5rem)",
        minHeight: "calc(100vh - 5rem)",
      }}
    >
      {/* 헤더 (슬림 — 호갱노노 스타일) */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 지역 + 마릿수 */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
          >
            <MapPin size={14} style={{ color: "#C47E5A" }} />
            <span className="text-[13px] font-extrabold text-text-main">{currentGu || "전체"}</span>
            <span className="text-[13px] font-black" style={{ color: "#C47E5A" }}>
              {(() => {
                const map = mapInstanceRef.current;
                const bounds = map?.getBounds?.();
                if (!bounds || !window.kakao) return cats.length;
                return cats.filter((c) => {
                  const coord = getDisplayCoord(c, isLoggedIn);
                  const pos = new window.kakao.maps.LatLng(coord.lat, coord.lng);
                  return bounds.contain(pos);
                }).length;
              })()}
            </span>
            <span className="text-[10px] text-text-light">/</span>
            <span className="text-[11px] font-bold text-text-light">{cats.length}</span>
            {todayVisit != null && (
              <>
                <span className="w-px h-3 mx-0.5" style={{ backgroundColor: "#E0DBD3" }} />
                <span className="text-[10px] font-bold text-text-light">방문자 {todayVisit.toLocaleString()}명</span>
              </>
            )}
          </div>

          {/* 필터 칩 */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {[
              { key: "cats", label: "고양이", active: showCats, toggle: () => setShowCats(!showCats), color: "#C47E5A" },
              { key: "hospitals", label: "병원", active: showHospitals, toggle: () => setShowHospitals(!showHospitals), color: "#22B573" },
              { key: "pharmacies", label: "약국", active: showPharmacies, toggle: () => setShowPharmacies(!showPharmacies), color: "#E88D5A" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.toggle}
                className="px-3 py-2 rounded-xl text-[11px] font-bold active:scale-95 transition-all shrink-0"
                style={{
                  backgroundColor: f.active ? f.color : "rgba(255,255,255,0.85)",
                  color: f.active ? "#fff" : "#A38E7A",
                  boxShadow: f.active ? `0 2px 8px ${f.color}40` : "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 고양이 검색 + 속성 필터 */}
        {showCats && (
          <div className="mt-2 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <div
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <Search size={13} className="text-text-sub shrink-0" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="이름·동네·태그로 찾기"
                  className="flex-1 text-[12px] font-semibold bg-transparent outline-none placeholder:text-text-light"
                />
                {searchQ && (
                  <button
                    type="button"
                    onClick={() => setSearchQ("")}
                    className="shrink-0 w-5 h-5 rounded-full bg-surface-alt flex items-center justify-center active:scale-90"
                    aria-label="검색어 지우기"
                  >
                    <X size={11} className="text-text-sub" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFilterPanel((v) => !v)}
                className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 shrink-0"
                style={{
                  background: catFilter !== "all" || showFilterPanel
                    ? "#C47E5A"
                    : "rgba(255,255,255,0.95)",
                  color: catFilter !== "all" || showFilterPanel ? "#fff" : "#A38E7A",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
                aria-label="고양이 필터"
                aria-expanded={showFilterPanel}
                aria-controls="cat-filter-panel"
              >
                <SlidersHorizontal size={14} />
              </button>
            </div>

            {/* 속성 필터 칩 */}
            {showFilterPanel && (
              <div id="cat-filter-panel" className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide">
                {([
                  { key: "all",             label: "🌍 전체",       color: "#2C2C2C" },
                  { key: "alert",           label: "⚠️ 학대 경보",   color: "#D85555" },
                  { key: "tnr_needed",      label: "✂️ TNR 필요",   color: "#E88D5A" },
                  { key: "neutered",        label: "✅ 중성화 완료", color: "#6B8E6F" },
                  { key: "health_concern",  label: "🩺 건강 주의",   color: "#C9A961" },
                ] as { key: CatFilter; label: string; color: string }[]).map((f) => {
                  const active = catFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCatFilter(f.key)}
                      className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-all shrink-0"
                      style={{
                        backgroundColor: active ? f.color : "rgba(255,255,255,0.95)",
                        color: active ? "#fff" : "#555",
                        boxShadow: active ? `0 2px 8px ${f.color}44` : "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 활동 지역 탭 (당근마켓 스타일) */}
        {isLoggedIn && (
          <div className="flex gap-1.5 mt-2 pointer-events-auto overflow-x-auto scrollbar-hide">
            {activityRegions.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setRegionFilter("all")}
                  className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-all shrink-0"
                  style={{
                    backgroundColor: regionFilter === "all" ? "#2C2C2C" : "rgba(255,255,255,0.95)",
                    color: regionFilter === "all" ? "#fff" : "#555",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
                  }}
                >
                  🌍 전체
                </button>
                {activityRegions.map((r) => {
                  const color = r.slot === 1 ? "#C47E5A" : "#4A7BA8";
                  const active = regionFilter === r.slot;
                  return (
                    <button
                      key={r.slot}
                      type="button"
                      onClick={() => {
                        setRegionFilter(r.slot as 1 | 2);
                        if (mapInstanceRef.current && window.kakao) {
                          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(r.lat, r.lng));
                          mapInstanceRef.current.setLevel(4);
                        }
                      }}
                      className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-all shrink-0 flex items-center gap-1"
                      style={{
                        backgroundColor: active ? color : "rgba(255,255,255,0.95)",
                        color: active ? "#fff" : "#555",
                        boxShadow: active ? `0 2px 8px ${color}44` : "0 1px 6px rgba(0,0,0,0.08)",
                      }}
                    >
                      📍 {r.name}
                      {r.is_primary && <span style={{ fontSize: 9 }}>⭐</span>}
                    </button>
                  );
                })}
                <Link
                  href="/mypage/activity-regions"
                  className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-all shrink-0"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.7)",
                    color: "#A38E7A",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    border: "1px dashed rgba(163,142,122,0.4)",
                  }}
                >
                  ⚙ 지역 설정
                </Link>
              </>
            ) : (
              <Link
                href="/mypage/activity-regions"
                className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-all shrink-0"
                style={{
                  background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(196,126,90,0.35)",
                }}
              >
                📍 내 활동 지역 추가하기
              </Link>
            )}
          </div>
        )}

        {/* 게스트 배너 — 로그인 유도 + 좌표 퍼징 안내 */}
        {!isLoggedIn && !loadingCats && (
          <div
            className="rounded-2xl px-4 py-2.5 pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex items-start gap-2.5"
            style={{ backgroundColor: "#C47E5A" }}
          >
            <Shield size={15} className="mt-0.5 shrink-0" style={{ color: "#fff" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-white">
                둘러보기 모드예요
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                로그인하면 고양이 정보 확인 · 돌봄 기록 · 채팅을 사용할 수 있어요
              </p>
            </div>
            <a
              href="/login"
              className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold active:scale-95"
              style={{ backgroundColor: "#fff", color: "#C47E5A" }}
            >
              로그인
            </a>
          </div>
        )}

        {/* 학대 경보 & 시민 참여 카드 — 현재 보이는 구 기준 */}
        {(() => {
          // 현재 지도 화면에 보이는 경보 고양이만 필터
          const map = mapInstanceRef.current;
          const bounds = map?.getBounds?.();
          const alertedInView = cats.filter((c) => {
            if (!alertedCats.has(c.id)) return false;
            if (!bounds || !window.kakao) return false;
            const coord = getDisplayCoord(c, isLoggedIn);
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
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                {hasAlert ? (
                  <AlertTriangle size={16} color="#D85555" strokeWidth={2.5} />
                ) : (
                  <Shield size={16} color="#6B8E6F" strokeWidth={2.5} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold leading-tight" style={{ color: hasAlert ? "#8B2F2F" : "#3F5B42" }}>
                    {hasAlert
                      ? `${currentGu || "전체"} 학대 경보 ${alertedCount}건`
                      : `${currentGu || "이 동네"} · 현재 경보 없음`}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: hasAlert ? "#B84545" : "#7A9A7E" }}>
                    {hasAlert
                      ? Array.from(alertDongs.entries()).map(([dong, cnt]) => `${dong} ${cnt}건`).join(" · ")
                      : "학대 징후 발견 시 시민 제보가 가장 큰 힘이에요"}
                  </p>
                </div>
                {abuseCardExpanded ? (
                  <ChevronUp size={14} style={{ color: hasAlert ? "#B84545" : "#7A9A7E" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: hasAlert ? "#B84545" : "#7A9A7E" }} />
                )}
              </button>

              {abuseCardExpanded && (
                <div className="px-4 pb-3 space-y-2.5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-[11px] leading-relaxed mt-2.5" style={{ color: "#5A5A5A" }}>
                    동물보호법 제8조 위반 · <b>3년 이하 징역 또는 3,000만원 이하 벌금</b>
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[10px]" style={{ color: "#666" }}>
                    <span>· 증거 촬영(사진·영상·시간·장소)</span>
                    <span>· 지도에 경보 기록 남기기</span>
                    <span>· 구청·경찰·동물보호콜센터 신고</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="tel:112"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold active:scale-[0.97] transition-transform"
                      style={{ backgroundColor: "#2C2C2C", color: "#fff" }}
                    >
                      <Phone size={11} strokeWidth={2.5} />
                      112 경찰 신고
                    </a>
                    <a
                      href="tel:1577-0954"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold active:scale-[0.97] transition-transform"
                      style={{ backgroundColor: "#F5F5F5", color: "#333" }}
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

      </div>

      {/* 지도 영역 */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{
          background: "#EEEAE2",
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
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#EEE3DE" }}>
            <p className="text-[12px] font-semibold" style={{ color: "#B84545" }}>
              {catsError}
            </p>
            <button
              onClick={fetchCats}
              className="text-[12px] font-bold text-primary mt-1"
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
            <p className="text-[14px] font-bold text-text-main mb-1">지도를 불러올 수 없어요</p>
            <p className="text-[12px] text-text-sub leading-relaxed">{mapError}</p>
          </div>
        </div>
      )}

      {/* 현재 구 채팅 FAB + 안내 */}
      {currentGu && !selectedCat && !selectedHospital && !chatOpen && !selectedDong && (
        <div className="absolute bottom-6 left-4 z-30 flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => { if (!isLoggedIn) { if (confirm("로그인하면 동네 채팅을 사용할 수 있어요. 로그인할까요?")) window.location.href = "/login"; return; } setChatOpen(true); }}
            className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 active:scale-[0.95] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              borderRadius: 22,
              boxShadow: "0 6px 20px rgba(196,126,90,0.45), 0 0 0 2px rgba(255,255,255,0.8)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
            >
              <MessageCircle size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[12px] font-extrabold text-white leading-tight">{currentGu}</p>
              <p className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>동네 채팅</p>
            </div>
          </button>
          <div
            className="px-3 py-2 rounded-2xl max-w-[160px]"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
          >
            <p className="text-[9.5px] font-semibold text-text-main leading-snug">동네 채팅에 참여해보세요 💬</p>
          </div>
        </div>
      )}

      {/* 내 위치 + 등록 FAB */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && (
        <div className="absolute bottom-6 right-4 z-30 flex flex-col gap-2.5 items-end">
          <button
            onClick={handleLocateMe}
            className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center active:scale-90 transition-transform"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
            aria-label="내 위치"
          >
            <LocateFixed size={18} style={{ color: "#C47E5A" }} strokeWidth={2.2} />
          </button>
          <div className="relative">
            {/* 고양이 0마리 유저한텐 펄스 링으로 강조 */}
            {isLoggedIn && !cats.some((c) => c.caretaker_id === user?.id) && (
              <>
                <span
                  className="absolute inset-0 rounded-[18px] animate-ping"
                  style={{ background: "rgba(196,126,90,0.45)" }}
                  aria-hidden="true"
                />
                <span
                  className="absolute -top-1.5 -right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full text-white z-10"
                  style={{
                    background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
                    boxShadow: "0 2px 6px rgba(216,85,119,0.4)",
                  }}
                >
                  NEW
                </span>
              </>
            )}
            <button
              onClick={handleAddClick}
              className="relative w-13 h-13 rounded-[18px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform"
              style={{ width: 52, height: 52 }}
              aria-label="고양이 등록"
            >
              <Plus size={26} color="#fff" strokeWidth={2.5} />
            </button>
          </div>
          <div
            className="px-3 py-2 rounded-2xl max-w-[180px] text-right"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
          >
            <p className="text-[9.5px] font-semibold text-text-main leading-snug">우리 동네 고양이를 등록하고 품앗이 케어해보세요 🐾</p>
            <p className="text-[8.5px] text-text-light mt-0.5 leading-snug">
              고양이 위치는 보안상 동 단위로 표기돼요.
              <br />
              안심하고 등록해주세요 — 내가 못 가는 시간엔 이웃이 지켜줘요 🫶
            </p>
          </div>
        </div>
      )}

      {/* 첫 진입 유저용 코치마크 (내 고양이 0마리일 때만) */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && !addModalOpen && (
        <MapCoachmark
          isLoggedIn={isLoggedIn}
          hasMyCat={cats.some((c) => c.caretaker_id === user?.id)}
        />
      )}

      {/* 구 채팅방 */}
      {chatOpen && currentGu && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
          <div
            className="pointer-events-auto animate-slide-up mx-4 mb-4 flex flex-col"
            style={{
              background: "#FFFFFF",
              borderRadius: 28,
              boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
              border: "1px solid rgba(0,0,0,0.06)",
              height: "55vh",
            }}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-divider shrink-0">
              <MessageCircle size={16} className="text-primary" />
              <span className="text-[14px] font-extrabold text-text-main flex-1">{currentGu} 채팅</span>
              <span className="text-[10px] text-text-light">{chatMessages.length}개 메시지</span>
              <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-full bg-surface-alt flex items-center justify-center active:scale-90">
                <X size={16} className="text-text-sub" />
              </button>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-text-light">
                  <MessageCircle size={32} strokeWidth={1.2} className="mb-2 opacity-30" />
                  <p className="text-[12px]">아직 대화가 없어요</p>
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
                        <img src={msg.author_avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-primary">{(msg.author_name ?? "?")[0]}</span>
                        </div>
                      )
                    )}
                    <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                      {!isMe && (
                        <div className="flex items-center gap-1 mb-0.5 px-1">
                          <span className="text-[10px] font-semibold text-text-sub">{msg.author_name ?? "익명"}</span>
                          {msg.author_level && (
                            <span
                              className="text-[8px] font-extrabold px-1 py-[1px] rounded-md tabular-nums"
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
                          backgroundColor: isMe ? "#C47E5A" : "#F6F1EA",
                          color: isMe ? "#fff" : "#2A2A28",
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
                  style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }}
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
                  className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform"
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
              background: "#FFFFFF",
              borderRadius: 28,
              boxShadow: "0 -4px 24px rgba(196,126,90,0.15), 0 2px 8px rgba(0,0,0,0.06)",
              border: "1.5px solid rgba(196,126,90,0.2)",
              maxHeight: "60vh",
            }}
          >
            <button
              onClick={() => setSelectedDong(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
            >
              <X size={18} className="text-text-sub" />
            </button>

            <div className="px-5 pt-5 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[18px]">🐾</span>
                <h3 className="text-[17px] font-extrabold text-text-main">{selectedDong}</h3>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#C47E5A", color: "#fff" }}
                >
                  {selectedDongCats.length}마리
                </span>
              </div>
              <p className="text-[11px] text-text-sub">고양이를 탭하면 상세 정보를 볼 수 있어요</p>
            </div>

            <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "calc(60vh - 80px)" }}>
              {selectedDongCats.map((cat) => {
                const photoUrl = sanitizeImageUrl(cat.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
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
                        border: `2.5px solid ${isAlerted ? "#D85555" : "#C47E5A"}`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-bold text-text-main truncate">{cat.name}</span>
                        {isAlerted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#D85555", color: "#fff" }}>경보</span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-text-sub truncate mt-0.5">{cat.description}</p>
                      )}
                      {(cat.tags ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {cat.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}>{tag}</span>
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
        const accent = isPharm ? "#9B6DD7" : "#22B573";
        return (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div
            className="relative pointer-events-auto animate-slide-up overflow-hidden"
            style={{
              background: "#FFFFFF",
              borderRadius: 28,
              boxShadow: `0 -4px 24px ${accent}26, 0 2px 8px rgba(0,0,0,0.06)`,
              border: `1.5px solid ${accent}33`,
            }}
          >
            <button
              onClick={() => setSelectedHospital(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
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
                    <span style={{ fontSize: 22 }}>💊</span>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" fill="#fff"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-extrabold text-text-main leading-tight">
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
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
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
                    className="mt-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed"
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
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[14px] font-bold text-white active:scale-[0.97] transition-transform"
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
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl text-[12px] font-bold active:scale-[0.97] transition-transform"
                  style={{ backgroundColor: "#F5F0EB", color: "#A38E7A" }}
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
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div className="relative bg-white rounded-[28px] overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.12)] pointer-events-auto animate-slide-up max-h-[75vh] overflow-y-auto">
            <div className="absolute top-3 right-3 z-20 flex gap-2">
              {/* 수정/삭제 버튼 (본인 또는 admin) */}
              {(user?.id === selectedCat.caretaker_id || isAdmin) && !editingCat && (
                <>
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
                      setEditLat(null);
                      setEditLng(null);
                    }}
                    className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
                  >
                    <Pencil size={16} className="text-primary" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`"${selectedCat.name}" 을(를) 삭제할까요?`)) return;
                      try {
                        await deleteCat(selectedCat.id);
                        setCats((prev) => prev.filter((c) => c.id !== selectedCat.id));
                        setSelectedCat(null);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "삭제 실패");
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-red-500/90 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
                  >
                    <X size={16} color="#fff" />
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedCat(null); setEditingCat(false); setEditLat(null); setEditLng(null); }}
                className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
              >
                <X size={18} className="text-text-sub" />
              </button>
            </div>

            {/* 사진 */}
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-alt">
              {selectedCat.photo_url ? (
                <img
                  src={selectedCat.photo_url}
                  alt={selectedCat.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-light">
                  <MapPin size={48} strokeWidth={1.2} />
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)" }}
              />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                {selectedCat.region && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm">
                    <MapPin size={12} className="text-primary" />
                    <span className="text-[12px] font-bold text-text-main">{selectedCat.region}</span>
                  </div>
                )}
                {selectedCat.caretaker_name && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm ml-auto">
                    <Heart size={11} className="text-primary" fill="currentColor" />
                    <span className="text-[11px] font-semibold text-text-sub">
                      {selectedCat.caretaker_name} 돌봄중
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 정보 */}
            <div className="px-5 py-4">
              {editingCat ? (
                /* ═══ 수정 모드 ═══ */
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">이름</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={20}
                      className="w-full px-3 py-2 rounded-xl text-[14px] outline-none" style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">설명</label>
                    <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} maxLength={200}
                      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none resize-none" style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-sub mb-1 block">동네</label>
                    <input type="text" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} maxLength={20}
                      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none" style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }} />
                  </div>

                  {/* 위치 변경 (등록자 본인만) */}
                  {user?.id === selectedCat.caretaker_id && (
                    <div>
                      <label className="text-[11px] font-bold text-text-sub mb-1 block">지도 위치</label>
                      <button
                        type="button"
                        onClick={() => setPickingLocation(true)}
                        className="w-full px-3 py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-between active:scale-[0.98]"
                        style={{
                          backgroundColor: editLat !== null ? "#FFF2E8" : "#F6F1EA",
                          border: editLat !== null ? "1px solid #C47E5A" : "1px solid #E3DCD3",
                          color: editLat !== null ? "#C47E5A" : "#A38E7A",
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} />
                          {editLat !== null ? "새 위치 선택됨 (저장 시 반영)" : "📍 지도에서 위치 변경"}
                        </span>
                        <ChevronRight size={14} />
                      </button>
                      <p className="text-[10px] text-text-light mt-1">
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
                      ✂️ 중성화
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
                        backgroundColor: editAdoption === null ? "#EEE8E0" : undefined,
                        color: editAdoption === null ? "#6B5043" : "#A38E7A",
                        border: editAdoption === null ? "1px solid #C47E5A" : "1px solid #E3DCD3",
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
                            ...(editLat !== null && editLng !== null
                              ? { lat: editLat, lng: editLng }
                              : {}),
                          });
                          setSelectedCat(updated);
                          setCats((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                          setEditingCat(false);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "수정 실패");
                        } finally {
                          setEditSaving(false);
                        }
                      }}
                      disabled={editSaving || !editName.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.97] transition-all"
                    >
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                    </button>
                    <button onClick={() => { setEditingCat(false); setEditLat(null); setEditLng(null); }} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* ═══ 보기 모드 ═══ */
                <>
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <h2 className="text-[20px] font-extrabold text-text-main tracking-tight">
                      {selectedCat.name}
                    </h2>
                    {selectedCat.region && (
                      <span className="text-[12px] text-text-light">
                        {selectedCat.region}에 살아요
                      </span>
                    )}
                  </div>

                  {/* 좋아요 버튼 */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={handleToggleCatLike}
                      disabled={likingCat}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-60"
                      style={{
                        background: likedCatIds.has(selectedCat.id)
                          ? "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)"
                          : "#F6F1EA",
                        color: likedCatIds.has(selectedCat.id) ? "#fff" : "#A38E7A",
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
                      <span className="text-[12px] font-extrabold">
                        {selectedCat.like_count ?? 0}
                      </span>
                    </button>
                    {(selectedCat.like_count ?? 0) > 0 && (
                      <span className="text-[10.5px] text-text-light font-semibold">
                        {likedCatIds.has(selectedCat.id)
                          ? "마음이 전해졌어요 💛"
                          : `${selectedCat.like_count}명이 응원해요`}
                      </span>
                    )}
                    {/* 공유 버튼들 */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {/* 카카오톡 공유 */}
                      <button
                        type="button"
                        onClick={handleShareCatToKakao}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl active:scale-95 transition-transform"
                        style={{
                          background: "#FEE500",
                          color: "#3C1E1E",
                          boxShadow: "0 2px 6px rgba(254,229,0,0.45)",
                        }}
                        aria-label="카카오톡으로 공유"
                      >
                        <span style={{ fontSize: 13 }}>💬</span>
                        <span className="text-[10.5px] font-extrabold">카톡</span>
                      </button>
                      {/* 기본 공유 / 복사 */}
                      <button
                        type="button"
                        onClick={handleShareCat}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl active:scale-95 transition-transform"
                        style={{
                          background: shareStatus === "copied" ? "#6B8E6F" : "#F6F1EA",
                          color: shareStatus === "copied" ? "#fff" : "#A38E7A",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                        }}
                        aria-label="공유"
                      >
                        {shareStatus === "copied" ? (
                          <>
                            <Check size={12} strokeWidth={2.5} />
                            <span className="text-[10.5px] font-extrabold">복사됨</span>
                          </>
                        ) : (
                          <>
                            <Share2 size={12} strokeWidth={2.5} />
                            <span className="text-[10.5px] font-extrabold">공유</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 프로필 뱃지: 성별 · 중성화 · 건강 */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedCat.gender && selectedCat.gender !== "unknown" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: "#EEE8E0", color: "#8B65B8" }}>
                        {GENDER_MAP[selectedCat.gender]?.emoji} {GENDER_MAP[selectedCat.gender]?.label}
                      </span>
                    )}
                    {selectedCat.neutered != null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: selectedCat.neutered ? "#E8F5E9" : "#FFF3E0", color: selectedCat.neutered ? "#6B8E6F" : "#E88D5A" }}>
                        {selectedCat.neutered ? "✂️ 중성화 완료" : "중성화 필요"}
                      </span>
                    )}
                    {selectedCat.health_status && selectedCat.health_status !== "good" && (() => {
                      const h = HEALTH_MAP[selectedCat.health_status];
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${h.color}18`, color: h.color }}>
                          {h.emoji} {h.label}
                        </span>
                      );
                    })()}
                  </div>

                  {selectedCat.description && (
                    <p className="text-[14px] text-text-sub leading-relaxed mb-3">
                      {selectedCat.description}
                    </p>
                  )}
                  {selectedCat.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCat.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: "#EEE8E0", color: "#C47E5A" }}
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
                  style={{ backgroundColor: "#FBEAEA", border: "1px solid #E8C5C5" }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={14} style={{ color: "#B84545" }} />
                    <span className="text-[12px] font-extrabold" style={{ color: "#B84545" }}>
                      위험 상황 {alertCount}건 신고됨 — 빠른 대응
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <a
                      href="tel:112"
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform active:scale-95"
                      style={{ backgroundColor: "#B84545" }}
                    >
                      <Phone size={14} color="#fff" />
                      <span className="text-[10px] font-bold text-white">112 신고</span>
                    </a>
                    <a
                      href="tel:1577-0954"
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform active:scale-95"
                      style={{ backgroundColor: "#C47E5A" }}
                    >
                      <Phone size={14} color="#fff" />
                      <span className="text-[10px] font-bold text-white">동물보호</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyAlertRecord}
                      className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-transform active:scale-95"
                      style={{ backgroundColor: "#6B8E6F" }}
                    >
                      {copyStatus === "copied" ? (
                        <Check size={14} color="#fff" />
                      ) : (
                        <Copy size={14} color="#fff" />
                      )}
                      <span className="text-[10px] font-bold text-white">
                        {copyStatus === "copied" ? "복사됨" : "기록 복사"}
                      </span>
                    </button>
                  </div>
                  <p
                    className="text-[10px] mt-2 leading-relaxed"
                    style={{ color: "#8B2F2F" }}
                  >
                    112: 긴급 학대 현장 · 1577-0954: 동물보호상담센터
                  </p>
                </div>
              )}

              {/* ══ 탭: 돌봄 일지 | 커뮤니티 ══ */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: "#EEE8E0" }}>
                <div className="flex gap-1 mb-3 px-1">
                  <button
                    type="button"
                    onClick={() => setCatCardTab("carelog")}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                    style={{
                      backgroundColor: catCardTab === "carelog" ? "#C47E5A" : "#F6F1EA",
                      color: catCardTab === "carelog" ? "#fff" : "#A38E7A",
                    }}
                  >
                    🐾 돌봄 일지
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatCardTab("community")}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                    style={{
                      backgroundColor: catCardTab === "community" ? "#C47E5A" : "#F6F1EA",
                      color: catCardTab === "community" ? "#fff" : "#A38E7A",
                    }}
                  >
                    💬 커뮤니티 {comments.length > 0 && `· ${comments.length}`}
                  </button>
                </div>

                {/* 돌봄 일지 탭 */}
                {catCardTab === "carelog" && (
                  <CareLogTab catId={selectedCat.id} isLoggedIn={isLoggedIn} currentUserId={user?.id} />
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
                    <p className="text-[12px] text-text-light text-center py-3">
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
                          backgroundColor: isAlert ? "#FBEAEA" : "#F6F1EA",
                          borderLeft: isAlert ? "3px solid #B84545" : "none",
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {isAlert && (
                            <AlertTriangle size={11} style={{ color: "#B84545" }} />
                          )}
                          {/* 작성자 아바타 */}
                          {c.author_avatar_url ? (
                            <img
                              src={c.author_avatar_url}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover shrink-0"
                              style={{ border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: isAlert ? "#FBEAEA" : "#EEE8E0",
                                border: "1.5px solid #fff",
                              }}
                            >
                              <span
                                className="text-[9px] font-extrabold"
                                style={{ color: isAlert ? "#B84545" : "#C47E5A" }}
                              >
                                {c.author_name?.charAt(0) ?? "?"}
                              </span>
                            </div>
                          )}
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: isAlert ? "#B84545" : "#C47E5A" }}
                          >
                            {c.author_name ?? "익명"}
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
                          <TitleBadge titleId={c.author_title} />

                          <span className="text-[10px] text-text-light ml-auto">
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
                              className="ml-1 text-text-light active:scale-90"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
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
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(c.photo_url)}
                            className="mt-2 block rounded-xl overflow-hidden active:scale-[0.98] transition-transform"
                            style={{
                              width: "100%",
                              maxWidth: 220,
                              aspectRatio: "4 / 3",
                              backgroundColor: "#EEE8E0",
                            }}
                          >
                            <img
                              src={c.photo_url}
                              alt="돌봄 기록 사진"
                              className="w-full h-full object-cover"
                              loading="lazy"
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
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                                  style={{
                                    backgroundColor: liked ? "#6B8E6F" : "#FFFFFF",
                                    border: `1px solid ${liked ? "#6B8E6F" : "#E3DCD3"}`,
                                    color: liked ? "#FFFFFF" : "#6B8E6F",
                                  }}
                                  aria-label="좋아요"
                                >
                                  <ThumbsUp size={11} strokeWidth={2.2} fill={liked ? "#FFFFFF" : "none"} />
                                  <span className="text-[10px] font-bold tabular-nums">
                                    {c.like_count}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVoteComment(c.id, -1)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                                  style={{
                                    backgroundColor: disliked ? "#A38E7A" : "#FFFFFF",
                                    border: `1px solid ${disliked ? "#A38E7A" : "#E3DCD3"}`,
                                    color: disliked ? "#FFFFFF" : "#A38E7A",
                                  }}
                                  aria-label="싫어요"
                                >
                                  <ThumbsDown size={11} strokeWidth={2.2} fill={disliked ? "#FFFFFF" : "none"} />
                                  <span className="text-[10px] font-bold tabular-nums">
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
                                    })
                                  }
                                  className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg active:scale-90 transition-transform"
                                  style={{
                                    backgroundColor: "#FFFFFF",
                                    border: "1px solid #E3DCD3",
                                  }}
                                  aria-label="신고"
                                  title="신고하기"
                                >
                                  <Flag size={11} style={{ color: "#A38E7A" }} strokeWidth={2.2} />
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
                  <p className="text-[11px] mt-2" style={{ color: "#B84545" }}>
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
                    style={{ backgroundColor: "#FBEAEA", border: "1.5px solid #D85555" }}
                  >
                    <p className="text-[11.5px] font-extrabold leading-snug" style={{ color: "#B84545" }}>
                      🚨 학대·위험 신고 모드
                    </p>
                    <p className="text-[10.5px] leading-relaxed mt-0.5" style={{ color: "#8B2F2F" }}>
                      지금 남기는 기록은 <b>학대/위험 신고</b>로 표시돼요. 2건 이상 쌓이면 마커에 경보 라벨이 뜨고,
                      112·동물보호상담센터 연락·신고 기록 복사 버튼이 자동 활성화돼요. 일반 돌봄 기록은 왼쪽 ⚠️
                      버튼을 다시 눌러 해제.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[10.5px] text-text-light leading-relaxed px-1">
                    💡 왼쪽 <b style={{ color: "#B84545" }}>⚠️</b> 버튼을 누르면 <b>학대·위험 신고 모드</b>로 바뀌어요.
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
                        commentKind === "alert" ? "#FBEAEA" : "#EEE8E0",
                      color: commentKind === "alert" ? "#B84545" : "#A38E7A",
                      border: commentKind === "alert" ? "1.5px solid #D85555" : "none",
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
                      backgroundColor: commentPhotoFile ? "#E8ECE5" : "#EEE8E0",
                      color: commentPhotoFile ? "#5BA876" : "#A38E7A",
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
                      if (e.key === "Enter") handleSubmitComment();
                    }}
                    placeholder={
                      commentKind === "alert"
                        ? "학대/위험 상황을 알려주세요"
                        : "돌봄 기록을 남겨주세요"
                    }
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[12px] outline-none"
                    style={{ backgroundColor: "#F6F1EA", color: "#2A2A28" }}
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
            src={lightboxUrl}
            alt="확대 사진"
            className="max-w-full max-h-full rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
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
      />

      {/* 등록 모달 */}
      <AddCatModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleCatCreated}
        initialLat={pickedCoord?.lat}
        initialLng={pickedCoord?.lng}
      />

      {/* 고양이 위치 변경 Picker (등록자 본인만) */}
      {selectedCat && user?.id === selectedCat.caretaker_id && (
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

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        :global(.animate-slide-up) {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
