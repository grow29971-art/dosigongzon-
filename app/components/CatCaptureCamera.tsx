"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
  onFallbackGallery?: () => void;
  onFallbackCapture?: () => void;
  previewFile?: File;
}

type CamState = "requesting" | "ready" | "denied" | "blocked" | "error" | "preview";
type ThrowState = "idle" | "pulling" | "flying" | "hit" | "miss";

// 조준 판정 튜닝값
const MIN_PULL_Y = 50;    // 이 이상 위로 당겨야 실제 투척으로 인정
const MAX_PULL_Y = 150;
const MAX_DRAG_X = 130;
const LANDING_MULT = 2.35; // 좌우로 당긴 거리 → 실제 도착 지점 오프셋 배율

export default function CatCaptureCamera({ onCapture, onClose, onFallbackGallery, onFallbackCapture, previewFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const throwAreaRef = useRef<HTMLDivElement>(null);

  const [camState, setCamState] = useState<CamState>(previewFile ? "preview" : "requesting");
  const [caught, setCaught] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  // 투척 상태
  const [throwState, setThrowState] = useState<ThrowState>("idle");
  const [pullY, setPullY] = useState(0);       // 당긴 거리 (px)
  const [churuX, setChuruX] = useState(0);     // 좌우 드래그 원본값 (츄르가 손가락을 따라감)
  const [aimOk, setAimOk] = useState(true);    // 지금 놓으면 명중권인지 실시간 판정
  const [landingDx, setLandingDx] = useState(0); // 실제 비행 애니메이션에 쓸 최종 도착 오프셋
  const touchStartRef = useRef({ x: 0, y: 0 });
  const missStreak = useRef(0); // 연속 실패 횟수 (너무 안 잡히면 판정 살짝 관대하게)

  const getTolerance = useCallback(() => {
    const base = (typeof window !== "undefined" ? window.innerWidth : 375) * 0.13;
    return missStreak.current >= 2 ? base * 1.7 : base;
  }, []);

  // 스캔 애니메이션 (idle 상태에서 고양이 좌우 흔들기)
  const [catWiggle, setCatWiggle] = useState(0);
  useEffect(() => {
    let t = 0;
    const loop = () => {
      t += 0.04;
      setCatWiggle(Math.sin(t * 1.5) * 4);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

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

  // 포획 완료 처리
  const finishCapture = useCallback(async () => {
    setCaught(true);
    setTimeout(async () => {
      if (previewFile) {
        onCapture(previewFile);
      } else {
        const file = await capturePhoto();
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (file) onCapture(file);
      }
    }, 900);
  }, [previewFile, onCapture, capturePhoto]);

  // 츄르 던지기 - 터치 이벤트 (드래그로 직접 조준 → 놓으면 투척)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (throwState !== "idle" || caught) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setPullY(0);
    setChuruX(0);
    setAimOk(true);
  }, [throwState, caught]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if ((throwState !== "idle" && throwState !== "pulling") || caught) return;
    e.preventDefault();
    const t = e.touches[0];
    const dy = touchStartRef.current.y - t.clientY; // 위로 당길수록 +
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, t.clientX - touchStartRef.current.x));
    if (dy > 5) {
      setThrowState("pulling");
      setPullY(Math.min(dy, MAX_PULL_Y));
      setChuruX(dx);
      const projected = dx * LANDING_MULT;
      setAimOk(Math.abs(projected) <= getTolerance());
    }
  }, [throwState, caught, getTolerance]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (caught) return;
    const t = e.changedTouches[0];
    const dy = touchStartRef.current.y - t.clientY;
    const dx = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, t.clientX - touchStartRef.current.x));

    if (dy > MIN_PULL_Y) {
      const landing = dx * LANDING_MULT;
      const isHit = Math.abs(landing) <= getTolerance();
      setLandingDx(landing);
      setThrowState("flying");

      setTimeout(() => {
        if (isHit) {
          missStreak.current = 0;
          setThrowState("hit");
          finishCapture();
        } else {
          missStreak.current += 1;
          setThrowState("miss");
          setTimeout(() => { setThrowState("idle"); setPullY(0); setChuruX(0); }, 850);
        }
      }, 620);
    } else {
      setThrowState("idle");
      setPullY(0);
      setChuruX(0);
    }
  }, [caught, finishCapture, getTolerance]);

  // 배경 (카메라 or 갤러리 사진)
  const showBg = camState === "ready" || camState === "preview";
  const isLive = camState === "ready";

  // 츄르 던지기 비행 궤적 계산
  const flyDx = throwState === "flying" || throwState === "hit" || throwState === "miss" ? landingDx : churuX * LANDING_MULT;
  const flyDy = -(typeof window !== "undefined" ? window.innerHeight * 0.55 : 400);
  const isMissThrow = throwState === "miss";
  // 빗나갔을 땐 조준한 방향으로 화면 밖까지 더 날아가도록
  const missFlyDx = flyDx + Math.sign(flyDx || 1) * 90;

  // 실시간 조준선 각도/길이 (당기는 중 손끝 → 예상 도착 방향)
  const aimAngle = Math.atan2(churuX, Math.max(pullY * 1.8, 1)) * (180 / Math.PI);
  const aimLen = Math.min(Math.sqrt(churuX ** 2 + (pullY * 1.8) ** 2), 210);

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
        @keyframes reticle-pulse {
          0%,100% { transform: scale(1); opacity:0.55; }
          50%     { transform: scale(1.12); opacity:0.85; }
        }
        @keyframes miss-text-pop {
          0%   { opacity:0; transform:translateY(6px) scale(0.85); }
          30%  { opacity:1; transform:translateY(0) scale(1.08); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden select-none">

        {/* 닫기 */}
        <button
          onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <X size={20} color="white" />
        </button>

        {/* 상단 안내 */}
        {showBg && !caught && (
          <div className="absolute top-5 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <div className="px-4 py-1.5 rounded-full text-[12px] font-extrabold text-white text-center"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              {throwState === "pulling"
                ? (aimOk ? "🎯 조준 완료! 손을 떼서 던지세요" : "⚠️ 가운데를 조준하세요!")
                : "츄르를 당겼다 놓아서 가운데로 던지세요!"}
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
                  style={{ opacity: caught ? 0.25 : 1, transition: "opacity 0.4s" }} />
              ) : (
                previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="포획 대상"
                    className="w-full h-full object-cover"
                    style={{ opacity: caught ? 0.25 : 1, transition: "opacity 0.4s" }} />
                )
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {/* 비네팅 */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)" }} />
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

        {/* 게임 UI */}
        {showBg && (
          <div className="absolute inset-0 flex flex-col items-center justify-between pb-14 pt-16 z-10 pointer-events-none">

            {/* 고양이 영역 (상단 60%) */}
            <div className="flex-1 flex items-center justify-center w-full relative">

              {/* 명중 조준 링 (항상 중앙 표시, 드래그 중엔 조준 상태로 색이 바뀜) */}
              {!caught && throwState !== "hit" && (
                <div className="absolute" style={{
                  width: 92, height: 92, borderRadius: "50%",
                  border: `3px solid ${throwState === "pulling" ? (aimOk ? "rgba(120,255,140,0.9)" : "rgba(255,90,90,0.9)") : "rgba(255,255,255,0.35)"}`,
                  animation: "reticle-pulse 1.6s ease-in-out infinite",
                  transition: "border-color 0.15s",
                }} />
              )}

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

              {/* 포획 완료 메시지 */}
              {caught && (
                <div className="text-center" style={{ animation: "caught-flash 0.5s ease-out" }}>
                  <p className="text-white text-[42px] font-black drop-shadow-lg leading-none">포획!</p>
                  <p className="text-yellow-300 text-[16px] font-bold mt-2">🐱 고양이 카드 생성 중...</p>
                </div>
              )}

              {/* 미스 */}
              {throwState === "miss" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center"
                  style={{ animation: "miss-text-pop 0.35s ease-out forwards" }}>
                  <p className="text-red-400 text-[28px] font-black">빗나갔다!</p>
                  <p className="text-white/70 text-[12px] font-bold mt-1">가운데 조준 링을 맞춰보세요</p>
                </div>
              )}
            </div>

            {/* 실패 스트릭 표시 */}
            {!caught && throwState === "idle" && missStreak.current > 0 && (
              <div className="flex gap-1 mb-2 items-center">
                <span className="text-[10px] text-white/50 font-bold mr-1">{missStreak.current}회 실패</span>
                {[0,1,2].map(i => (
                  <div key={i} className="w-6 h-1.5 rounded-full"
                    style={{ background: missStreak.current > i ? "#FF6B6B" : "rgba(255,255,255,0.2)" }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 츄르 투척 존 (하단) */}
        {showBg && !caught && (
          <div
            ref={throwAreaRef}
            className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center"
            style={{ height: "38%", touchAction: "none" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 실시간 조준선 (손끝 방향 → 예상 진로) */}
            {throwState === "pulling" && pullY > 8 && (
              <div className="absolute bottom-16 pointer-events-none" style={{ left: "50%" }}>
                <div style={{
                  position: "absolute", left: 0, bottom: 0,
                  width: 3, height: aimLen,
                  background: aimOk
                    ? "linear-gradient(to top, rgba(120,255,140,0.9), rgba(120,255,140,0.05))"
                    : "linear-gradient(to top, rgba(255,90,90,0.9), rgba(255,90,90,0.05))",
                  borderRadius: 3,
                  transformOrigin: "bottom center",
                  transform: `translateX(-1.5px) rotate(${aimAngle}deg)`,
                  boxShadow: aimOk ? "0 0 10px rgba(120,255,140,0.6)" : "0 0 10px rgba(255,90,90,0.6)",
                }} />
              </div>
            )}

            {/* 츄르 */}
            <div className="absolute bottom-10 flex flex-col items-center gap-1 pointer-events-none"
              style={{
                transform: throwState === "pulling"
                  ? `translateY(${pullY * 0.55}px) translateX(${churuX}px) scale(${1 + pullY / 400}) rotate(${-churuX * 0.15}deg)`
                  : "none",
                transition: throwState === "idle" ? "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                animation: throwState === "flying"
                  ? "churu-fly-hit 0.62s cubic-bezier(0.25,0.65,0.35,1) forwards"
                  : throwState === "miss"
                    ? "churu-fly-miss 0.62s cubic-bezier(0.25,0.65,0.35,1) forwards"
                    : throwState === "idle"
                      ? "pull-wiggle 2s ease-in-out infinite"
                      : "none",
              }}
            >
              {/* 츄르 튜브 */}
              <div className="relative flex flex-col items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[28px]"
                  style={{ filter: `drop-shadow(0 0 ${8 + pullY / 12}px rgba(255,200,50,0.85))` }}>
                  🐟
                </div>
                <div className="rounded-full px-3 py-1 text-[11px] font-black text-black mt-0.5"
                  style={{ background: "linear-gradient(135deg, #FFE066, #FF9900)", boxShadow: "0 2px 8px rgba(255,150,0,0.5)" }}>
                  츄~르
                </div>
              </div>
            </div>

            {/* 힌트 */}
            {throwState === "idle" && (
              <div className="absolute bottom-1 text-center pointer-events-none">
                <p className="text-[11px] font-bold text-white/60">츄르를 잡고 당겼다가 놓아보세요</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
