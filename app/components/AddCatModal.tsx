"use client";

import { CAT_TAG_PRESETS, toggleCatTag } from "@/lib/cat-tags";
import { GEOLOCATION_ENABLED } from "@/lib/geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Camera, MapPin, Loader2, Plus, Lock, ShieldAlert, ChevronDown, Check } from "lucide-react";
import { createCat, uploadCatPhoto, type Cat, type CatGender, type CatHealthStatus, type AdoptionStatus, type CatVisibility, GENDER_MAP, HEALTH_MAP, ADOPTION_MAP, VISIBILITY_MAP } from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";
import CatRegistrationCelebration from "@/app/components/CatRegistrationCelebration";
import UIButton from "@/app/components/ui/Button";
import UIChip from "@/app/components/ui/Chip";
import { findLocationViolations, formatViolationMessage } from "@/lib/location-patterns";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";
import {
  DISCOVERY_RECORD_STEPS,
  findNearbyDiscoveryCandidates,
  getAdjacentDiscoveryRecordStep,
  type DiscoveryRecordStep,
} from "@/lib/discovery-record-flow";

interface AddCatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (cat: Cat) => void;
  // 지도 클릭으로 전달된 좌표 (없으면 유저가 입력)
  initialLat?: number;
  initialLng?: number;
  // 등록 시작 전 시트에서 선택한 visibility (없으면 public)
  initialVisibility?: CatVisibility;
  showDiscoverySteps?: boolean;
  duplicateCandidates?: readonly Cat[];
}

