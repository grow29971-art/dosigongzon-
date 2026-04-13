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
  Lightbulb,
  Camera,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Clock,
  ChevronRight,
  Pencil,
  Save,
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
  CARE_TIPS,
  type Cat,
  type CatComment,
  type CommentKind,
  type VoteValue,
} from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";
import { sanitizeImageUrl } from "@/lib/url-validate";
import TitleBadge from "@/app/components/TitleBadge";
import SendDMButton from "@/app/components/SendDMButton";
import { listRescueHospitals, type RescueHospital } from "@/lib/hospitals-repo";
import type { Post } from "@/lib/types";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { getDisplayName as getChatDisplayName, updateCat, deleteCat } from "@/lib/cats-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";

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
  const isLoggedIn = !!user;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Cat | null>(null);
  const [mapError, setMapError] = useState("");

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
      alert(err instanceof Error ? err.message : "메시지 전송 실패");
    } finally {
      setChatSending(false);
    }
  };

  // 채팅방: 히스토리 로드 + 1초 폴링 (다른 사람 메시지 실시간 수신)
  useEffect(() => {
    if (!chatOpen || !currentGu) return;

    const supabase = createSupabaseClient();
    let active = true;
    let lastCount = 0;
    let lastId = "";

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("area_chats")
        .select("*")
        .eq("area", currentGu)
        .order("created_at", { ascending: true })
        .limit(50) as { data: any };

      if (!active) return;
      const msgs = data ?? [];

      // 새 메시지가 있을 때만 state 업데이트 (불필요한 리렌더 방지)
      const newLastId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";
      if (msgs.length !== lastCount || newLastId !== lastId) {
        lastCount = msgs.length;
        lastId = newLastId;

        setChatMessages((prev) => {
          // temp- 메시지(낙관적)는 유지하면서 DB 메시지로 병합
          const tempMsgs = prev.filter((m) => m.id.startsWith("temp-"));
          const dbIds = new Set(msgs.map((m: any) => m.id));
          const remainingTemp = tempMsgs.filter((t) => !msgs.some((m: any) =>
            m.author_id === t.author_id && m.body === t.body
          ));
          const merged = [...msgs, ...remainingTemp];
          return merged;
        });

        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
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

  // ── 돌봄 팁 배너 (자동 로테이션) ──
  const [tipIndex, setTipIndex] = useState(0);
  const [tipDismissed, setTipDismissed] = useState(false);
  useEffect(() => {
    // 세션 내 닫기 상태 복원
    if (typeof window !== "undefined" && sessionStorage.getItem("map_tip_dismissed") === "1") {
      setTipDismissed(true);
    }
  }, []);
  useEffect(() => {
    if (tipDismissed) return;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % CARE_TIPS.length);
    }, 7000);
    return () => clearInterval(id);
  }, [tipDismissed]);
  const handleNextTip = () => {
    setTipIndex((i) => (i + 1) % CARE_TIPS.length);
  };
  const handleDismissTip = () => {
    setTipDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("map_tip_dismissed", "1");
    }
  };
  const currentTip = CARE_TIPS[tipIndex];
  const tipTheme = {
    info: { bg: "#E8ECE5", border: "#6B8E6F", text: "#3F5B42", accent: "#5BA876" },
    warn: { bg: "#EDE9E0", border: "#C9A961", text: "#6B5A2A", accent: "#E8B040" },
    danger: { bg: "#FBEAEA", border: "#B84545", text: "#8B2F2F", accent: "#D85555" },
  }[currentTip.severity];

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
        listAlertedCatIds(30),
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
    listRescueHospitals().then(setHospitals);
    isCurrentUserAdmin().then(setIsAdmin);
  }, [fetchCats]);

  // ── 카카오 SDK 직접 로드 ──
  useEffect(() => {
    if (!apiKey) return;

    if (window.kakao && window.kakao.maps) {
      setScriptLoaded(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => setScriptLoaded(true);
    script.onerror = () =>
      setMapError(
        "지도 스크립트 로드에 실패했어요. 네트워크 또는 도메인 등록을 확인해주세요."
      );
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

      // 초기 중심: GPS가 이미 왔으면 그 위치, 아니면 기본 중심
      const initialCenter = userPos ?? MAP_CENTER;
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

      // 지도 이동/줌 끝날 때 현재 구 감지
      const detectGu = () => {
        if (!window.kakao?.maps?.services) return;
        const center = map.getCenter();
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(center.getLng(), center.getLat(), (result: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && result[0]) {
            const gu = result[0].region_2depth_name || "";
            setCurrentGu(gu || "");
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

  // ── 지도 초기화 후에 GPS가 뒤늦게 도착하면 중심 이동 ──
  useEffect(() => {
    if (!mapReady || !userPos || !mapInstanceRef.current || !window.kakao) return;
    const map = mapInstanceRef.current;
    map.setCenter(new window.kakao.maps.LatLng(userPos.lat, userPos.lng));
  }, [mapReady, userPos]);

  const [isAdmin, setIsAdmin] = useState(false);

  // ── 고양이 수정 모드 ──
  const [editingCat, setEditingCat] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

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

    // region(동)별 그룹핑
    const groups = new Map<string, Cat[]>();
    cats.forEach((cat) => {
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
          el.onclick = () => setSelectedCat(cat);
          const ov = new window.kakao.maps.CustomOverlay({ map: mapInstanceRef.current, position: pos, content: el, yAnchor: 1 });
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
        setSelectedDong(dong);
        setSelectedCat(null);
      };

      const ov = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position: pos,
        content: el,
        yAnchor: 1,
      });
      overlaysRef.current.push(ov);
    });
  }, [cats, mapReady, isLoggedIn, alertedCats]);

  // ── 병원 마커 (상시 표시, Geocoder로 주소 → 좌표 변환) ──
  useEffect(() => {
    hospitalOverlaysRef.current.forEach((ov) => ov.setMap(null));
    hospitalOverlaysRef.current = [];

    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;
    if (hospitals.length === 0) return;

    const map = mapInstanceRef.current;

    function placeHospitalMarker(h: RescueHospital, lat: number, lng: number) {
      const position = new window.kakao.maps.LatLng(lat, lng);
      const el = document.createElement("div");
      const label = h.name.length > 14 ? h.name.slice(0, 14) + "…" : h.name;
      const isPharmacy = (h.tags ?? []).some((t: string) => t.includes("동물약국"));
      // 약국: 보라+핑크 그라디언트 / 병원: 초록 그라디언트
      const mc1 = isPharmacy ? "#9B6DD7" : "#22B573";
      const mc2 = isPharmacy ? "#7B4FBF" : "#1A9A5E";
      // 약국: 💊 알약 아이콘 / 병원: ✚ 십자가
      const icon = isPharmacy
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="18" height="8" rx="4" fill="#fff" opacity="0.95"/>
            <line x1="12" y1="8" x2="12" y2="16" stroke="${mc1}" stroke-width="1.5" stroke-dasharray="2 1.5"/>
            <circle cx="7.5" cy="12" r="1.2" fill="${mc2}"/>
            <circle cx="16.5" cy="12" r="1.2" fill="#E8A0BF"/>
           </svg>`
        : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z" fill="#fff"/></svg>`;
      el.innerHTML = `
        <div style="
          transform: translate(-50%, -100%);
          display: flex; flex-direction: column; align-items: center; cursor: pointer;
        ">
          <div style="
            width: ${isPharmacy ? 44 : 48}px; height: ${isPharmacy ? 44 : 48}px;
            border-radius: ${isPharmacy ? 22 : 14}px;
            background: linear-gradient(135deg, ${mc1} 0%, ${mc2} 100%);
            border: 3px solid #fff;
            box-shadow: 0 6px 20px ${mc1}66, 0 0 0 2px ${mc1}20;
            display: flex; align-items: center; justify-content: center;
          ">
            ${icon}
          </div>
          <div style="
            margin-top: 3px; padding: 2.5px 9px; border-radius: 10px;
            background: ${mc1}ee; color: #fff;
            font-size: ${isPharmacy ? 9 : 10}px; font-weight: 800; white-space: nowrap;
            box-shadow: 0 3px 8px ${mc1}44;
            letter-spacing: -0.3px;
          ">${isPharmacy ? "💊 " : ""}${label}</div>
          <div style="
            width: 8px; height: 8px;
            background: ${mc1};
            transform: rotate(45deg);
            margin-top: -6px;
          "></div>
        </div>
      `;
      el.onclick = () => setSelectedHospital(h);

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: el,
        yAnchor: 1,
        zIndex: 3,
      });
      overlay.setMap(map);
      hospitalOverlaysRef.current.push(overlay);
    }

    const geocoder = window.kakao.maps?.services
      ? new window.kakao.maps.services.Geocoder()
      : null;

    hospitals.forEach((h) => {
      if (h.lat != null && h.lng != null) {
        placeHospitalMarker(h, h.lat, h.lng);
        return;
      }
      const addr = h.address || `${h.city} ${h.district}`;
      if (!geocoder || !addr) return;
      geocoder.addressSearch(addr, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          placeHospitalMarker(h, parseFloat(result[0].y), parseFloat(result[0].x));
        }
      });
    });
  }, [hospitals, mapReady]);

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

  const handleAddClick = () => {
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
    <div className="relative" style={{ height: "calc(100dvh - 5rem)" }}>
      {/* 헤더 (지도 위에 떠있음) */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-3 pointer-events-none space-y-2">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl px-4 py-3 pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-0.5">
            <MapPin size={14} className="text-primary" />
            <span className="text-[12px] font-semibold text-primary">인천시 남동구</span>
          </div>
          <h1 className="text-[17px] font-extrabold text-text-main tracking-tight leading-snug">
            우리 동네 시민참여 돌봄 고양이 {cats.length}마리
          </h1>
          <p className="text-[11px] text-text-sub mt-0.5">
            {loadingCats
              ? "불러오는 중..."
              : "오른쪽 클릭(데스크톱) 또는 + 버튼으로 새 아이 등록"}
          </p>
        </div>

        {/* 게스트 보호 배너 — 학대 방지용 좌표 퍼징 안내 */}
        {!isLoggedIn && !loadingCats && (
          <div
            className="rounded-2xl px-4 py-2.5 pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex items-start gap-2.5"
            style={{ backgroundColor: "#EEE8E0" }}
          >
            <Shield size={15} className="mt-0.5 shrink-0" style={{ color: "#C47E5A" }} />
            <div className="min-w-0">
              <p className="text-[12px] font-bold" style={{ color: "#7A5238" }}>
                아이들 보호를 위해 대략적 위치만 표시돼요
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#A38E7A" }}>
                로그인하면 정확한 위치가 보여요 · 약 70m 오차
              </p>
            </div>
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

          const theme = hasAlert
            ? { bg: "#FBEAEA", border: "#D85555", accent: "#D85555", text: "#7A2A2A", sub: "#A84444" }
            : { bg: "#EAF0EA", border: "#6B8E6F", accent: "#6B8E6F", text: "#3E5A42", sub: "#6B8E6F" };
          return (
            <div
              className="rounded-2xl pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
              style={{
                backgroundColor: theme.bg,
                borderLeft: `3px solid ${theme.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => setAbuseCardExpanded((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left active:scale-[0.99] transition-transform"
              >
                <div
                  className="w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}DD 100%)`,
                    boxShadow: `0 3px 8px ${theme.accent}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
                  }}
                >
                  {hasAlert ? (
                    <AlertTriangle size={13} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <Shield size={13} color="#fff" strokeWidth={2.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[12px] font-extrabold leading-tight"
                    style={{ color: theme.text }}
                  >
                    {hasAlert
                      ? `${currentGu || "전체"} 학대 경보 ${alertedCount}건`
                      : `${currentGu || "이 동네"} · 현재 경보 없음`}
                  </p>
                  {hasAlert ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Array.from(alertDongs.entries()).map(([dong, cnt]) => (
                        <span
                          key={dong}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: "#D8555522", color: "#D85555" }}
                        >
                          {dong} {cnt}건
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10.5px] leading-snug mt-0.5" style={{ color: theme.sub }}>
                      학대 징후 발견 시 즉시 시민 제보가 가장 큰 힘이에요
                    </p>
                  )}
                </div>
                {abuseCardExpanded ? (
                  <ChevronUp size={14} style={{ color: theme.sub }} />
                ) : (
                  <ChevronDown size={14} style={{ color: theme.sub }} />
                )}
              </button>

              {abuseCardExpanded && (
                <div
                  className="px-4 pb-3 pt-0.5 space-y-2.5"
                  style={{ borderTop: `1px solid ${theme.border}22` }}
                >
                  <p
                    className="text-[11px] leading-relaxed mt-2"
                    style={{ color: theme.text }}
                  >
                    길고양이 학대는 동물보호법 제8조 위반으로 <b>3년 이하 징역 또는 3,000만원 이하 벌금</b>이에요. 수사와 구조는 시민 제보가 없으면 시작조차 못 해요.
                  </p>

                  <div>
                    <p
                      className="text-[11px] font-extrabold mb-1"
                      style={{ color: theme.text }}
                    >
                      목격하셨다면
                    </p>
                    <ul
                      className="text-[10.5px] leading-relaxed space-y-0.5 pl-3"
                      style={{ color: theme.sub, listStyleType: "disc" }}
                    >
                      <li>가능한 범위에서 증거 촬영(사진·영상·시간·장소)</li>
                      <li>해당 고양이 정보를 이 지도에 <b>경보 기록</b>으로 남기기</li>
                      <li>구청 동물보호 담당부서 / 경찰 112 / 동물보호콜센터에 신고</li>
                    </ul>
                  </div>

                  <div className="flex gap-1.5">
                    <a
                      href="tel:112"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-extrabold active:scale-[0.97] transition-transform"
                      style={{
                        backgroundColor: theme.accent,
                        color: "#fff",
                      }}
                    >
                      <Phone size={12} strokeWidth={2.8} />
                      112 경찰 신고
                    </a>
                    <a
                      href="tel:1577-0954"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-extrabold active:scale-[0.97] transition-transform"
                      style={{
                        backgroundColor: "#fff",
                        color: theme.accent,
                        border: `1.5px solid ${theme.accent}`,
                      }}
                    >
                      <Phone size={12} strokeWidth={2.8} />
                      1577-0954
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 돌봄 팁 배너 — 회전 */}
        {!tipDismissed && (
          <button
            type="button"
            onClick={handleNextTip}
            className="w-full rounded-2xl pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-left overflow-hidden relative"
            style={{
              backgroundColor: tipTheme.bg,
              borderLeft: `3px solid ${tipTheme.border}`,
            }}
          >
            <div className="px-4 py-2.5 pr-9 flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: `linear-gradient(135deg, ${tipTheme.accent} 0%, ${tipTheme.accent}DD 100%)`,
                  boxShadow: `0 3px 8px ${tipTheme.accent}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
                }}
              >
                <Lightbulb size={13} color="#fff" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px]">{currentTip.emoji}</span>
                  <p className="text-[12px] font-extrabold leading-tight" style={{ color: tipTheme.text }}>
                    {currentTip.title}
                  </p>
                </div>
                <p className="text-[10.5px] leading-snug" style={{ color: tipTheme.text, opacity: 0.85 }}>
                  {currentTip.body}
                </p>
                {/* 인디케이터 점 */}
                <div className="flex items-center gap-1 mt-1.5">
                  {CARE_TIPS.map((_, i) => (
                    <span
                      key={i}
                      className="h-1 rounded-full transition-all"
                      style={{
                        width: i === tipIndex ? 10 : 4,
                        backgroundColor: i === tipIndex ? tipTheme.border : `${tipTheme.border}44`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {/* 닫기 버튼 */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleDismissTip();
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
              style={{ backgroundColor: `${tipTheme.border}22` }}
              role="button"
              aria-label="팁 닫기"
            >
              <X size={12} style={{ color: tipTheme.text }} />
            </div>
          </button>
        )}
      </div>

      {/* 지도 영역 */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ background: "#EEEAE2" }}
      />

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

      {/* 현재 구 채팅 FAB */}
      {currentGu && !selectedCat && !selectedHospital && !chatOpen && !selectedDong && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="absolute bottom-6 left-5 z-30 flex items-center gap-2.5 pl-3 pr-4 py-2.5 active:scale-[0.95] transition-transform"
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
      )}

      {/* + 등록 FAB — 채팅/카드 열려있을 때는 숨김 */}
      {!selectedCat && !selectedHospital && !chatOpen && !selectedDong && (
        <button
          onClick={handleAddClick}
          className="absolute bottom-6 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-30"
          aria-label="고양이 등록"
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
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
                    onClick={() => { setSelectedCat(cat); setSelectedDong(null); }}
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

            {/* 하단 전화 버튼 */}
            {selectedHospital.phone && (
              <div
                className="px-5 py-3 border-t"
                style={{ borderColor: `${accent}15` }}
              >
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
              </div>
            )}
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
                        alert(err instanceof Error ? err.message : "삭제 실패");
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-red-500/90 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
                  >
                    <X size={16} color="#fff" />
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedCat(null); setEditingCat(false); }}
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
                          });
                          setSelectedCat(updated);
                          setCats((prev) => prev.map((c) => c.id === updated.id ? updated : c));
                          setEditingCat(false);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "수정 실패");
                        } finally {
                          setEditSaving(false);
                        }
                      }}
                      disabled={editSaving || !editName.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.97] transition-all"
                    >
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                    </button>
                    <button onClick={() => setEditingCat(false)} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}>
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

              {/* ══ 댓글 섹션 ══ */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EEE8E0" }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageCircle size={14} className="text-text-sub" />
                  <span className="text-[12px] font-bold text-text-main">
                    돌봄 기록 {comments.length > 0 && `· ${comments.length}`}
                  </span>
                </div>

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

                {/* 댓글 입력 */}
                <div className="mt-3 flex items-center gap-2">
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
                    }}
                    title={commentKind === "alert" ? "학대 신고 모드" : "일반 기록"}
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
