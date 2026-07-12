"use client";

import { GEOLOCATION_ENABLED } from "@/lib/geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Camera, MapPin, Loader2, Plus, Lock, ShieldAlert } from "lucide-react";
import { createCat, uploadCatPhoto, type Cat, type CatGender, type CatHealthStatus, type AdoptionStatus, type CatVisibility, GENDER_MAP, HEALTH_MAP, ADOPTION_MAP, VISIBILITY_MAP } from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";
import CatRegistrationCelebration from "@/app/components/CatRegistrationCelebration";
import type { CatCardData } from "@/app/components/CatCard";
import dynamic from "next/dynamic";
const CatCaptureCamera = dynamic(() => import("@/app/components/CatCaptureCamera"), { ssr: false });
import { findLocationViolations, formatViolationMessage } from "@/lib/location-patterns";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";

interface AddCatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (cat: Cat) => void;
  // 지도 클릭으로 전달된 좌표 (없으면 유저가 입력)
  initialLat?: number;
  initialLng?: number;
  // 등록 시작 전 시트에서 선택한 visibility (없으면 public)
  initialVisibility?: CatVisibility;
}

const TAG_PRESETS = [
  "TNR 완료",
  "TNR 필요",
  "이어팁",
  "사람 친화",
  "겁 많음",
  "성묘",
  "어린 고양이",
  "새끼 동반",
  "야행성",
  "온순",
  "예민",
  "식탐 많음",
];

