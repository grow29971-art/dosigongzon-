"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Zap } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
  onFallbackGallery?: () => void;
  /** 카메라 차단 시 네이티브 카메라(capture=environment)로 전환 */
  onFallbackCapture?: () => void;
  /** 갤러리에서 선택한 파일 — 제공 시 카메라 대신 이 사진으로 포획 화면 */
  previewFile?: File;
}

type CamState = "requesting" | "ready" | "denied" | "blocked" | "error" | "preview";

export default function CatCaptureCamera({ onCapture, onClose, onFallbackGallery, onFallbackCapture, previewFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const [camState, setCamState] = useState<CamState>(previewFile ? "preview" : "requesting");
  const [capturing, setCapturing] = useState(false);
  const [caught, setCaught] = useState(false);
  const [scanAngle, setScanAngle] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // 갤러리 파일 미리보기 URL 생성
  useEffect(() => {
    if (!previewFile) return;
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

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
        // Permissions API로 영구 차단 여부 확인
        try {
          const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
          setCamState(perm.state === "denied" ? "blocked" : "denied");
        } catch {
          setCamState("denied");
        }
      } else {
        setCamState("error");
      }
    }
  }, []);

  useEffect(() => {
    if (previewFile) return; // 갤러리 모드면 카메라 시작 안 함
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animRef.current);
    };
  }, [startCamera, previewFile]);

  // 스캔 애니메이션
  useEffect(() => {
    if (camState !== "ready" && camState !== "preview") return;
    let t = 0;
    const animate = () => {
      t += 0.04;
      setScanAngle(t);
      setPulseScale(1 + Math.sin(t * 2) * 0.06);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [camState]);

  const handleCapture = useCallback(() => {
    if (capturing) return;

    // 갤러리 미리보기 모드 — 파일 그대로 반환
    if (camState === "preview" && previewFile) {
      setCapturing(true);
      setCaught(true);
      setTimeout(() => { onCapture(previewFile); }, 800);
      return;
    }

    if (!videoRef.current || !canvasRef.current || camState !== "ready") return;
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
  }, [camState, capturing, previewFile, onCapture]);

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
      {camState === "ready" && !caught && (
        <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
          <div className="px-4 py-1.5 rounded-full text-[12px] font-extrabold text-white"
            style={{ background: "rgba(0,0,0,0.5)", letterSpacing: "0.1em" }}>
            고양이를 화면 중앙에 맞춰주세요
          </div>
        </div>
      )}

      {/* 권한 요청 중 */}
      {camState === "requesting" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-[48px] mb-4">📷</p>
            <p className="text-white text-[16px] font-bold">카메라 권한을 요청하는 중...</p>
            <p className="text-gray-400 text-[13px] mt-2">팝업이 뜨면 <span className="text-yellow-300 font-bold">허용</span>을 눌러주세요</p>
          </div>
        </div>
      )}

      {/* 권한 미결정 — 재시도하면 팝업 뜸 */}
      {camState === "denied" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-[48px] mb-4">🔒</p>
            <p className="text-white text-[16px] font-bold mb-1">카메라 권한이 필요해요</p>
            <p className="text-gray-400 text-[13px] mb-6">팝업에서 <span className="text-yellow-300 font-bold">허용</span>을 눌러주세요</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={startCamera}
                className="px-6 py-3 rounded-2xl font-bold text-[15px] text-black"
                style={{ background: "linear-gradient(135deg, #FFD700, #FF8C00)", boxShadow: "0 0 20px rgba(255,215,0,0.4)" }}
              >
                카메라 허용하기
              </button>
              {onFallbackGallery && (
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackGallery(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-[13px]"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  갤러리에서 선택하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 영구 차단 — 네이티브 카메라 앱으로 우회 */}
      {camState === "blocked" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-[48px] mb-4">📸</p>
            <p className="text-white text-[16px] font-bold mb-2">카메라를 열 수 없어요</p>
            <p className="text-gray-400 text-[13px] mb-6">기본 카메라 앱으로 사진을 찍어서 포획할 수 있어요</p>
            <div className="flex flex-col gap-2">
              {onFallbackCapture && (
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackCapture(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-[15px] text-black"
                  style={{ background: "linear-gradient(135deg, #FFD700, #FF8C00)", boxShadow: "0 0 20px rgba(255,215,0,0.4)" }}
                >
                  📷 카메라로 찍기
                </button>
              )}
              {onFallbackGallery && (
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackGallery(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-[13px]"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  갤러리에서 선택하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 기타 오류 */}
      {camState === "error" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <p className="text-[48px] mb-4">😿</p>
            <p className="text-white text-[15px] font-bold mb-5">카메라를 열 수 없어요</p>
            <div className="flex flex-col gap-2">
              <button onClick={startCamera} className="px-6 py-3 rounded-2xl font-bold text-[14px] text-black" style={{ background: "#FFD700" }}>
                다시 시도
              </button>
              {onFallbackGallery && (
                <button
                  onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onFallbackGallery(); }}
                  className="px-6 py-3 rounded-2xl font-bold text-[13px]"
                  style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  갤러리에서 선택하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 갤러리 미리보기 피드 */}
      {camState === "preview" && previewUrl && (
        <div className="flex-1 relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="선택한 사진"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: caught ? 0.3 : 1, transition: "opacity 0.3s" }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {caught && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center">
                <p className="text-white text-[36px] font-black drop-shadow-lg animate-bounce">포획!</p>
                <p className="text-yellow-300 text-[16px] font-bold mt-1">🐱 고양이 카드 생성 중...</p>
              </div>
            </div>
          )}
          {!caught && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width={size} height={size} style={{ transform: `scale(${pulseScale})` }}>
                <circle cx={cx} cy={cy} r={r + 20} stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
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
                <line x1={cx} y1={cy} x2={cx + Math.cos(scanAngle) * r} y2={cy + Math.sin(scanAngle) * r}
                  stroke="rgba(99,255,180,0.7)" strokeWidth="2" />
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.9)">🐾</text>
                <circle cx={cx} cy={cy - r - 10} r="5" fill="#00FF88" style={{ filter: "drop-shadow(0 0 4px #00FF88)" }} />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
        </div>
      )}

      {/* 카메라 피드 */}
      {(camState === "ready" || camState === "requesting") && (
        <div className={`flex-1 relative overflow-hidden ${camState === "requesting" ? "hidden" : ""}`}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: caught ? 0.3 : 1, transition: "opacity 0.3s" }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* 포획 성공 */}
          {caught && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center">
                <p className="text-white text-[36px] font-black drop-shadow-lg animate-bounce">포획!</p>
                <p className="text-yellow-300 text-[16px] font-bold mt-1">🐱 고양이 카드 생성 중...</p>
              </div>
            </div>
          )}

          {/* 스캔 오버레이 */}
          {!caught && camState === "ready" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg width={size} height={size} style={{ transform: `scale(${pulseScale})` }}>
                <circle cx={cx} cy={cy} r={r + 20} stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
                <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
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
                <line x1={cx} y1={cy} x2={cx + Math.cos(scanAngle) * r} y2={cy + Math.sin(scanAngle) * r}
                  stroke="rgba(99,255,180,0.7)" strokeWidth="2" />
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.9)">🐾</text>
                <circle cx={cx} cy={cy - r - 10} r="5" fill="#00FF88" style={{ filter: "drop-shadow(0 0 4px #00FF88)" }} />
              </svg>
            </div>
          )}

          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)" }} />
        </div>
      )}

      {/* 하단 포획 버튼 */}
      {(camState === "ready" || camState === "preview") && !caught && (
        <div className="pb-12 pt-6 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="flex items-center gap-2 px-10 py-4 rounded-full font-extrabold text-[16px] active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)",
              color: "#000",
              boxShadow: "0 0 24px rgba(255,215,0,0.6)",
              letterSpacing: "0.05em",
            }}
          >
            <Zap size={18} fill="currentColor" />
            {capturing ? "포획 중..." : "포획하기"}
          </button>
        </div>
      )}
    </div>
  );
}
