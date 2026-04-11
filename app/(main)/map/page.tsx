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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => setScriptLoaded(true);
    script.onerror = () =>
      setMapError(
        "지도 스크립트 로드에 실패했어요. 네트워크 또는 도메인 등록을 확인해주세요."
      );
    document.head.appendChild(script);
  }, [apiKey]);

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

      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(MAP_CENTER.lat, MAP_CENTER.lng),
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

      setMapReady(true);
    });
  }, [scriptLoaded]);

  // ── cats 변경 시 마커 다시 그리기 (로그인 상태 바뀌면 퍼징 여부도 바뀜) ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;

    // 기존 마커 제거
    overlaysRef.current.forEach((ov) => ov.setMap(null));
    overlaysRef.current = [];

    cats.forEach((cat) => {
      const coord = getDisplayCoord(cat, isLoggedIn);
      const position = new window.kakao.maps.LatLng(coord.lat, coord.lng);
      const isAlerted = alertedCats.has(cat.id);

      const content = document.createElement("div");
      const photoUrl = cat.photo_url ?? "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F";
      const borderColor = isAlerted ? "#D85555" : "#C47E5A";
      const shadow = isAlerted
        ? "0 6px 18px rgba(216,85,85,0.55), 0 0 0 2px rgba(216,85,85,0.15)"
        : "0 4px 12px rgba(0,0,0,0.2)";

      content.innerHTML = `
        <div style="
          transform: translate(-50%, -100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        ">
          ${isAlerted
            ? `
              <div style="
                background: linear-gradient(135deg, #D85555 0%, #B84545 100%);
                color: #fff;
                padding: 3px 10px;
                border-radius: 11px;
                font-size: 10px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 3px 10px rgba(216,85,85,0.55);
                letter-spacing: -0.3px;
                margin-bottom: 5px;
                animation: alert-pulse 1.6s ease-in-out infinite;
              ">⚠️ 학대경보</div>
            `
            : ""
          }
          <div style="
            width: 56px;
            height: 56px;
            border-radius: 50%;
            border: 3px solid ${borderColor};
            background: white;
            box-shadow: ${shadow};
            overflow: hidden;
            background-image: url('${photoUrl}');
            background-size: cover;
            background-position: center;
          "></div>
          <div style="
            width: 12px;
            height: 12px;
            background: ${borderColor};
            transform: rotate(45deg);
            margin-top: -8px;
            box-shadow: ${isAlerted ? "0 2px 6px rgba(216,85,85,0.5)" : "none"};
          "></div>
        </div>
      `;
      content.onclick = () => setSelectedCat(cat);

      const overlay = new window.kakao.maps.CustomOverlay({
        map: mapInstanceRef.current,
        position,
        content,
        yAnchor: 1,
      });
      overlaysRef.current.push(overlay);
    });
  }, [cats, mapReady, isLoggedIn, alertedCats]);

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
          우리 동네 고양이
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
          <h1 className="text-[18px] font-extrabold text-text-main tracking-tight">
            우리 동네 고양이 {cats.length}마리
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

      {/* + 등록 FAB — 고양이 카드 열려있을 때는 숨김 (Send 버튼과 겹침 방지) */}
      {!selectedCat && (
        <button
          onClick={handleAddClick}
          className="absolute bottom-6 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-30"
          aria-label="고양이 등록"
        >
          <Plus size={28} color="#fff" strokeWidth={2.5} />
        </button>
      )}

      {/* 선택된 고양이 카드 */}
      {selectedCat && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div className="relative bg-white rounded-[28px] overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.12)] pointer-events-auto animate-slide-up max-h-[75vh] overflow-y-auto">
            <button
              onClick={() => setSelectedCat(null)}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-md"
            >
              <X size={18} className="text-text-sub" />
            </button>

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