// 이미지를 maxPx 폭으로 리사이즈 후 JPEG base64 반환 (요청 크기 제한 대응)
function resizeToBase64(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AddCatModal({
  open,
  onClose,
  onCreated,
  initialLat,
  initialLng,
  initialVisibility = "public",
}: AddCatModalProps) {
  const { user } = useAuth();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [detectedGu, setDetectedGu] = useState("");
  const [selectedDong, setSelectedDong] = useState("");
  const [editingDong, setEditingDong] = useState(false);
  const [description, setDescription] = useState("");
  // 한 줄 소개 실시간 검출 — 위치 특정 키워드 + 어뷰징(개인정보·욕설·위협).
  const descLocationViolations = useMemo(() => findLocationViolations(description), [description]);
  const descAbuseViolations = useMemo(() => findAbuseViolations(description), [description]);
  const [tags, setTags] = useState<string[]>([]);
  const [gender, setGender] = useState<CatGender>("unknown");
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<CatHealthStatus>("good");
  const [adoptionStatus, setAdoptionStatus] = useState<AdoptionStatus>(null);
  const [visibility, setVisibility] = useState<CatVisibility>(initialVisibility);
  // initialVisibility prop이 바뀌면 state 동기화 (모달 재오픈 시)
  useEffect(() => {
    if (open) setVisibility(initialVisibility);
  }, [open, initialVisibility]);
  // 최대 5장까지 다중 업로드
  const MAX_PHOTOS = 5;
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  // 추가 정보(선택) 펼침 — 기본은 이름·동네만 보여 마찰 최소화
  const [showMore, setShowMore] = useState(false);
  // 포획 게임에서 "완벽 포획"으로 잡았는지 — 카드 생성 시 높은 등급 확률 보너스에 사용
  const [perfectCatch, setPerfectCatch] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState<File[]>([]);
  // 등록 직후 축하 모달
  const [celebration, setCelebration] = useState<{
    open: boolean;
    catName: string;
    isFirstEver: boolean;
    registrationCount: number;
    cat: Cat | null;
    card: CatCardData | null;
  }>({ open: false, catName: "", isFirstEver: false, registrationCount: 0, cat: null, card: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  // portal root
  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // 모달 열릴 때 역지오코딩으로 동 자동 감지 + body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";

      const resolveRegion = (lat: number, lng: number) => {
        if (!window.kakao?.maps?.services) return;
        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.coord2RegionCode(lng, lat, (result, status) => {
          if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(result)) return;
          // 행정동(H) 우선 — 사용자는 행정동 이름으로 동네 인식
          const admin = result.find((r) => r?.region_type === "H");
          const target = admin ?? result[0];
          if (!target) return;
          const gu = target.region_2depth_name || "";
          const dong = target.region_3depth_name || "";
          setDetectedGu(gu);
          if (dong) setSelectedDong(dong);
        });
      };

      if (initialLat !== undefined && initialLng !== undefined) {
        // 지도 클릭 좌표가 있으면 그걸로
        resolveRegion(initialLat, initialLng);
      } else if (GEOLOCATION_ENABLED && navigator.geolocation) {
        // 없으면 GPS 현재 위치로 자동 감지 (maximumAge 5분 — 모달 재오픈 시 권한 재확인 방지)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolveRegion(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { timeout: 5000, maximumAge: 5 * 60 * 1000 },
        );
      }
    } else {
      document.body.style.overflow = "";
      setName("");
      setDetectedGu("");
      setSelectedDong("");
      setEditingDong(false);
      setDescription("");
      setTags([]);
      setGender("unknown");
      setNeutered(null);
      setHealthStatus("good");
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setError("");
      setSubmitting(false);
      setShowMore(false);
      setPerfectCatch(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialLat, initialLng]);

  const handleCameraCapture = (file: File, isPerfectCatch: boolean) => {
    setShowCamera(false);
    setPerfectCatch(isPerfectCatch);
    // 갤러리 모드면 pendingGalleryFiles 전체 추가, 카메라 모드면 file만 추가
    const filesToAdd = pendingGalleryFiles.length > 0 ? pendingGalleryFiles : [file];
    setPendingGalleryFiles([]);
    const available = MAX_PHOTOS - photoFiles.length;
    const toAdd = filesToAdd.slice(0, available);
    if (toAdd.length === 0) return;
    const newPreviews: string[] = [];
    let loaded = 0;
    toAdd.forEach((f, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newPreviews[idx] = ev.target?.result as string;
        loaded++;
        if (loaded === toAdd.length) {
          setPhotoFiles(prev => [...prev, ...toAdd]);
          setPhotoPreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(f);
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const available = MAX_PHOTOS - photoFiles.length;
    if (available <= 0) {
      setError(`최대 ${MAX_PHOTOS}장까지만 올릴 수 있어요.`);
      return;
    }
    const toAdd = selected.slice(0, available);

    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) {
        setError("이미지 파일만 업로드 가능해요.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError("사진은 각 20MB 이하만 가능해요.");
        return;
      }
    }

    setError("");
    // 첫 번째 사진은 포획 화면으로 — 나머지는 포획 완료 후 한꺼번에 추가
    setPendingGalleryFiles(toAdd);
    setShowCamera(true);

    // 같은 파일 다시 선택 가능하게 리셋
    if (e.target) e.target.value = "";
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = async () => {
    setError("");

    if (!name.trim()) return setError("이름을 입력해주세요.");
    if (!selectedDong.trim()) return setError("동네를 입력해주세요.");
    if (initialLat === undefined || initialLng === undefined) return setError("위치 정보가 없어요. 다시 시도해주세요.");

    // 한 줄 소개 — 위치 + 어뷰징 검증
    const descViolations = findLocationViolations(description);
    if (descViolations.length > 0) {
      return setError(formatViolationMessage(descViolations));
    }
    const abuseVio = findAbuseViolations(description);
    if (abuseVio.length > 0) {
      return setError(formatAbuseMessage(abuseVio));
    }
    // 이름 어뷰징 검증
    const nameAbuse = findAbuseViolations(name);
    if (nameAbuse.length > 0) {
      return setError(formatAbuseMessage(nameAbuse));
    }

    setSubmitting(true);
    try {
      // 여러 장 동시 업로드 (순서 유지)
      const uploaded: string[] = [];
      for (const file of photoFiles) {
        const url = await uploadCatPhoto(file);
        uploaded.push(url);
      }
      const photoUrl = uploaded[0]; // 대표 사진 = 첫 번째
      const photoUrls = uploaded; // 전체 배열

      // 좌표 보호: ±444m 랜덤 오프셋 (실제 위치 추적 차단 + 마커 겹침 방지).
      // 0.008deg 위도 ≈ ±444m. 서울 위도(37.5)에서 경도는 cos 보정해 ±350m 정도.
      const offsetLat = initialLat + (Math.random() - 0.5) * 0.008;
      const offsetLng = initialLng + (Math.random() - 0.5) * 0.008;

      const newCat = await createCat({
        name: name.trim(),
        description: description.trim() || undefined,
        photo_url: photoUrl,
        photo_urls: photoUrls,
        lat: offsetLat,
        lng: offsetLng,
        region: selectedDong.trim(),
        tags,
        gender,
        neutered,
        health_status: healthStatus,
        adoption_status: adoptionStatus,
        visibility,
      });

      // 첫 등록 감지 + 등록 횟수 카운터 — localStorage 기반 (유저별)
      const firstKey = user ? `first-cat-registered:${user.id}` : "first-cat-registered";
      const countKey = user ? `cat-register-count:${user.id}` : "cat-register-count";
      let isFirstEver = false;
      let registrationCount = 1;
      try {
        isFirstEver = !localStorage.getItem(firstKey);
        if (isFirstEver) localStorage.setItem(firstKey, "1");
        const prev = Number(localStorage.getItem(countKey) ?? "0");
        registrationCount = (Number.isFinite(prev) ? prev : 0) + 1;
        localStorage.setItem(countKey, String(registrationCount));
      } catch {}

      // CatchCat 카드 생성 — 사진 있으면 base64, 없으면 API가 랜덤 생성
      let generatedCard: CatCardData | null = null;
      if (newCat.id) {
        try {
          let body: Record<string, string | boolean> = { cat_id: newCat.id, perfect_catch: perfectCatch };
          if (photoFiles[0]) {
            const b64 = await resizeToBase64(photoFiles[0], 800);
            body = { ...body, image_base64: b64, mime_type: "image/jpeg" };
          }
          const cardRes = await fetch("/api/cats/generate-card", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const cardJson = await cardRes.json();
          if (cardRes.ok && cardJson.card) {
            generatedCard = cardJson.card;
            if (["rare", "legendary"].includes(generatedCard?.card_rarity ?? "")) {
              fetch("/api/cats/rare-alert", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ cat_id: newCat.id }),
              }).catch(() => {});
            }
          } else {
            console.warn("[CatchCat] 카드 생성 실패:", cardJson);
          }
        } catch (err) {
          console.error("[CatchCat] 카드 생성 예외:", err);
        }
      }

      setCelebration({
        open: true,
        catName: newCat.name,
        isFirstEver,
        registrationCount,
        cat: newCat,
        card: generatedCard,
      });
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했어요.");
      setSubmitting(false);
    }
  };

  if (!open || !portalRoot) return null;

  // ── 비로그인 시 로그인 유도 ──
  if (!user) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
          >
            <X size={18} className="text-text-sub" />
          </button>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock size={24} className="text-primary" />
          </div>
          <h2 className="text-[18px] font-extrabold text-text-main mb-2">
            로그인이 필요해요
          </h2>
          <p className="text-[13px] text-text-sub leading-relaxed mb-5">
            우리 동네 고양이를 등록하려면 먼저 로그인해주세요. 누가 어떤 아이를 돌보는지 기록해야
            오래 이어갈 수 있어요.
          </p>
          <Link
            href="/login?next=%2Fmap"
            onClick={onClose}
            className="block w-full py-3.5 rounded-2xl bg-primary text-white text-[14px] font-bold text-center active:scale-[0.97] transition-transform"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>,
      portalRoot,
    );
  }

  // ── 등록 폼 ──
  const portal = createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-cat-modal-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      <style>{`
        @keyframes addcat-holo-sweep {
          0%   { background-position: -220% center; }
          100% { background-position: 220% center; }
        }
      `}</style>

      <div
        className="relative mt-auto w-full rounded-t-[32px] flex flex-col overflow-hidden"
        style={{
          maxHeight: "92dvh",
          background: "linear-gradient(165deg, #241748 0%, #1A1030 45%, #12081F 100%)",
          border: "1px solid rgba(99,102,241,0.35)",
          borderBottom: "none",
          boxShadow: "0 -10px 40px rgba(99,102,241,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* 카드 홀로그램 스윕 */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 48%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 52%, transparent 70%)",
          backgroundSize: "260% 100%",
          animation: "addcat-holo-sweep 3.2s ease-in-out infinite",
        }} />

        {/* 핸들 바 */}
        <div className="relative flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* 헤더 */}
        <div className="relative flex items-center justify-between px-5 py-3 border-b border-white/12">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[16px] shrink-0"
              style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", boxShadow: "0 2px 10px rgba(99,102,241,0.5)" }}>
              🃏
            </span>
            <div>
              <h2
                id="add-cat-modal-title"
                className="text-[17px] font-extrabold text-white"
              >
                우리 동네 아이 등록
              </h2>
              <p className="text-[11px] text-white/60 mt-0.5">
                이름과 동네만 있으면 바로 등록돼요 · 사진·소개는 선택
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="등록 창 닫기"
            className="w-9 h-9 rounded-full bg-white/[0.07] flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50 shrink-0"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* 사진 업로드 — 최대 5장 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-bold text-white">
                사진 <span className="text-white/45 font-normal">(선택) · 첫 장이 대표</span>
              </label>
              <span className="text-[10.5px] text-white/45">
                {photoFiles.length}/{MAX_PHOTOS}
              </span>
            </div>
            {photoPreviews.length === 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => captureInputRef.current?.click()}
                  className="relative w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition-transform overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 100%)", borderColor: "#6366F1" }}
                >
                  <span className="text-[36px]">🐾</span>
                  <p className="text-[14px] font-extrabold text-white">고양이 포획하기</p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>카메라로 직접 찍어서 카드 발급</p>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: "#6366F1" }}>CatchCat</div>
                </button>
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (e.target) e.target.value = "";
                    setPendingGalleryFiles([file]);
                    setShowCamera(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-2 active:scale-[0.99]"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Camera size={15} className="text-white/45" strokeWidth={1.5} />
                  <p className="text-[12px] text-white/60">갤러리에서 선택</p>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden"
                    style={{ border: idx === 0 ? "2px solid #6366F1" : "1px solid rgba(255,255,255,0.16)" }}
                  >
                    <img src={src} alt={`미리보기 ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    {idx === 0 && (
                      <span
                        className="absolute top-1 left-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md text-white"
                        style={{ background: "#6366F1" }}
                      >
                        대표
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                      aria-label="삭제"
                    >
                      <X size={11} color="#fff" strokeWidth={2.8} />
                    </button>
                  </div>
                ))}
                {photoFiles.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl bg-white/[0.07] border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 active:scale-[0.97]"
                  >
                    <Camera size={20} className="text-white/45" strokeWidth={1.5} />
                    <p className="text-[10px] text-white/60 font-medium">추가</p>
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* 이름 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">
              이름 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 까망이, 치즈, 삼색이"
              maxLength={20}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.07] text-[14px] text-white outline-none focus:bg-white/10 focus:ring-2 focus:ring-[#6366F1]/20 transition-all placeholder:text-white/30"
            />
          </div>

          {/* 동네 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">
              동네 <span className="text-error">*</span>
              {detectedGu && (
                <span className="text-[10px] font-normal text-white/45 ml-2">
                  📍 {detectedGu}
                </span>
              )}
            </label>
            {selectedDong && !editingDong ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/20">
                  <MapPin size={14} className="text-[#818CF8] shrink-0" />
                  <span className="text-[14px] font-bold text-white">{selectedDong}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDong(true)}
                  className="text-[12px] text-white/60 underline shrink-0 px-2"
                >
                  변경
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                onBlur={() => { if (selectedDong.trim()) setEditingDong(false); }}
                autoFocus={editingDong}
                placeholder="예: 구월동, 역삼동, 해운대동"
                maxLength={20}
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.07] text-[14px] text-white outline-none focus:bg-white/10 focus:ring-2 focus:ring-[#6366F1]/20 transition-all placeholder:text-white/30"
              />
            )}
          </div>

          {/* 추가 정보 토글 — 기본은 이름·동네만, 나머지는 접어서 마찰 최소화 */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full flex items-center justify-center gap-1 py-2.5 rounded-2xl text-[12.5px] font-bold transition-all active:scale-[0.99]"
            style={{ background: "rgba(99,102,241,0.10)", color: "#B4B8FF", border: "1px dashed rgba(129,140,248,0.4)" }}
          >
            {showMore ? "추가 정보 접기 ▴" : "한 줄 소개·성별·건강 등 추가 (선택) ▾"}
          </button>

          {showMore && (
          <>
          {/* 한 줄 소개 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">한 줄 소개</label>

            {/* 안내 — 위치 특정 금지 */}
            <div
              className="mb-2 rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(120,200,140,0.10)", border: "1px solid rgba(120,200,140,0.28)" }}
            >
              <ShieldAlert size={14} className="shrink-0 mt-0.5" style={{ color: "#8FE0A8" }} />
              <p className="text-[11.5px] leading-relaxed" style={{ color: "#B8EFC8" }}>
                <b>길고양이 안전을 위해</b> 정확한 위치를 알 수 있는 표현은 적지 마세요.
                <br />
                <span style={{ color: "rgba(184,239,200,0.75)" }}>
                  예: 역 이름·출구 번호·시장·공원·아파트·도로 주소·학교
                </span>
              </p>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 우리 동네 터줏대감. 사람을 봐도 도망가지 않아요."
              maxLength={120}
              rows={3}
              className={`w-full px-4 py-3 rounded-2xl text-[14px] text-white outline-none transition-all placeholder:text-white/30 resize-none ${
                descLocationViolations.length > 0 || descAbuseViolations.length > 0
                  ? "bg-red-500/10 ring-2 ring-red-400/40 focus:ring-red-400/60"
                  : "bg-white/[0.07] focus:bg-white/10 focus:ring-2 focus:ring-[#6366F1]/20"
              }`}
            />
            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0 space-y-0.5">
                {descLocationViolations.length > 0 && (
                  <p className="text-[10.5px] leading-relaxed" style={{ color: "#B84545" }}>
                    ⚠ {descLocationViolations.map((v) => `${v.label}(${v.match})`).join(", ")} —
                    일반 표현(우리 동네·골목·근처)으로 바꿔주세요.
                  </p>
                )}
                {descAbuseViolations.length > 0 && (
                  <p className="text-[10.5px] leading-relaxed" style={{ color: "#B84545" }}>
                    🚫 {formatAbuseMessage(descAbuseViolations)}
                  </p>
                )}
              </div>
              <p className="text-[10px] text-white/45 shrink-0">{description.length}/120</p>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">상태 태그</label>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESETS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95 ${
                      active
                        ? "bg-[#6366F1] text-white"
                        : "bg-white/[0.07] text-white/60 border border-white/15"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 성별 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">성별</label>
            <div className="flex gap-2">
              {(Object.entries(GENDER_MAP) as [CatGender, { label: string; emoji: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGender(key)}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${
                    gender === key ? "bg-[#6366F1] text-white" : "bg-white/[0.07] text-white/60 border border-white/15"
                  }`}
                >
                  {info.emoji} {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* 중성화 여부 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">중성화 여부</label>
            <div className="flex gap-2">
              {([
                { value: true, label: "✂️ 완료" },
                { value: false, label: "❌ 미완료" },
                { value: null, label: "❓ 모름" },
              ] as const).map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setNeutered(opt.value)}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${
                    neutered === opt.value ? "bg-[#6366F1] text-white" : "bg-white/[0.07] text-white/60 border border-white/15"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 건강 상태 */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">건강 상태</label>
            <div className="flex gap-2">
              {(Object.entries(HEALTH_MAP) as [CatHealthStatus, { label: string; emoji: string; color: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setHealthStatus(key)}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95`}
                  style={{
                    backgroundColor: healthStatus === key ? info.color : undefined,
                    color: healthStatus === key ? "#fff" : info.color,
                    border: healthStatus === key ? "none" : `1.5px solid ${info.color}40`,
                  }}
                >
                  {info.emoji} {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* 입양·임시보호 매칭 (선택) */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">
              입양·임시보호 <span className="text-white/45 font-normal">(선택)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdoptionStatus(null)}
                className="py-2.5 rounded-2xl text-[12.5px] font-bold transition-all active:scale-95 col-span-2"
                style={{
                  backgroundColor: adoptionStatus === null ? "rgba(99,102,241,0.14)" : undefined,
                  color: adoptionStatus === null ? "#C7CAFF" : "rgba(255,255,255,0.5)",
                  border: adoptionStatus === null ? "1.5px solid #6366F1" : "1.5px solid rgba(255,255,255,0.16)",
                }}
              >
                해당 없음
              </button>
              {(Object.entries(ADOPTION_MAP) as [Exclude<AdoptionStatus, null>, typeof ADOPTION_MAP["seeking_home"]][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAdoptionStatus(key)}
                  className="py-2.5 rounded-2xl text-[12px] font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: adoptionStatus === key ? info.color : undefined,
                    color: adoptionStatus === key ? "#fff" : info.color,
                    border: adoptionStatus === key ? "none" : `1.5px solid ${info.color}40`,
                  }}
                >
                  {info.emoji} {info.short}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-white/45 mt-1.5 leading-relaxed px-1">
              설정하면 고양이 상세 페이지에 배지와 문의 버튼이 생겨 다른 사용자가 쪽지로 연락할 수 있어요.
            </p>
          </div>
          </>
          )}

          {/* 공개 범위 — Private Circle */}
          <div>
            <label className="text-[12px] font-bold text-white mb-2 block">
              공개 범위 <span className="text-white/45 font-normal">(보안)</span>
            </label>
            <div className="space-y-1.5">
              {(Object.entries(VISIBILITY_MAP) as [CatVisibility, typeof VISIBILITY_MAP["public"]][]).map(([key, info]) => {
                const active = visibility === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVisibility(key)}
                    className="w-full p-3 rounded-2xl text-left flex items-start gap-2.5 transition-all active:scale-[0.99]"
                    style={{
                      backgroundColor: active ? `${info.color}22` : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${active ? info.color : "rgba(255,255,255,0.16)"}`,
                    }}
                  >
                    <span className="text-[18px] leading-none mt-0.5">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold" style={{ color: active ? info.color : "rgba(255,255,255,0.85)" }}>
                        {info.label}
                      </p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: active ? info.color : "rgba(255,255,255,0.5)", opacity: active ? 0.85 : 1 }}>
                        {info.description}
                      </p>
                    </div>
                    {active && <span className="text-[14px] shrink-0" style={{ color: info.color }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-white/45 mt-1.5 leading-relaxed px-1">
              학대 우려가 큰 아이는 <b>내 서클</b>이나 <b>나만 보기</b>로 설정하세요.{" "}
              <Link href="/mypage/circle" className="underline" style={{ color: "#6B8E6F" }}>
                서클 멤버 관리
              </Link>
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(220,80,80,0.14)", border: "1px solid rgba(220,80,80,0.3)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "#FF8A8A" }}>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div
          className="relative px-5 py-3 border-t border-white/12"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #6366F1, #818CF8)",
              boxShadow: "0 6px 24px rgba(99,102,241,0.45), 0 0 0 1px rgba(255,255,255,0.15) inset",
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <Plus size={18} />
                이 동네 아이로 등록하기
              </>
            )}
          </button>
        </div>
      </div>

      {/* 등록 직후 축하 peak-end */}
      <CatRegistrationCelebration
        open={celebration.open}
        catName={celebration.catName}
        isFirstEver={celebration.isFirstEver}
        registrationCount={celebration.registrationCount}
        cat={celebration.cat}
        card={celebration.card}
        onClose={() => {
          setCelebration((prev) => ({ ...prev, open: false }));
          if (celebration.cat) onCreated(celebration.cat);
          onClose();
        }}
      />

    </div>,
    portalRoot,
  );

  // CatCaptureCamera는 modal stacking context 밖, body에 직접 마운트
  return (
    <>
      {portal}
      {showCamera && portalRoot && createPortal(
        <CatCaptureCamera
          onCapture={handleCameraCapture}
          onClose={() => { setShowCamera(false); setPendingGalleryFiles([]); }}
          onFallbackGallery={() => { setShowCamera(false); setPendingGalleryFiles([]); fileInputRef.current?.click(); }}
          onFallbackCapture={() => { setShowCamera(false); setPendingGalleryFiles([]); captureInputRef.current?.click(); }}
          previewFile={pendingGalleryFiles[0]}
        />,
        document.body,
      )}
    </>
  );
}
