"use client";

// 풀스크린 세로 스와이프 영상 피드.
// scroll-snap-y mandatory + IntersectionObserver로 화면에 들어온 영상만 자동재생.
// muted+playsinline 필수 (iOS Safari 자동재생 정책).

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Play, Share2, Eye, Volume2, VolumeX } from "lucide-react";
import type { Short } from "@/lib/shorts-repo";
import { incrementShortView, incrementShortLike, youTubeEmbedUrl } from "@/lib/shorts-repo";
import { sanitizeImageUrl, sanitizeHttpUrl } from "@/lib/url-validate";

const VIEW_DEDUP_KEY = "dosigongzon_short_views_v1";
const LIKE_DEDUP_KEY = "dosigongzon_short_likes_v1";
const VIEW_TTL_HOURS = 24;

interface Props {
  initialItems: Short[];
}

export default function ShortsFeed({ initialItems }: Props) {
  // items: 사용자가 카드를 볼 때마다 그 다음 부분을 재셔플 → "한 영상 볼 때마다 무작위" 효과.
  // 이미 본 카드(currentIndex 이하)는 위치 고정, 안 본 카드만 매번 셔플.
  const [items, setItems] = useState<Short[]>(initialItems);
  const currentIndexRef = useRef(0);
  // muted: 진입 직후엔 true (브라우저 자동재생 정책상 muted 만 자동재생 허용).
  // 사용자가 한 번이라도 탭/스크롤하면 false로 바뀌고 모든 영상이 소리 재생.
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 카드가 새로 보이게 되면 호출 — 그 카드 이후 부분을 재셔플
  const handleVisible = useCallback((index: number) => {
    // 뒤로 스크롤(이미 본 카드 재시청)일 땐 셔플 X
    if (index <= currentIndexRef.current) {
      currentIndexRef.current = index;
      return;
    }
    currentIndexRef.current = index;
    setItems((prev) => {
      const head = prev.slice(0, index + 1);
      const tail = [...prev.slice(index + 1)];
      // Fisher-Yates
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j], tail[i]];
      }
      return [...head, ...tail];
    });
  }, []);

  // 방문자 카운터 — /shorts 진입도 사이트 방문으로 집계 (IP 기준 하루 1회 dedup)
  useEffect(() => {
    fetch("/api/visit", { method: "POST" }).catch(() => {});
  }, []);

  // 첫 인터랙션 시 자동 unmute (브라우저 정책상 사용자 제스처가 있어야 소리 재생 가능)
  // ⚠ 음소거 버튼 자체 탭은 제외 — 그렇지 않으면 자동 unmute와 버튼 토글이 같은 탭에서
  //    같이 발동해 서로 상쇄됨 (단일 탭이 무효화되는 버그).
  // ⚠ YouTube iframe 내부 탭은 cross-origin이라 어차피 이 리스너에 안 잡힘.
  //    화면 영역 대부분이 iframe이라 자동 unmute는 스와이프(scroll)로 주로 발동.
  useEffect(() => {
    if (!muted) return;
    const enable = (e: Event) => {
      const target = e.target as HTMLElement | null;
      // 음소거 버튼 탭은 무시 — 버튼이 직접 toggle 처리
      if (target?.closest("[data-mute-toggle]")) return;
      setMuted(false);
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("click", enable);
      document.removeEventListener("touchstart", enable);
      document.removeEventListener("keydown", enable);
      document.removeEventListener("scroll", enable, true);
    };
    const opts: AddEventListenerOptions = { passive: true };
    document.addEventListener("click", enable, opts);
    document.addEventListener("touchstart", enable, opts);
    document.addEventListener("keydown", enable, opts);
    document.addEventListener("scroll", enable, { capture: true, passive: true });
    return cleanup;
  }, [muted]);

  // 영상 끝나면 다음 영상으로 자동 스크롤 (cardEl의 다음 형제 요소로)
  const advanceNext = useCallback((cardEl: HTMLElement | null) => {
    if (!cardEl) return;
    const next = cardEl.nextElementSibling;
    if (next instanceof HTMLElement) {
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // 마지막 영상이면 그대로 두기 (재생 끝남 표시)
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-y-scroll"
      style={{
        background: "#000000",
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* 스크롤바 숨김 */}
      <style>{`
        .shorts-feed-scroll::-webkit-scrollbar { display: none; }
        .shorts-card video::-webkit-media-controls { display: none !important; }
      `}</style>

      {/* 상단 바 — 닫기 + 타이틀 + 음소거 토글 */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-12 pb-3 pointer-events-none">
        <Link
          href="/"
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
          aria-label="닫기"
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </Link>
        <div
          className="px-3 py-1 rounded-full pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
        >
          <p className="text-[12px] font-extrabold text-white tracking-tight">도시공존 영상</p>
        </div>
        <button
          type="button"
          data-mute-toggle="true"
          onClick={() => setMuted((m) => !m)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
          aria-label={muted ? "소리 켜기" : "음소거"}
        >
          {muted ? <VolumeX size={18} color="#FFFFFF" /> : <Volume2 size={18} color="#FFFFFF" />}
        </button>
      </div>

      {/* 첫 인터랙션 전 힌트 — iframe 영역은 탭 이벤트를 부모에 전달 안 하므로
          "탭" 대신 우상단 버튼을 안내 */}
      {muted && (
        <div
          className="fixed left-1/2 z-30 px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            top: 108,
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <p className="text-[11px] font-bold text-white tracking-tight">
            🔇 우상단 버튼으로 소리 켜기
          </p>
        </div>
      )}

      {items.map((s, i) => {
        // 복합 키 — 같은 short.id가 여러 사이클에 반복 등장해도 React key 충돌 방지
        const key = `${i}-${s.id}`;
        return s.youtube_video_id
          ? <YouTubeShortCard key={key} short={s} muted={muted} index={i} onEnded={advanceNext} onVisible={handleVisible} />
          : <ShortCard key={key} short={s} muted={muted} index={i} onEnded={advanceNext} onVisible={handleVisible} />;
      })}
    </div>
  );
}

function ShortCard({ short, muted, index, onEnded, onVisible }: { short: Short; muted: boolean; index: number; onEnded: (cardEl: HTMLElement | null) => void; onVisible: (index: number) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewCountedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(short.like_count);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  const videoUrl = sanitizeHttpUrl(short.video_url ?? "", "");
  const thumbUrl = sanitizeImageUrl(short.thumbnail_url ?? "", "");

  const handleEnded = useCallback(() => {
    onEnded(cardRef.current);
  }, [onEnded]);

  // 이미 좋아요 누른 영상인지 (디바이스별)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKE_DEDUP_KEY);
      if (!raw) return;
      const set: Record<string, true> = JSON.parse(raw);
      if (set[short.id]) setLiked(true);
    } catch { /* ignore */ }
  }, [short.id]);

  // IntersectionObserver: 화면에 50% 이상 보이면 재생, 벗어나면 정지
  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => { /* 자동재생 실패 무시 */ });
          // 보이는 카드 알림 → ShortsFeed에서 다음 부분 재셔플
          onVisible(index);
          // 1초 이상 보면 조회수 1회 카운트
          if (!viewCountedRef.current) {
            viewCountedRef.current = true;
            window.setTimeout(() => maybeCountView(short.id), 1000);
          }
        } else {
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [short.id, index, onVisible]);

  // 음소거 동기화
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // 첫 영상은 즉시 재생 시도
  useEffect(() => {
    if (index === 0) {
      videoRef.current?.play().catch(() => { /* ignore */ });
    }
  }, [index]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => { /* ignore */ });
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  }, []);

  const handleLike = useCallback(() => {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    setShowHeartBurst(true);
    window.setTimeout(() => setShowHeartBurst(false), 700);
    void incrementShortLike(short.id);
    try {
      const raw = localStorage.getItem(LIKE_DEDUP_KEY);
      const set: Record<string, true> = raw ? JSON.parse(raw) : {};
      set[short.id] = true;
      localStorage.setItem(LIKE_DEDUP_KEY, JSON.stringify(set));
    } catch { /* ignore */ }
  }, [liked, short.id]);

  const handleShare = useCallback(async () => {
    // 특정 영상 deep-link — 받는 사람이 그 영상부터 시청 시작
    const url = `https://dosigongzon.com/shorts/${short.id}`;
    const text = `${short.title} — 도시공존`;
    try {
      if (navigator.share) {
        await navigator.share({ title: short.title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("링크가 복사됐어요");
      }
    } catch { /* 사용자 취소 등 무시 */ }
  }, [short.title, short.id]);

  return (
    <div
      ref={cardRef}
      className="shorts-card relative w-full"
      style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {/* 영상 — 끝나면 다음 영상으로 자동 이동 (loop 없음) */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbUrl || undefined}
          muted={muted}
          playsInline
          preload={index < 2 ? "auto" : "metadata"}
          onClick={togglePlay}
          onEnded={handleEnded}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", background: "#000" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 text-[12px]">
          영상을 불러올 수 없어요
        </div>
      )}

      {/* 일시정지 표시 */}
      {paused && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center pointer-events-auto"
          style={{ background: "rgba(0,0,0,0.25)" }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
          >
            <Play size={36} color="#FFFFFF" fill="#FFFFFF" />
          </div>
        </div>
      )}

      {/* 더블탭 하트 버스트 */}
      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            size={120}
            color="#FF4D6D"
            fill="#FF4D6D"
            className="animate-shorts-burst"
          />
        </div>
      )}

      {/* 우측 액션 스택 — 조회수 → 좋아요 → 공유 순 */}
      <div className="absolute right-3 bottom-32 z-30 flex flex-col items-center gap-5">
        <ViewCountDisplay count={short.view_count} />
        <ActionButton
          onClick={handleLike}
          icon={
            <Heart
              size={28}
              color={liked ? "#FF4D6D" : "#FFFFFF"}
              fill={liked ? "#FF4D6D" : "none"}
              strokeWidth={2}
            />
          }
          label={likeCount.toLocaleString()}
        />
        <ActionButton
          onClick={handleShare}
          icon={<Share2 size={26} color="#FFFFFF" strokeWidth={2} />}
          label="공유"
        />
      </div>

      {/* 하단 정보 */}
      <div
        className="absolute left-0 right-0 bottom-0 px-4 pb-8 pt-16 z-20 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      >
        <div className="max-w-[300px]">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)" }}>
            <span className="text-[9.5px] font-extrabold tracking-[0.12em] text-white">@도시공존</span>
          </div>
          <p className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
            {short.title}
          </p>
          {short.description && (
            <p className="text-[12px] text-white/85 leading-relaxed mt-1.5 whitespace-pre-line line-clamp-3">
              {short.description}
            </p>
          )}
          <p className="text-[10.5px] text-white/55 mt-2">
            조회 {short.view_count.toLocaleString()}회
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shorts-burst {
          0%   { transform: scale(0.4); opacity: 0; }
          25%  { transform: scale(1.15); opacity: 1; }
          70%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .animate-shorts-burst { animation: shorts-burst 0.7s ease-out forwards; }
      `}</style>
    </div>
  );
}

// 조회수 표시 — 클릭 안 됨, 액션 스택 맨 위 위치용
function ViewCountDisplay({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
      >
        <Eye size={24} color="#FFFFFF" strokeWidth={2} />
      </div>
      <span className="text-[10.5px] font-extrabold text-white drop-shadow">
        {formatViewCount(count)}
      </span>
    </div>
  );
}

// 조회수 포맷 — 1,234 / 12.3K / 1.2M
function formatViewCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1000000) return `${Math.floor(n / 1000)}K`;
  return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

function ActionButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
      >
        {icon}
      </div>
      <span className="text-[10.5px] font-extrabold text-white drop-shadow">{label}</span>
    </button>
  );
}

// ══════════════════════════════════════════
// YouTube 임베드 카드 — youtube_video_id 있을 때
// IFrame Player API의 postMessage로 play/pause/mute 제어
// ══════════════════════════════════════════
function YouTubeShortCard({ short, muted, index, onEnded, onVisible }: { short: Short; muted: boolean; index: number; onEnded: (cardEl: HTMLElement | null) => void; onVisible: (index: number) => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewCountedRef = useRef(false);
  // 보이는 카드인지 추적 — iframe.onLoad 시 isVisible이면 즉시 playVideo 전송
  // (autoplay=1 제거 후, iframe 로드와 IntersectionObserver 둘 다에서 재생 트리거)
  const isVisibleRef = useRef(false);
  const iframeLoadedRef = useRef(false);
  // muted를 ref로도 추적 — onIframeLoad가 클로저 시점의 stale 값이 아닌 최신값 사용.
  // 지연 로드된 iframe이 항상 mute=1로 시작하지만, 로드 시점에 mutedRef로 현재 상태 반영.
  const mutedRef = useRef(muted);
  // 지연 로드: 첫 2개만 즉시 iframe 렌더, 나머지는 viewport 근처 진입 시.
  // 30개 iframe(개당 ~1MB) 한꺼번에 로드 → 30MB 트래픽 문제 해결.
  const [shouldLoad, setShouldLoad] = useState(index < 2);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(short.like_count);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  // muted prop 변화 시 ref 동기화
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const videoId = short.youtube_video_id!;
  const embedUrl = youTubeEmbedUrl(videoId);
  const thumbUrl = sanitizeImageUrl(short.thumbnail_url ?? "", "");

  // postMessage 헬퍼 — YouTube IFrame API의 JSON 명령 전달
  const sendCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);

  // 지연 로드 — viewport 1.5배 거리에서 iframe 렌더 트리거
  useEffect(() => {
    if (shouldLoad) return;
    const card = cardRef.current;
    if (!card) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [shouldLoad]);

  // YouTube iframe 이벤트 구독 + ENDED 감지 → 다음 영상으로 스크롤
  // + iframe 로드 시 보이는 카드면 자동 재생 (autoplay=1 제거 대응)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onIframeLoad = () => {
      iframeLoadedRef.current = true;
      // YouTube IFrame API 이벤트 구독
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: short.id, channel: "widget" }),
        "*",
      );
      // 현재 muted 상태를 새 iframe에 적용 — 이게 없으면 lazy-load된 iframe은
      // mute=1 URL로 시작했으니 항상 음소거 상태로 남아 "넘기면 소리 났다 안 났다" 발생.
      iframe.contentWindow?.postMessage(
        JSON.stringify({
          event: "command",
          func: mutedRef.current ? "mute" : "unMute",
          args: [],
        }),
        "*",
      );
      // 현재 보이는 카드면 재생 (소리 겹침 방지를 위해 보이는 카드만 재생)
      if (isVisibleRef.current) {
        window.setTimeout(() => sendCommand("playVideo"), 50);
      }
    };

    iframe.addEventListener("load", onIframeLoad);

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      let data: unknown;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (
        data
        && typeof data === "object"
        && (data as { event?: string }).event === "infoDelivery"
      ) {
        const info = (data as { info?: { playerState?: number } }).info;
        // 0 = ENDED — 다음 영상으로 이동
        if (info?.playerState === 0) {
          onEnded(cardRef.current);
        }
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      iframe.removeEventListener("load", onIframeLoad);
      window.removeEventListener("message", onMessage);
    };
  }, [short.id, onEnded, sendCommand, shouldLoad]);

  // 이미 좋아요 누른 영상인지
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIKE_DEDUP_KEY);
      if (!raw) return;
      const set: Record<string, true> = JSON.parse(raw);
      if (set[short.id]) setLiked(true);
    } catch { /* ignore */ }
  }, [short.id]);

  // IntersectionObserver: 60% 이상 보이면 재생, 벗어나면 정지
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        isVisibleRef.current = visible;
        if (visible) {
          // iframe이 아직 안 로드됐으면 onLoad 핸들러가 처리. 로드됐으면 즉시 재생.
          if (iframeLoadedRef.current) {
            sendCommand("playVideo");
          }
          // 보이는 카드 알림 → ShortsFeed에서 다음 부분 재셔플
          onVisible(index);
          if (!viewCountedRef.current) {
            viewCountedRef.current = true;
            window.setTimeout(() => maybeCountView(short.id), 1000);
          }
        } else {
          sendCommand("pauseVideo");
          sendCommand("seekTo", [0, true]);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [short.id, sendCommand, index, onVisible]);

  // 음소거 동기화
  useEffect(() => {
    sendCommand(muted ? "mute" : "unMute");
  }, [muted, sendCommand]);

  // 첫 영상 fallback — iframe.onLoad와 IO에서 모두 못 잡았을 경우 안전망.
  // ⚠ isVisibleRef 가드 필수: 사용자가 즉시 스크롤하면 이 timer가 비가시 카드를
  //    재생시켜 소리 겹침이 다시 발생할 수 있음.
  useEffect(() => {
    if (index === 0) {
      const t = window.setTimeout(() => {
        if (isVisibleRef.current && iframeLoadedRef.current) {
          sendCommand("playVideo");
        }
      }, 800);
      return () => window.clearTimeout(t);
    }
  }, [index, sendCommand]);

  const handleLike = useCallback(() => {
    if (liked) return;
    setLiked(true);
    setLikeCount((c) => c + 1);
    setShowHeartBurst(true);
    window.setTimeout(() => setShowHeartBurst(false), 700);
    void incrementShortLike(short.id);
    try {
      const raw = localStorage.getItem(LIKE_DEDUP_KEY);
      const set: Record<string, true> = raw ? JSON.parse(raw) : {};
      set[short.id] = true;
      localStorage.setItem(LIKE_DEDUP_KEY, JSON.stringify(set));
    } catch { /* ignore */ }
  }, [liked, short.id]);

  const handleShare = useCallback(async () => {
    // 특정 영상 deep-link — 받는 사람이 그 영상부터 시청 시작
    const url = `https://dosigongzon.com/shorts/${short.id}`;
    const text = `${short.title} — 도시공존`;
    try {
      if (navigator.share) {
        await navigator.share({ title: short.title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("링크가 복사됐어요");
      }
    } catch { /* 사용자 취소 등 무시 */ }
  }, [short.title, short.id]);

  return (
    <div
      ref={cardRef}
      className="shorts-card relative w-full"
      style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {/* 썸네일 백그라운드 — iframe 로드 전 보임 */}
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover", filter: "blur(4px)", opacity: 0.6 }}
        />
      )}

      {/* iframe — 9:16 세로 비율로 화면 가운데 정렬. shouldLoad=true일 때만 렌더 */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <div
          className="relative w-full"
          style={{
            // 화면 높이에 맞춰 9:16 비율 유지 (좌우 잘림 없이)
            aspectRatio: "9 / 16",
            maxHeight: "100dvh",
          }}
        >
          {shouldLoad ? (
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              style={{ border: 0, pointerEvents: "auto" }}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={short.title}
            />
          ) : (
            // 지연 로드 placeholder — 선명한 썸네일만 보임 (스크롤 가까워지면 iframe 교체)
            thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt={short.title}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[12px]">
                로딩 대기 중…
              </div>
            )
          )}
        </div>
      </div>

      {/* 더블탭 하트 버스트 */}
      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            size={120}
            color="#FF4D6D"
            fill="#FF4D6D"
            className="animate-shorts-burst"
          />
        </div>
      )}

      {/* 우측 액션 스택 — 조회수 → 좋아요 → 공유 순 */}
      <div className="absolute right-3 bottom-32 z-30 flex flex-col items-center gap-5">
        <ViewCountDisplay count={short.view_count} />
        <ActionButton
          onClick={handleLike}
          icon={
            <Heart
              size={28}
              color={liked ? "#FF4D6D" : "#FFFFFF"}
              fill={liked ? "#FF4D6D" : "none"}
              strokeWidth={2}
            />
          }
          label={likeCount.toLocaleString()}
        />
        <ActionButton
          onClick={handleShare}
          icon={<Share2 size={26} color="#FFFFFF" strokeWidth={2} />}
          label="공유"
        />
      </div>

      {/* 하단 정보 */}
      <div
        className="absolute left-0 right-0 bottom-0 px-4 pb-8 pt-16 z-20 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      >
        <div className="max-w-[300px] pointer-events-auto">
          {/* 원본 유튜브 채널 표시 — 저작권 출처. 채널 URL 있으면 그쪽, 없으면 영상 페이지로 */}
          <a
            href={
              short.youtube_channel_url
                ? sanitizeHttpUrl(short.youtube_channel_url, `https://www.youtube.com/watch?v=${videoId}`)
                : `https://www.youtube.com/watch?v=${videoId}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full mb-2 active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)" }}
          >
            <span className="text-[9.5px] font-extrabold tracking-[0.12em] text-white">
              @{short.youtube_channel_name || "YouTube"} · 원본 보기 ↗
            </span>
          </a>
          <p className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
            {short.title}
          </p>
          {short.description && (
            <p className="text-[12px] text-white/85 leading-relaxed mt-1.5 whitespace-pre-line line-clamp-3">
              {short.description}
            </p>
          )}
          <p className="text-[10.5px] text-white/55 mt-2">
            조회 {short.view_count.toLocaleString()}회
          </p>
        </div>
      </div>
    </div>
  );
}

// 24시간 내 중복 방지 후 조회수 RPC 호출
function maybeCountView(id: string) {
  try {
    const raw = localStorage.getItem(VIEW_DEDUP_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const last = map[id] ?? 0;
    const now = Date.now();
    if (now - last < VIEW_TTL_HOURS * 3600 * 1000) return;
    map[id] = now;
    // GC: 100개 초과시 오래된 것 정리
    const entries = Object.entries(map);
    if (entries.length > 100) {
      entries.sort((a, b) => b[1] - a[1]);
      const trimmed = Object.fromEntries(entries.slice(0, 100));
      localStorage.setItem(VIEW_DEDUP_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(VIEW_DEDUP_KEY, JSON.stringify(map));
    }
  } catch { /* ignore */ }
  void incrementShortView(id);
}
