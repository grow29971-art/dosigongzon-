"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Zap } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
  onFallbackGallery?: () => void;
}

export default function CatCaptureCamera({ onCapture, onClose, onFallbackGallery }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [caught, setCaught] = useState(false);
  const [error, setError] = useState("");
  const [scanAngle, setScanAngle] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);

  // 카메라 시작
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.name : "";
          if (msg === "NotAllowedError") setError("카메라 권한이 거부됐어요. 설정 → 개인 정보 보호 → 카메라에서 도시공존을 허용해주세요.");
          else setError("카메라를 열 수 없어요. 갤러리에서 선택해주세요.");
        }
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // 스캔 애니메이션
  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.04;
      setScanAngle(t);
      setPulseScale(1 + Math.sin(t * 2) * 0.06);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !ready || capturing) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCapturing(false); return; }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) { setCapturing(false); return; }
      setCaught(true);
      setTimeout(() => {
        const file = new File([blob], `catchcat_${Date.now()}.jpg`, { type: "image/jpeg" });
        streamRef.current?.getTracks().forEach(t => t.stop());
        onCapture(file);
      }, 800);
    }, "image/jpeg", 0.92);
  }, [ready, capturing, onCapture]);

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* 닫기 */}
      <button
        onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
      >
        <X size={20} color="white" />
      </button>

      {/* 상단 라벨 */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
        <div className="px-4 py-1.5 rounded-full text-[12px] font-extrabold text-white tracking-widest"
          style={{ background: "rgba(0,0,0,0.5)", letterSpacing: "0.15em" }}>
          고양이를 화면 중앙에 맞춰주세요
        </div>
      </div>

      {/* 카메라 피드 */}
      {error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-[32px] mb-3">📷</p>
            <p className="text-white text-[15px] font-bold mb-2">{error}</p>
            <div className="flex flex-col gap-2 mt-4">
              {onFallbackGallery && (
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackGallery(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-[14px] text-black"
                  style={{ background: "#FFD700" }}
                >
                  갤러리에서 선택하기
                </button>
              )}
              <button
                onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
                className="px-6 py-3 rounded-2xl font-bold text-[14px]"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: caught ? 0.3 : 1, transition: "opacity 0.3s" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* 포획 성공 플래시 */}
          {caught && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center">
                <p className="text-white text-[36px] font-black drop-shadow-lg animate-bounce">포획!</p>
                <p className="text-yellow-300 text-[16px] font-bold mt-1">🐱 고양이 카드 생성 중...</p>
              </div>
            </div>
          )}

          {/* 스캔 오버레이 */}
          {!caught && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width={size} height={size} style={{ transform: `scale(${pulseScale})` }}>
                {/* 외곽 링 */}
                <circle cx={cx} cy={cy} r={r + 20} stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />

                {/* 코너 마커 */}
                {[0, 90, 180, 270].map(deg => {
                  const rad = (deg * Math.PI) / 180;
                  const mx = cx + Math.cos(rad) * r;
                  const my = cy + Math.sin(rad) * r;
                  return (
                    <g key={deg} transform={`translate(${mx},${my}) rotate(${deg + 45})`}>
                      <line x1="-10" y1="0" x2="10" y2="0" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
                      <line x1="0" y1="-10" x2="0" y2="10" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
                    </g>
                  );
                })}

                {/* 스캔 라인 */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(scanAngle) * r}
                  y2={cy + Math.sin(scanAngle) * r}
                  stroke="rgba(99,255,180,0.7)"
                  strokeWidth="2"
                />

                {/* 중심 발바닥 아이콘 */}
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.9)">🐾</text>

                {/* ready 상태 표시 */}
                {ready && (
                  <circle cx={cx} cy={cy - r - 10} r="5"
                    fill="#00FF88"
                    style={{ filter: "drop-shadow(0 0 4px #00FF88)" }}
                  />
                )}
              </svg>
            </div>
          )}

          {/* 좌우 어둡게 비네팅 */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)" }}
          />
        </div>
      )}

      {/* 하단 포획 버튼 */}
      <div className="pb-12 pt-6 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
        {!caught && (
          <button
            onClick={handleCapture}
            disabled={!ready || capturing}
            className="flex items-center gap-2 px-10 py-4 rounded-full font-extrabold text-[16px] active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: ready ? "linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)" : "#555",
              color: "#000",
              boxShadow: ready ? "0 0 24px rgba(255,215,0,0.6)" : "none",
              letterSpacing: "0.05em",
            }}
          >
            <Zap size={18} fill="currentColor" />
            {capturing ? "포획 중..." : "포획하기"}
          </button>
        )}
      </div>
    </div>
  );
}