const TAG_PRESETS = CAT_TAG_PRESETS;

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
  showDiscoverySteps = false,
  duplicateCandidates = [],
}: AddCatModalProps) {
  const { user } = useAuth();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [discoveryStep, setDiscoveryStep] = useState<DiscoveryRecordStep>("location");
  const nearbyCandidates = useMemo(
    () =>
      initialLat === undefined || initialLng === undefined
        ? []
        : findNearbyDiscoveryCandidates(
            { lat: initialLat, lng: initialLng },
            duplicateCandidates,
          ),
    [duplicateCandidates, initialLat, initialLng],
  );

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 등록 직후 축하 모달 (카드 생성은 2026-08-27 카드 시스템 폐지로 제거)
  const [celebration, setCelebration] = useState<{
    open: boolean;
    catName: string;
    isFirstEver: boolean;
    registrationCount: number;
    cat: Cat | null;
  }>({ open: false, catName: "", isFirstEver: false, registrationCount: 0, cat: null });
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
      setDiscoveryStep("location");
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialLat, initialLng]);

  // 카메라 촬영·갤러리 선택 공통 — 검증 후 미리보기와 함께 바로 추가.
  const addFiles = (selected: File[]) => {
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
    const newPreviews: string[] = [];
    let loaded = 0;
    toAdd.forEach((f, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newPreviews[idx] = ev.target?.result as string;
        loaded++;
        if (loaded === toAdd.length) {
          setPhotoFiles((prev) => [...prev, ...toAdd]);
          setPhotoPreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(f);
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    // 같은 파일 다시 선택 가능하게 리셋
    if (e.target) e.target.value = "";
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => toggleCatTag(prev, tag));
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

      // 좌표 보호(±444m 오프셋)는 서버(createCat)에서 단일 적용 — 등록·수정 경로 일관.
      // 클라이언트는 원본 좌표만 전달한다(여기서 오프셋하면 서버와 이중 적용됨).
      const newCat = await createCat({
        name: name.trim(),
        description: description.trim() || undefined,
        photo_url: photoUrl,
        photo_urls: photoUrls,
        lat: initialLat,
        lng: initialLng,
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

      setCelebration({
        open: true,
        catName: newCat.name,
        isFirstEver,
        registrationCount,
        cat: newCat,
      });
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했어요.");
      setSubmitting(false);
    }
  };

  if (!open || !portalRoot) return null;

  const fieldStyle: React.CSSProperties = {
    borderRadius: "var(--radius-input)",
    background: "var(--color-surface-alt)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-main)",
  };

  // ── 비로그인 시 로그인 유도 ──
  if (!user) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div
          className="relative w-full max-w-sm p-6"
          style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center press-strong"
            style={{ background: "var(--color-gray-100)" }}
            aria-label="닫기"
          >
            <X size={18} className="text-text-sub" />
          </button>
          <div className="mb-3 text-text-sub">
            <Lock size={22} />
          </div>
          <h2 className="text-[20px] font-bold text-text-main mb-2">
            로그인이 필요해요
          </h2>
          <p className="text-[13px] text-text-sub leading-relaxed mb-5">
            우리 동네 고양이를 등록하려면 먼저 로그인해주세요.
          </p>
          <Link
            href="/login?next=%2Fmap"
            onClick={onClose}
            className="flex items-center justify-center w-full h-12 text-white text-[15px] font-semibold press-strong"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
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

      <div
        className="relative mt-auto w-full flex flex-col overflow-hidden animate-slide-up"
        style={{
          maxHeight: "92dvh",
          background: "var(--color-surface)",
          borderTopLeftRadius: "var(--radius-sheet)",
          borderTopRightRadius: "var(--radius-sheet)",
          boxShadow: "var(--shadow-sheet)",
        }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--color-gray-300)" }} />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="min-w-0">
            <h2 id="add-cat-modal-title" className="text-[17px] font-bold text-text-main">
              우리 동네 아이 등록
            </h2>
            <p className="text-[13px] text-text-sub mt-0.5">
              이름과 동네만 있으면 바로 등록돼요
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="등록 창 닫기"
            className="w-9 h-9 rounded-full flex items-center justify-center press-strong disabled:opacity-50 shrink-0"
            style={{ background: "var(--color-gray-100)" }}
          >
            <X size={18} className="text-text-sub" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {showDiscoverySteps && (
            <div>
            <ol className="grid grid-cols-3 gap-2" aria-label="발견 기록 3단계">
              {DISCOVERY_RECORD_STEPS.map((step, index) => {
                const active = discoveryStep === step.id;
                return (
                  <li
                    key={step.id}
                    className="text-center"
                    style={{
                      borderRadius: "var(--radius-card-sm)",
                      border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                      background: active ? "var(--color-primary-soft)" : "var(--color-surface)",
                    }}
                  >
                    <button
                      type="button"
                      className="w-full px-2 py-2"
                      aria-current={active ? "step" : undefined}
                      onClick={() => setDiscoveryStep(step.id)}
                    >
                      <span className="block text-[11px] font-semibold" style={{ color: active ? "var(--color-primary)" : "var(--color-text-light)" }}>
                        {index + 1}단계
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-text-main">
                        {step.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex items-center justify-between">
              <UIButton
                variant="text"
                size="sm"
                disabled={discoveryStep === "location"}
                onClick={() => setDiscoveryStep((step) => getAdjacentDiscoveryRecordStep(step, "previous"))}
              >
                이전
              </UIButton>
              <UIButton
                variant="secondary"
                size="sm"
                disabled={discoveryStep === "visibility"}
                onClick={() => setDiscoveryStep((step) => getAdjacentDiscoveryRecordStep(step, "next"))}
              >
                다음
              </UIButton>
            </div>
            </div>
          )}
          {showDiscoverySteps &&
            discoveryStep === "location" &&
            nearbyCandidates.length > 0 && (
              <div className="p-3" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
                <p className="text-[15px] font-semibold text-text-main">
                  잠깐, 주변에 이미 등록된 아이가 있어요
                </p>
                <p className="mt-1 text-[13px] text-text-sub">
                  같은 아이라면 새로 등록하지 말고 기존 기록을 이어주세요.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nearbyCandidates.map((candidate) => (
                    <Link
                      key={candidate.id}
                      href={`/cats/${candidate.id}`}
                      className="h-8 px-3 inline-flex items-center text-[13px] font-semibold text-text-main"
                      style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
                    >
                      {candidate.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          {(!showDiscoverySteps || discoveryStep === "identity") && (
          <>
          {/* 사진 업로드 — 최대 5장 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-semibold text-text-main">
                사진 <span className="text-text-light font-normal">(선택) · 첫 장이 대표</span>
              </label>
              <span className="text-[11px] text-text-light">
                {photoFiles.length}/{MAX_PHOTOS}
              </span>
            </div>
            {photoPreviews.length === 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => captureInputRef.current?.click()}
                  className="relative w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 press overflow-hidden"
                  style={{ borderRadius: "var(--radius-card)", background: "var(--color-surface-alt)", border: "1px dashed var(--color-gray-300)" }}
                >
                  <Camera size={30} className="text-text-sub" strokeWidth={1.5} />
                  <p className="text-[15px] font-semibold text-text-main">사진 찍기</p>
                  <p className="text-[13px] text-text-sub">카메라로 우리 동네 아이를 담아요</p>
                </button>
                <input
                  ref={captureInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) addFiles([file]);
                    if (e.target) e.target.value = "";
                  }}
                />
                <UIButton variant="secondary" size="md" full onClick={() => fileInputRef.current?.click()}>
                  <Camera size={15} strokeWidth={1.5} />
                  갤러리에서 선택
                </UIButton>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square overflow-hidden"
                    style={{
                      borderRadius: "var(--radius-card-sm)",
                      border: idx === 0 ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    }}
                  >
                    <img src={src} alt={`미리보기 ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    {idx === 0 && (
                      <span
                        className="absolute top-1 left-1 text-[11px] font-semibold px-1.5 py-0.5 text-white"
                        style={{ background: "var(--color-primary)", borderRadius: "var(--radius-square)" }}
                      >
                        대표
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center press-strong"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                      aria-label="삭제"
                    >
                      <X size={11} className="text-white" strokeWidth={2.8} />
                    </button>
                  </div>
                ))}
                {photoFiles.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center gap-1 press-strong"
                    style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)", border: "1px dashed var(--color-gray-300)" }}
                  >
                    <Camera size={20} className="text-text-sub" strokeWidth={1.5} />
                    <p className="text-[11px] text-text-sub font-medium">추가</p>
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
            <label className="text-[13px] font-semibold text-text-main mb-2 block">
              이름 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 까망이, 치즈, 삼색이"
              maxLength={20}
              className="w-full px-4 py-3 text-[15px] outline-none focus:border-primary transition-colors placeholder:text-text-light"
              style={fieldStyle}
            />
          </div>
          </>
          )}

          {/* 동네 */}
          {(!showDiscoverySteps || discoveryStep === "location") && (
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">
              동네 <span className="text-error">*</span>
              {detectedGu && (
                <span className="text-[11px] font-normal text-text-light ml-2">
                  {detectedGu}
                </span>
              )}
            </label>
            {selectedDong && !editingDong ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-3" style={fieldStyle}>
                  <MapPin size={14} className="text-text-sub shrink-0" />
                  <span className="text-[15px] font-semibold text-text-main">{selectedDong}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDong(true)}
                  className="text-[13px] text-text-sub underline shrink-0 px-2"
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
                className="w-full px-4 py-3 text-[15px] outline-none focus:border-primary transition-colors placeholder:text-text-light"
                style={fieldStyle}
              />
            )}
          </div>
          )}

          {(!showDiscoverySteps || discoveryStep === "identity") && (
          <>
          {/* 추가 정보 토글 — 기본은 이름·동네만, 나머지는 접어서 마찰 최소화 */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full flex items-center justify-between h-12 px-1 text-[15px] font-semibold text-text-main press"
            style={{ borderTop: "1px solid var(--color-divider)", borderBottom: "1px solid var(--color-divider)" }}
            aria-expanded={showMore}
          >
            <span>{showMore ? "추가 정보 접기" : "한 줄 소개·성별·건강 등 추가 (선택)"}</span>
            <ChevronDown
              size={18}
              style={{ color: "var(--color-text-muted)", transform: showMore ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
            />
          </button>

          {showMore && (
          <>
          {/* 한 줄 소개 */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">한 줄 소개</label>

            {/* 안내 — 위치 특정 금지 */}
            <div
              className="mb-2 px-3 py-2.5 flex items-start gap-2"
              style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
            >
              <ShieldAlert size={14} className="shrink-0 mt-0.5 text-text-sub" />
              <p className="text-[13px] leading-relaxed text-text-sub">
                <b className="text-text-main">길고양이 안전을 위해</b> 정확한 위치를 알 수 있는 표현은 적지 마세요.
                <br />
                <span className="text-text-light">
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
              className="w-full px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-text-light resize-none"
              style={{
                ...fieldStyle,
                borderColor:
                  descLocationViolations.length > 0 || descAbuseViolations.length > 0
                    ? "var(--color-error)"
                    : "var(--color-border)",
              }}
            />
            <div className="flex items-start justify-between gap-2 mt-1">
              <div className="flex-1 min-w-0 space-y-0.5">
                {descLocationViolations.length > 0 && (
                  <p className="text-[11px] leading-relaxed text-error">
                    {descLocationViolations.map((v) => `${v.label}(${v.match})`).join(", ")} —
                    일반 표현(우리 동네·골목·근처)으로 바꿔주세요.
                  </p>
                )}
                {descAbuseViolations.length > 0 && (
                  <p className="text-[11px] leading-relaxed text-error">
                    {formatAbuseMessage(descAbuseViolations)}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-text-light shrink-0">{description.length}/120</p>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">상태 태그</label>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESETS.map((tag) => (
                <UIChip key={tag} active={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                  {tag}
                </UIChip>
              ))}
            </div>
          </div>

          {/* 성별 */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">성별</label>
            <div className="flex gap-2">
              {(Object.entries(GENDER_MAP) as [CatGender, { label: string; emoji: string }][]).map(([key, info]) => (
                <UIChip key={key} active={gender === key} onClick={() => setGender(key)} className="flex-1 justify-center">
                  {info.label}
                </UIChip>
              ))}
            </div>
          </div>

          {/* 중성화 여부 */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">중성화 여부</label>
            <div className="flex gap-2">
              {([
                { value: true, label: "완료" },
                { value: false, label: "미완료" },
                { value: null, label: "모름" },
              ] as const).map((opt) => (
                <UIChip
                  key={String(opt.value)}
                  active={neutered === opt.value}
                  onClick={() => setNeutered(opt.value)}
                  className="flex-1 justify-center"
                >
                  {opt.label}
                </UIChip>
              ))}
            </div>
          </div>

          {/* 건강 상태 — 위험·주의만 의미색, 양호는 기본(테라코타) */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">건강 상태</label>
            <div className="flex gap-2">
              {(Object.entries(HEALTH_MAP) as [CatHealthStatus, { label: string; emoji: string; color: string }][]).map(([key, info]) => (
                <UIChip
                  key={key}
                  active={healthStatus === key}
                  activeColor={key === "danger" ? "var(--color-error)" : key === "caution" ? "var(--color-warning)" : undefined}
                  onClick={() => setHealthStatus(key)}
                  className="flex-1 justify-center"
                >
                  {info.label}
                </UIChip>
              ))}
            </div>
          </div>

          {/* 입양·임시보호 매칭 (선택) */}
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">
              입양·임시보호 <span className="text-text-light font-normal">(선택)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <UIChip active={adoptionStatus === null} onClick={() => setAdoptionStatus(null)} className="col-span-2 justify-center">
                해당 없음
              </UIChip>
              {(Object.entries(ADOPTION_MAP) as [Exclude<AdoptionStatus, null>, typeof ADOPTION_MAP["seeking_home"]][]).map(([key, info]) => (
                <UIChip key={key} active={adoptionStatus === key} onClick={() => setAdoptionStatus(key)} className="justify-center">
                  {info.short}
                </UIChip>
              ))}
            </div>
            <p className="text-[11px] text-text-light mt-1.5 leading-relaxed px-1">
              설정하면 상세 페이지에 배지와 문의 버튼이 생겨요.
            </p>
          </div>
          </>
          )}
          </>
          )}

          {/* 공개 범위 — Private Circle */}
          {(!showDiscoverySteps || discoveryStep === "visibility") && (
          <div>
            <label className="text-[13px] font-semibold text-text-main mb-2 block">
              공개 범위 <span className="text-text-light font-normal">(보안)</span>
            </label>
            <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}>
              {(Object.entries(VISIBILITY_MAP) as [CatVisibility, typeof VISIBILITY_MAP["public"]][]).map(([key, info], i, arr) => {
                const active = visibility === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVisibility(key)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 press"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--color-divider)" : "none", minHeight: 56 }}
                    aria-pressed={active}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-text-main">{info.label}</p>
                      <p className="text-[13px] mt-0.5 leading-relaxed text-text-sub">{info.description}</p>
                    </div>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: active ? "var(--color-primary)" : "var(--color-surface)",
                        border: `1px solid ${active ? "var(--color-primary)" : "var(--color-gray-300)"}`,
                      }}
                    >
                      {active && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-text-light mt-1.5 leading-relaxed px-1">
              학대 우려가 큰 아이는 <b>내 서클</b>이나 <b>나만 보기</b>로 설정하세요.{" "}
              <Link href="/mypage/circle" className="underline" style={{ color: "var(--color-primary)" }}>
                서클 멤버 관리
              </Link>
            </p>
          </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="px-4 py-3" style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-error-soft)" }}>
              <p className="text-[13px] font-semibold text-error">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div
          className="px-5 py-3"
          style={{ borderTop: "1px solid var(--color-border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {(!showDiscoverySteps || discoveryStep === "visibility") && (
          <UIButton variant="primary" size="lg" full onClick={handleSubmit} disabled={submitting}>
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
          </UIButton>
          )}
        </div>
      </div>

      {/* 등록 직후 축하 peak-end */}
      <CatRegistrationCelebration
        open={celebration.open}
        catName={celebration.catName}
        isFirstEver={celebration.isFirstEver}
        registrationCount={celebration.registrationCount}
        cat={celebration.cat}
        onClose={() => {
          setCelebration((prev) => ({ ...prev, open: false }));
          if (celebration.cat) onCreated(celebration.cat);
          onClose();
        }}
      />

    </div>,
    portalRoot,
  );

  return portal;
}
