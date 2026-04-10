"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, MapPin, Heart, Plus, Loader2, Send, AlertTriangle, MessageCircle } from "lucide-react";
import AddCatModal from "@/app/components/AddCatModal";
import {
  listCats,
  listComments,
  createComment,
  MAP_CENTER,
  type Cat,
  type CatComment,
  type CommentKind,
} from "@/lib/cats-repo";

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

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | undefined>();

  // ── 댓글 상태 ──
  const [comments, setComments] = useState<CatComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>("note");
  const [submittingComment, setSubmittingComment] = useState(false);

  // 선택된 고양이 변경 시 댓글 로드
  useEffect(() => {
    if (!selectedCat) {
      setComments([]);
      setNewComment("");
      setCommentsError("");
      return;
    }
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError("");
    listComments(selectedCat.id)
      .then((list) => {
        if (!cancelled) setComments(list);
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
  }, [selectedCat]);

  const handleSubmitComment = async () => {
    if (!selectedCat || !newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const created = await createComment(selectedCat.id, newComment, commentKind);
      setComments((prev) => [created, ...prev]);
      setNewComment("");
      setCommentKind("note");
    } catch (err) {
      setCommentsError(err instanceof Error ? err.message : "댓글 작성 실패");
    } finally {
      setSubmittingComment(false);
    }
  };

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── DB에서 고양이 목록 불러오기 ──
  const fetchCats = useCallback(async () => {
    setLoadingCats(true);
    setCatsError("");
    try {
      const data = await listCats();
      setCats(data);
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

  // ── cats 변경 시 마커 다시 그리기 ──
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.kakao) return;

    // 기존 마커 제거
    overlaysRef.current.forEach((ov) => ov.setMap(null));
    overlaysRef.current = [];

    cats.forEach((cat) => {
      const position = new window.kakao.maps.LatLng(cat.lat, cat.lng);

      const content = document.createElement("div");
      const photoUrl = cat.photo_url ?? "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F";
      content.innerHTML = `
        <div style="
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 3px solid #C47E5A;
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          overflow: hidden;
          cursor: pointer;
          transform: translate(-50%, -100%);
          background-image: url('${photoUrl}');
          background-size: cover;
          background-position: center;
        "></div>
        <div style="
          width: 12px;
          height: 12px;
          background: #C47E5A;
          transform: translate(-50%, -100%) rotate(45deg);
          margin-top: -8px;
        "></div>
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
  }, [cats, mapReady]);

  const handleCatCreated = (newCat: Cat) => {
    setCats((prev) => [newCat, ...prev]);
    setSelectedCat(newCat);
    // 지도 중심을 새 핀으로 이동
    if (mapInstanceRef.current && window.kakao) {
      const pos = new window.kakao.maps.LatLng(newCat.lat, newCat.lng);
      mapInstanceRef.current.setCenter(pos);
    }
  };

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
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-12 pb-3 pointer-events-none">
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

      {/* + 등록 FAB */}
      <button
        onClick={handleAddClick}
        className="absolute bottom-6 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-30"
        aria-label="고양이 등록"
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </button>

      {/* 선택된 고양이 카드 */}
      {selectedCat && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pointer-events-none">
          <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_-4px_24px_rgba(0,0,0,0.12)] pointer-events-auto animate-slide-up">
            <button
              onClick={() => setSelectedCat(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform shadow-sm"
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
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: isAlert ? "#B84545" : "#C47E5A" }}
                          >
                            {c.author_name ?? "익명"}
                          </span>
                          <span className="text-[10px] text-text-light ml-auto">
                            {formatRelativeTime(c.created_at)}
                          </span>
                        </div>
                        <p
                          className="text-[12px] leading-relaxed"
                          style={{ color: isAlert ? "#8B2F2F" : "#4A3F35" }}
                        >
                          {c.body}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {commentsError && (
                  <p className="text-[11px] mt-2" style={{ color: "#B84545" }}>
                    {commentsError}
                  </p>
                )}

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
                    disabled={!newComment.trim() || submittingComment}
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
