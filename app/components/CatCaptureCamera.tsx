"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import ParticleCanvas, { type ParticleCanvasHandle } from "@/app/components/ParticleCanvas";
import SfxToggle from "@/app/components/SfxToggle";
import { sfx, primeSfx } from "@/lib/sfx";

interface Props {
  onCapture: (file: File, isPerfectCatch: boolean) => void;
  onClose: () => void;
  onFallbackGallery?: () => void;
  onFallbackCapture?: () => void;
  previewFile?: File;
}

type CamState = "requesting" | "ready" | "denied" | "blocked" | "error" | "preview";
type ThrowState = "idle" | "pulling" | "flying" | "hit" | "miss";

// 투척 튜닝값
const MIN_PULL_Y = 40;    // 이 이상 위로 당겨야 실제 투척으로 인정
const MAX_PULL_Y = 150;
const MAX_DRAG_X = 130;

// 타이밍 바 튜닝값 (좌우로 오가는 구슬을 정해진 구간에 맞춰 던져야 포획)
const BAR_MIN = 6, BAR_MAX = 94;       // 구슬 이동 범위 (%)
const SWEET_WIDTH_MIN = 11, SWEET_WIDTH_MAX = 21; // 시도마다 폭이 랜덤 (쉬울 때/빡빡할 때 섞임)
const SWEEP_MS_BASE = 1050;            // 구슬 한 방향 이동에 걸리는 시간(ms) — 시도마다 조금씩 빨라짐
const TOTAL_TRIES = 3;

function randomSweetSpot(widen: boolean) {
  const width = (SWEET_WIDTH_MIN + Math.random() * (SWEET_WIDTH_MAX - SWEET_WIDTH_MIN)) * (widen ? 1.6 : 1);
  const start = BAR_MIN + Math.random() * (BAR_MAX - BAR_MIN - width);
  const perfectMargin = width * 0.3; // 중앙 40%는 "완벽 포획" 구간
  return { start, end: start + width, perfectStart: start + perfectMargin, perfectEnd: start + width - perfectMargin };
}

