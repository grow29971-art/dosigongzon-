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
  const [pullY, setPullY] = useState(0); // 당긴 거리 (px)
  const [churuX, setChuruX] = useState(0); // 좌우 조준
  const touchStartRef = useRef({ x: 0, y: 0 });
  const throwCount = useRef(0); // 몇 번 던졌는지

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

  // 츄르 던지기 - 터치 이벤트
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (throwState !== "idle" || caught) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setPullY(0);
    setChuruX(0);
  }, [throwState, caught]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (throwState !== "idle" || caught) return;
    e.preventDefault();
    const t = e.touches[0];
    const dy = touchStartRef.current.y - t.clientY; // 위로 당길수록 +
    const dx = t.clientX - touchStartRef.current.x;
    if (dy > 5) {
      setThrowState("pulling");
      setPullY(Math.min(dy, 140));
      setChuruX(dx);
    }
  }, [throwState, caught]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (caught) return;
    const t = e.changedTouches[0];
    const dy = touchStartRef.current.y - t.clientY;
    const speed = dy;

    if (speed > 40) {
      throwCount.current += 1;
      setThrowState("flying");
      // 3번 이내엔 랜덤 성공, 실제론 항상 성공 (게임 재미)
      const willHit = true;

      setTimeout(() => {
        if (willHit) {
          setThrowState("hit");
          finishCapture();
        } else {
          setThrowState("miss");
          setTimeout(() => { setThrowState("idle"); setPullY(0); setChuruX(0); }, 800);
        }
      }, 700);
    } else {
      setThrowState("idle");
      setPullY(0);
      setChuruX(0);
    }
  }, [caught, finishCapture]);

  // 배경 (카메라 or 갤러리 사진)
  const showBg = camState === "ready" || camState === "preview";
  const isLive = camState === "ready";

  // 츄르 던지기 오프셋 계산
  const flyDx = churuX * 1.5;
  const flyDy = -(typeof window !== "undefined" ? window.innerHeight * 0.55 : 400);

  return (
    <>
      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes churu-fly {
          0%   { transform: translate(0,0) rotate(0deg) scale(1); opacity:1; }
          60%  { transform: translate(${flyDx * 0.6}px,${flyDy * 0.7}px) rotate(-540deg) scale(0.7); opacity:1; }
          85%  { transform: translate(${flyDx}px,${flyDy}px) rotate(-720deg) scale(0.5); opacity:1; }
          100% { transform: translate(${flyDx}px,${flyDy}px) rotate(-720deg) scale(0.2); opacity:0; }
        }
        @keyframes cat-hit {
          0%   { transform: translateX(0) scale(1); }
          20%  { transform: translateX(-12px) scale(1.15); }
          40%  { transform: translateX(12px) scale(0.9); }
          60%  { transform: translateX(-8px) scale(1.1); }
          80%  { transform: translateX(8px) scale(0.95); }
          100% { transform: translateX(0) scale(1); }
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
        @keyframes pull-wiggle {
          0%,100% { transform: rotate(-5deg); }
          50%     { transform: rotate(5deg); }
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
            <div className="px-4 py-1.5 rounded-full text-[12px] font-extrabold text-white"
              style={{ background: "rgba(0,0,0,0.55)" }}>
              츄르를 위로 던져서 포획하세요!
            </div>
          </div>
        )}

        {/* 배경 */}
        {showBg && (
          <div className="absolute inset-0">
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
            <div className="flex-1 flex items-center justify-center w-full">
              {/* 포획 성공 별 폭발 */}
              {throwState === "hit" && (
                <>
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <p className="text-red-400 text-[28px] font-black">빗나갔다!</p>
                </div>
              )}
            </div>

            {/* HP 바 스타일 던지기 횟수 */}
            {!caught && throwState === "idle" && (
              <div className="flex gap-1 mb-2">
                {[0,1,2].map(i => (
                  <div key={i} className="w-8 h-2 rounded-full"
                    style={{ background: throwCount.current > i ? "rgba(255,255,255,0.2)" : "#FFD700" }} />
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
            style={{ height: "35%", touchAction: "none" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 조준선 */}
            {throwState === "pulling" && pullY > 10 && (
              <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-20">
                <div style={{
                  width: 2,
                  height: Math.min(pullY * 1.8, 200),
                  background: "linear-gradient(to top, rgba(255,215,0,0.8), transparent)",
                  borderRadius: 2,
                  transform: `translateX(${churuX * 0.3}px)`,
                }} />
              </div>
            )}

            {/* 츄르 */}
            <div className="absolute bottom-10 flex flex-col items-center gap-1 pointer-events-none"
              style={{
                transform: throwState === "pulling"
                  ? `translateY(${pullY * 0.3}px) translateX(${churuX * 0.15}px)`
                  : "none",
                transition: throwState === "idle" ? "transform 0.2s" : "none",
                animation: throwState === "flying"
                  ? "churu-fly 0.7s cubic-bezier(0.2,0.8,0.4,1) forwards"
                  : throwState === "idle"
                    ? "pull-wiggle 2s ease-in-out infinite"
                    : "none",
              }}
            >
              {/* 츄르 튜브 */}
              <div className="relative flex flex-col items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[28px]"
                  style={{ filter: "drop-shadow(0 0 8px rgba(255,200,50,0.8))" }}>
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
                <p className="text-[11px] font-bold text-white/60">위로 스와이프해서 던지세요</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