export default function CatCaptureCamera({ onCapture, onClose, onFallbackGallery, onFallbackCapture, previewFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const throwAreaRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<ParticleCanvasHandle>(null);

  const [camState, setCamState] = useState<CamState>(previewFile ? "preview" : "requesting");
  const [caught, setCaught] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [perfectCatch, setPerfectCatch] = useState(false);
  // 타격감 연출 — 화면 흔들림 (0=없음, 1=미스, 2=명중, 3=완벽 포획)
  const [impactShake, setImpactShake] = useState<0|1|2|3>(0);
  const [shutterFlash, setShutterFlash] = useState(false);
  const chargeSoundPlayedRef = useRef(false);

  // 투척 상태
  const [throwState, setThrowState] = useState<ThrowState>("idle");
  const [pullY, setPullY] = useState(0);       // 당긴 거리 (px)
  const [churuX, setChuruX] = useState(0);     // 좌우 드래그 원본값 (캔이 손가락을 따라감, 비행 연출용)
  const [landingDx, setLandingDx] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // 타이밍 바 (구슬 위치 + 성공 구간 + 남은 기회)
  const markerPosRef = useRef(BAR_MIN);
  const markerDirRef = useRef(1);
  const speedMultRef = useRef(1);
  const [markerPos, setMarkerPos] = useState(BAR_MIN);
  const [sweetSpot, setSweetSpot] = useState(() => randomSweetSpot(false));
  const attemptsLeftRef = useRef(TOTAL_TRIES);
  const [attemptsLeft, setAttemptsLeftState] = useState(TOTAL_TRIES);
  const roundsFailedRef = useRef(0);
  const throwStateRef = useRef<ThrowState>("idle");
  const sweepAnimRef = useRef<number>(0);

  const setAttemptsLeft = (v: number) => { attemptsLeftRef.current = v; setAttemptsLeftState(v); };

  // 갤러리 URL
  useEffect(() => {
    if (!previewFile) return;
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  // 카메라 시작
  const startCamera = useCallback(async () => {
    setCamState("requesting");
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("ready");
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError") {
        try {
          const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
          setCamState(perm.state === "denied" ? "blocked" : "denied");
        } catch { setCamState("denied"); }
      } else { setCamState("error"); }
    }
  }, []);

  useEffect(() => {
    if (previewFile) return;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animRef.current);
    };
  }, [startCamera, previewFile]);

  // 타이밍 바 구슬 애니메이션 — idle/pulling일 때만 좌우로 왕복
  useEffect(() => {
    throwStateRef.current = throwState;
  }, [throwState]);

  useEffect(() => {
    if (caught) { cancelAnimationFrame(sweepAnimRef.current); return; }
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const s = throwStateRef.current;
      if (s === "idle" || s === "pulling") {
        const sweepMs = Math.max(650, SWEEP_MS_BASE - roundsFailedRef.current * 60);
        const speed = ((BAR_MAX - BAR_MIN) / sweepMs) * speedMultRef.current; // %/ms
        let pos = markerPosRef.current + markerDirRef.current * speed * dt;
        if (pos >= BAR_MAX) { pos = BAR_MAX; markerDirRef.current = -1; speedMultRef.current = 0.75 + Math.random() * 0.6; }
        if (pos <= BAR_MIN) { pos = BAR_MIN; markerDirRef.current = 1; speedMultRef.current = 0.75 + Math.random() * 0.6; }
        markerPosRef.current = pos;
        setMarkerPos(pos);
      }
      sweepAnimRef.current = requestAnimationFrame(loop);
    };
    sweepAnimRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(sweepAnimRef.current);
  }, [caught]);

  // 사진 캡처 (카메라 모드)
  const capturePhoto = useCallback((): Promise<File | null> => {
    if (!videoRef.current || !canvasRef.current) return Promise.resolve(null);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], `catchcat_${Date.now()}.jpg`, { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });
  }, []);

  // 캔 던지는 궤적을 따라 스파크 잔상을 뿌린다 (실제 비행 물리 느낌)
  const emitThrowTrail = useCallback((dxTotal: number, dyTotal: number) => {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        const x = 0.5 + (dxTotal * p) / w;
        const y = 0.83 + (dyTotal * p) / h;
        particleRef.current?.burst(x, y, "spark", 2, "255,170,60");
      }, p * 550);
    }
  }, []);

  // 포획 완료 처리
  const finishCapture = useCallback(async (isPerfect: boolean) => {
    setCaught(true);
    setTimeout(() => {
      particleRef.current?.burst(0.5, 0.42, "star", isPerfect ? 26 : 14, isPerfect ? "255,225,90" : "255,255,255");
    }, 250);
    setTimeout(async () => {
      sfx.shutter();
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 180);
      if (previewFile) {
        onCapture(previewFile, isPerfect);
      } else {
        const file = await capturePhoto();
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (file) onCapture(file, isPerfect);
      }
    }, 1300);
  }, [previewFile, onCapture, capturePhoto]);

  // 고양이 캔 던지기 - 포인터 이벤트 (터치+마우스+펜 공통. 당겼다 놓는 제스처 + 놓는 순간의 타이밍으로 성공 판정)
  // TouchEvent만 처리하면 터치스크린 없는 PC에서는 마우스 드래그에 반응하지 않아 Pointer Event로 통합.
  const handleTouchStart = useCallback((e: React.PointerEvent) => {
    if (throwState !== "idle" || caught) return;
    primeSfx();
    chargeSoundPlayedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    setPullY(0);
    setChuruX(0);
  }, [throwState, caught]);

  const handleTouchMove = useCallback((e: React.PointerEvent) => {
    if ((throwState !== "idle" && throwState !== "pulling") || caught) return;
    e.preventDefault();
    const dy = touchStartRef.current.y - e.clientY;
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, e.clientX - touchStartRef.current.x));
    if (dy > 5) {
      if (!chargeSoundPlayedRef.current) { chargeSoundPlayedRef.current = true; sfx.chargeUp(); }
      setThrowState("pulling");
      setPullY(Math.min(dy, MAX_PULL_Y));
      setChuruX(dx);
    }
  }, [throwState, caught]);

  const handleTouchEnd = useCallback((e: React.PointerEvent) => {
    if (caught) return;
    const dy = touchStartRef.current.y - e.clientY;
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, e.clientX - touchStartRef.current.x));

    if (dy > MIN_PULL_Y) {
      const finalPos = markerPosRef.current;
      const isHit = finalPos >= sweetSpot.start && finalPos <= sweetSpot.end;
      const isPerfect = isHit && finalPos >= sweetSpot.perfectStart && finalPos <= sweetSpot.perfectEnd;
      setLandingDx(dx * 2.2);
      setThrowState("flying");
      sfx.throwCan();
      emitThrowTrail(dx * 2.2, -(window.innerHeight * 0.55));

      setTimeout(() => {
        if (isHit) {
          roundsFailedRef.current = 0;
          setPerfectCatch(isPerfect);
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(isPerfect ? [30, 40, 60] : 40);
          setThrowState("hit");
          setImpactShake(isPerfect ? 3 : 2);
          setTimeout(() => setImpactShake(0), isPerfect ? 700 : 450);
          const burstColor = isPerfect ? "255,225,90" : "255,255,255";
          particleRef.current?.burst(0.5, 0.38, "star", isPerfect ? 22 : 12, burstColor);
          particleRef.current?.burst(0.5, 0.38, "shockwave", 1, burstColor);
          if (isPerfect) particleRef.current?.burst(0.5, 0.38, "spark", 16, "255,215,120");
          sfx.catchHit();
          if (isPerfect) setTimeout(() => sfx.perfect(), 120);
          finishCapture(isPerfect);
        } else {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
          const remaining = attemptsLeftRef.current - 1;
          if (remaining <= 0) {
            roundsFailedRef.current += 1;
            setAttemptsLeft(TOTAL_TRIES);
          } else {
            setAttemptsLeft(remaining);
          }
          setSweetSpot(randomSweetSpot(roundsFailedRef.current >= 2));
          setThrowState("miss");
          setImpactShake(1);
          sfx.miss();
          particleRef.current?.burst(0.5, 0.55, "spark", 6, "180,180,180");
          setTimeout(() => setImpactShake(0), 350);
          setTimeout(() => { setThrowState("idle"); setPullY(0); setChuruX(0); }, 800);
        }
      }, 600);
    } else {
      setThrowState("idle");
      setPullY(0);
      setChuruX(0);
    }
  }, [caught, finishCapture, sweetSpot, emitThrowTrail]);

  // 배경 (카메라 or 갤러리 사진)
  const showBg = camState === "ready" || camState === "preview";
  const isLive = camState === "ready";

  // 고양이 캔 던지기 비행 궤적 계산 (방향은 드래그, 명중 여부는 타이밍 바로 결정)
  const flyDx = throwState === "flying" || throwState === "hit" || throwState === "miss" ? landingDx : churuX * 2.2;
  const flyDy = -(typeof window !== "undefined" ? window.innerHeight * 0.55 : 400);
  const missFlyDx = flyDx + Math.sign(flyDx || 1) * 90;

  return (
    <>
      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes churu-fly-hit {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          55%  { transform: translate(${flyDx * 0.6}px,${flyDy * 0.68}px) rotate(-460deg) scale(0.75); opacity:1; }
          85%  { transform: translate(${flyDx}px,${flyDy}px) rotate(-640deg) scale(0.48); opacity:1; }
          100% { transform: translate(${flyDx}px,${flyDy}px) rotate(-640deg) scale(0.2); opacity:0; }
        }
        @keyframes churu-fly-miss {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          55%  { transform: translate(${missFlyDx * 0.55}px,${flyDy * 0.75}px) rotate(-420deg) scale(0.8); opacity:1; }
          100% { transform: translate(${missFlyDx}px,${flyDy * 0.92}px) rotate(-680deg) scale(0.55); opacity:0; }
        }
        @keyframes cat-flinch {
          0%   { transform: translateX(0) scale(1); filter:brightness(1); }
          20%  { transform: translateX(-10px) scale(1.03); filter:brightness(1.3); }
          45%  { transform: translateX(9px) scale(0.99); filter:brightness(1.1); }
          70%  { transform: translateX(-5px) scale(1.01); filter:brightness(1.05); }
          100% { transform: translateX(0) scale(1); filter:brightness(1); }
        }
        @keyframes cat-dodge {
          0%   { transform: translateX(0) rotate(0deg); }
          30%  { transform: translateX(${churuX > 0 ? -14 : 14}px) rotate(${churuX > 0 ? -3 : 3}deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes caught-flash {
          0%   { opacity:0; transform:scale(0.5); }
          50%  { opacity:1; transform:scale(1.2); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes stars-burst {
          0%   { opacity:1; transform:scale(0) rotate(0deg); }
          100% { opacity:0; transform:scale(2) rotate(45deg); }
        }
        @keyframes capture-ring {
          0%   { opacity:0.9; transform:scale(0.3); border-width:6px; }
          100% { opacity:0; transform:scale(2.6); border-width:1px; }
        }
        @keyframes pull-wiggle {
          0%,100% { transform: rotate(-5deg); }
          50%     { transform: rotate(5deg); }
        }
        @keyframes miss-text-pop {
          0%   { opacity:0; transform:translateY(6px) scale(0.85); }
          30%  { opacity:1; transform:translateY(0) scale(1.08); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes marker-glow {
          0%,100% { box-shadow: 0 0 8px 2px rgba(255,210,60,0.8); }
          50%     { box-shadow: 0 0 14px 5px rgba(255,210,60,0.95); }
        }
        @keyframes cam-shake-small {
          0%,100% { transform:translate(0,0); }
          25% { transform:translate(-3px,2px); }
          50% { transform:translate(3px,-2px); }
          75% { transform:translate(-2px,1px); }
        }
        @keyframes cam-shake-big {
          0%,100% { transform:translate(0,0) rotate(0deg); }
          15% { transform:translate(-6px,4px) rotate(-0.5deg); }
          30% { transform:translate(6px,-4px) rotate(0.5deg); }
          45% { transform:translate(-5px,3px); }
          60% { transform:translate(5px,-3px); }
          80% { transform:translate(-2px,1px); }
        }
        @keyframes flash-fade {
          0% { opacity:0; }
          15% { opacity:1; }
          100% { opacity:0; }
        }
        @keyframes shutter-fade {
          0% { opacity:0.95; }
          100% { opacity:0; }
        }
        @keyframes sweet-pulse {
          0%,100% { filter:brightness(1); }
          50%     { filter:brightness(1.35); }
        }
        @keyframes charge-ring-pulse {
          0%,100% { opacity:0.55; transform:scale(1); }
          50%     { opacity:0.9; transform:scale(1.08); }
        }
      `}</style>

      {impactShake === 1 && (
        <div className="fixed inset-0 z-[350] pointer-events-none" style={{ background:"rgba(255,50,50,0.28)", animation:"flash-fade 0.35s ease-out" }} />
      )}
      {(impactShake === 2 || impactShake === 3) && (
        <div className="fixed inset-0 z-[350] pointer-events-none" style={{
          background: impactShake===3
            ? "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,220,80,0.35) 45%, transparent 75%)"
            : "radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, transparent 70%)",
          animation:"flash-fade 0.4s ease-out",
        }} />
      )}
      {shutterFlash && (
        <div className="fixed inset-0 z-[360] pointer-events-none" style={{ background:"white", animation:"shutter-fade 0.18s ease-out" }} />
      )}

      <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden select-none"
        style={{
          animation: impactShake===3 ? "cam-shake-big 0.6s ease" : impactShake===2 ? "cam-shake-big 0.4s ease" : impactShake===1 ? "cam-shake-small 0.3s ease" : undefined,
        }}
      >

        <ParticleCanvas ref={particleRef} zIndex={22} />

        {/* 닫기 */}
        <button
          onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <X size={20} color="white" />
        </button>
        <SfxToggle style={{ position: "absolute", top: 16, right: 62, zIndex: 20 }} />

        {/* 남은 기회 */}
        {showBg && !caught && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="px-3 py-1 rounded-full text-[12px] font-black text-white flex items-center gap-1.5"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              🥫 {attemptsLeft} / {TOTAL_TRIES} 기회
            </div>
          </div>
        )}

        {/* 배경 */}
        {showBg && (
          <div className="absolute inset-0">
            <div style={{
              width: "100%", height: "100%",
              animation: throwState === "hit" ? "cat-flinch 0.5s ease" : throwState === "miss" ? "cat-dodge 0.4s ease" : undefined,
            }}>
              {isLive ? (
                <video ref={videoRef} playsInline muted
                  className="w-full h-full object-cover"
                  style={{ opacity: caught ? 0.55 : 1, filter: caught ? "blur(7px) brightness(0.55)" : "none", transition: "opacity 0.6s, filter 0.6s" }} />
              ) : (
                previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="포획 대상"
                    className="w-full h-full object-cover"
                    style={{ opacity: caught ? 0.55 : 1, filter: caught ? "blur(7px) brightness(0.55)" : "none", transition: "opacity 0.6s, filter 0.6s" }} />
                )
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {/* 비네팅 */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)" }} />
            {/* AR 가이드 프레임 (네 모서리 브래킷) */}
            {!caught && (
              <div className="absolute pointer-events-none" style={{ inset: "18% 10% 34% 10%" }}>
                {[
                  { top: 0, left: 0, borderWidth: "3px 0 0 3px" },
                  { top: 0, right: 0, borderWidth: "3px 3px 0 0" },
                  { bottom: 0, left: 0, borderWidth: "0 0 3px 3px" },
                  { bottom: 0, right: 0, borderWidth: "0 3px 3px 0" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 26, height: 26, borderColor: "#FF9500", borderStyle: "solid", ...s }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 권한 요청 중 */}
        {camState === "requesting" && (
          <div className="flex-1 flex items-center justify-center z-10">
            <div className="text-center px-8">
              <p className="text-[48px] mb-4">📷</p>
              <p className="text-white text-[16px] font-bold">카메라 권한을 요청하는 중...</p>
              <p className="text-gray-400 text-[13px] mt-2">팝업에서 <span className="text-yellow-300 font-bold">허용</span>을 눌러주세요</p>
            </div>
          </div>
        )}

        {/* 권한 거부 */}
        {(camState === "denied" || camState === "blocked" || camState === "error") && (
          <div className="flex-1 flex items-center justify-center z-10">
            <div className="text-center px-8">
              <p className="text-[48px] mb-4">📸</p>
              <p className="text-white text-[16px] font-bold mb-2">카메라를 열 수 없어요</p>
              <p className="text-gray-400 text-[13px] mb-6">기본 카메라 앱으로 찍어서 포획해요</p>
              <div className="flex flex-col gap-2">
                {camState === "denied" && (
                  <button onClick={startCamera}
                    className="px-6 py-3 rounded-2xl font-bold text-[15px] text-black"
                    style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)" }}>
                    카메라 허용하기
                  </button>
                )}
                {onFallbackCapture && (
                  <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackCapture(); }}
                    className="px-6 py-3 rounded-2xl font-bold text-[15px] text-black"
                    style={{ background: "linear-gradient(135deg,#FFD700,#FF8C00)" }}>
                    📷 카메라로 찍기
                  </button>
                )}
                {onFallbackGallery && (
                  <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackGallery(); }}
                    className="px-6 py-3 rounded-2xl font-bold text-[13px]"
                    style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                    갤러리에서 선택하기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 타이밍 바 */}
        {showBg && !caught && (
          <div className="absolute left-0 right-0 z-20 px-6" style={{ top: "13%" }}>
            <p className="text-center text-[11.5px] font-extrabold text-white/85 mb-1.5" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
              {throwState === "miss" ? "⚠️ 타이밍이 안 맞았어요!" : "가운데 하얀 구간에 맞추면 완벽 포획!"}
            </p>
            <div className="relative w-full" style={{ height: 16, borderRadius: 99, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.08)" }}>
              {/* 성공 구간 */}
              <div className="absolute top-0 bottom-0" style={{
                left: `${sweetSpot.start}%`, width: `${sweetSpot.end - sweetSpot.start}%`,
                background: "linear-gradient(90deg, rgba(120,255,140,0.55), rgba(255,220,80,0.75))",
                borderRadius: 99,
                animation: "sweet-pulse 0.9s ease-in-out infinite",
              }} />
              {/* 완벽 포획 구간 (성공 구간 중앙) */}
              <div className="absolute top-0 bottom-0" style={{
                left: `${sweetSpot.perfectStart}%`, width: `${sweetSpot.perfectEnd - sweetSpot.perfectStart}%`,
                background: "rgba(255,255,255,0.85)",
                borderRadius: 99,
                boxShadow: "0 0 10px 2px rgba(255,255,255,0.6)",
                animation: "sweet-pulse 0.9s ease-in-out infinite",
              }} />
              {/* 움직이는 구슬 */}
              <div className="absolute" style={{
                top: -3, left: `${markerPos}%`, width: 22, height: 22, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #FFF6D0, #FFD700 55%, #E09000 100%)",
                transform: "translateX(-50%)",
                animation: (throwState === "idle" || throwState === "pulling") ? "marker-glow 0.5s ease-in-out infinite" : undefined,
                transition: "top 0.15s",
              }} />
            </div>
          </div>
        )}

        {/* 게임 UI */}
        {showBg && (
          <div className="absolute inset-0 flex flex-col items-center justify-between pb-14 pt-16 z-10 pointer-events-none">

            {/* 고양이 영역 */}
            <div className="flex-1 flex items-center justify-center w-full relative">
              {/* 포획 성공 캡처 링 + 별 폭발 */}
              {throwState === "hit" && (
                <>
                  <div className="absolute" style={{
                    width: 100, height: 100, borderRadius: "50%",
                    border: "6px solid rgba(255,220,80,0.9)",
                    animation: "capture-ring 0.6s ease-out forwards",
                  }} />
                  {["✦","★","✦","★","✦"].map((s, i) => (
                    <span key={i} className="absolute text-yellow-300 text-[24px] font-black pointer-events-none"
                      style={{
                        left: `${35 + i * 8}%`, top: `${30 + (i % 2) * 10}%`,
                        animation: "stars-burst 0.6s ease-out forwards",
                        animationDelay: `${i * 0.06}s`,
                      }}>
                      {s}
                    </span>
                  ))}
                </>
              )}

              {/* 포획 완료 연출 (스포트라이트 + 반짝임, 완벽 포획이면 더 화려하게) */}
              {caught && (
                <div className="text-center relative" style={{ animation: "caught-flash 0.5s ease-out" }}>
                  {(perfectCatch ? ["✦","★","✦","★","✦","★","✦","★"] : ["✦","★","✦","★","✦","★"]).map((s, i) => (
                    <span key={i} className={perfectCatch ? "absolute text-yellow-200 text-[26px] font-black pointer-events-none" : "absolute text-yellow-300 text-[20px] font-black pointer-events-none"}
                      style={{
                        left: `${-40 + i * (perfectCatch ? 20 : 26)}%`, top: `${-70 + (i % 2) * 130}%`,
                        animation: "stars-burst 0.9s ease-out infinite",
                        animationDelay: `${i * 0.1}s`,
                      }}>
                      {s}
                    </span>
                  ))}
                  {perfectCatch && (
                    <p className="text-yellow-300 text-[18px] font-black mb-1" style={{ animation: "miss-text-pop 0.3s ease-out forwards" }}>✨ 완벽 포획! ✨</p>
                  )}
                  <p className="text-white text-[42px] font-black drop-shadow-lg leading-none">포획 완료!</p>
                  <p className="text-yellow-300 text-[16px] font-bold mt-2">🐱 고양이 카드 생성 중...</p>
                </div>
              )}

              {/* 미스 */}
              {throwState === "miss" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center"
                  style={{ animation: "miss-text-pop 0.35s ease-out forwards" }}>
                  <p className="text-red-400 text-[28px] font-black">빗나갔다!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 고양이 캔 투척 존 (하단) */}
        {showBg && !caught && (
          <div
            ref={throwAreaRef}
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center"
            style={{ height: "38%", touchAction: "none" }}
            onPointerDown={handleTouchStart}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
          >
            {/* 비행 궤적 잔상 (모션 트레일) */}
            {(throwState === "flying" || throwState === "miss") && [0, 1].map(i => (
              <div key={i} className="absolute bottom-10 rounded-full pointer-events-none"
                style={{
                  width: 24, height: 24, marginBottom: 4,
                  background: "radial-gradient(circle, rgba(255,140,40,0.55) 0%, transparent 70%)",
                  filter: `blur(${2 + i * 1.5}px)`,
                  opacity: 0.5 - i * 0.18,
                  animation: `${throwState === "flying" ? "churu-fly-hit" : "churu-fly-miss"} 0.6s cubic-bezier(0.25,0.65,0.35,1) forwards`,
                  animationDelay: `${70 + i * 70}ms`,
                }} />
            ))}

            {/* 고양이 캔 */}
            <div className="absolute bottom-10 flex flex-col items-center gap-1 pointer-events-none"
              style={{
                transform: throwState === "pulling"
                  ? `translateY(${pullY * 0.55}px) translateX(${churuX}px) scaleY(${1 + pullY / 300}) scaleX(${1 - pullY / 900}) rotate(${-churuX * 0.15}deg)`
                  : "none",
                transition: throwState === "idle" ? "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                animation: throwState === "flying"
                  ? "churu-fly-hit 0.6s cubic-bezier(0.25,0.65,0.35,1) forwards"
                  : throwState === "miss"
                    ? "churu-fly-miss 0.6s cubic-bezier(0.25,0.65,0.35,1) forwards"
                    : throwState === "idle"
                      ? "pull-wiggle 2s ease-in-out infinite"
                      : "none",
              }}
            >
              {/* 충전 글로우 링 — 당긴 만큼 밝아지고 커짐 */}
              {throwState === "pulling" && pullY > 8 && (
                <div className="absolute rounded-full pointer-events-none" style={{
                  width: 60 + (pullY / MAX_PULL_Y) * 40,
                  height: 60 + (pullY / MAX_PULL_Y) * 40,
                  top: -8, left: "50%", transform: "translateX(-50%)",
                  background: `radial-gradient(circle, rgba(255,180,60,${0.15 + (pullY / MAX_PULL_Y) * 0.35}) 0%, transparent 70%)`,
                  animation: "charge-ring-pulse 0.5s ease-in-out infinite",
                }} />
              )}
              {/* 고양이 캔 (몬스터볼처럼 던지는 아이템) */}
              <div className="relative flex flex-col items-center"
                style={{ filter: `drop-shadow(0 3px ${6 + pullY / 15}px rgba(0,0,0,0.45))` }}>
                {/* 캔 뚜껑 */}
                <div style={{
                  width: 36, height: 13, borderRadius: "50%",
                  background: "radial-gradient(ellipse at 35% 30%, #FFFFFF 0%, #E4E4E4 35%, #A8A8A8 70%, #808080 100%)",
                  boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.3)",
                  position: "relative", zIndex: 2,
                }} />
                {/* 캔 몸통 */}
                <div style={{
                  width: 36, height: 32, marginTop: -5, borderRadius: 3,
                  background: "linear-gradient(180deg, #FF8A3D 0%, #FF6B1A 55%, #E8540A 100%)",
                  position: "relative", overflow: "hidden",
                  boxShadow: "inset -5px 0 7px rgba(0,0,0,0.28), inset 4px 0 6px rgba(255,255,255,0.18)",
                }}>
                  <div style={{ position: "absolute", left: 4, top: 0, bottom: 0, width: 5, background: "rgba(255,255,255,0.25)", borderRadius: 2 }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span style={{ fontSize: 8, fontWeight: 900, color: "white", letterSpacing: 0.5, textShadow: "0 1px 1px rgba(0,0,0,0.35)" }}>CAT</span>
                    <span style={{ fontSize: 8, fontWeight: 900, color: "white", letterSpacing: 0.5, textShadow: "0 1px 1px rgba(0,0,0,0.35)" }}>FOOD</span>
                  </div>
                </div>
                {/* 캔 바닥 그림자 */}
                <div style={{ width: 34, height: 4, marginTop: -2, borderRadius: "50%", background: "rgba(0,0,0,0.22)" }} />
              </div>
            </div>

            {/* 힌트 */}
            {throwState === "idle" && (
              <div className="absolute bottom-1 text-center pointer-events-none">
                <p className="text-[11px] font-bold text-white/60">고양이 캔을 잡고 당겼다가 놓아보세요</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
