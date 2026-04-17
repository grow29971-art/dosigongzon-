"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Camera, MapPin, Loader2, Plus, Lock } from "lucide-react";
import { createCat, uploadCatPhoto, type Cat, type CatGender, type CatHealthStatus, GENDER_MAP, HEALTH_MAP } from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";

interface AddCatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (cat: Cat) => void;
  // 지도 클릭으로 전달된 좌표 (없으면 유저가 입력)
  initialLat?: number;
  initialLng?: number;
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

export default function AddCatModal({
  open,
  onClose,
  onCreated,
  initialLat,
  initialLng,
}: AddCatModalProps) {
  const { user } = useAuth();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [detectedGu, setDetectedGu] = useState("");
  const [selectedDong, setSelectedDong] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [gender, setGender] = useState<CatGender>("unknown");
  const [neutered, setNeutered] = useState<boolean | null>(null);
  const [healthStatus, setHealthStatus] = useState<CatHealthStatus>("good");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        geocoder.coord2RegionCode(lng, lat, (result: any, status: any) => {
          if (status !== window.kakao.maps.services.Status.OK || !result[0]) return;
          const gu = result[0].region_2depth_name || "";
          const dong = result[0].region_3depth_name || "";
          setDetectedGu(gu);
          if (dong) setSelectedDong(dong);
        });
      };

      if (initialLat !== undefined && initialLng !== undefined) {
        // 지도 클릭 좌표가 있으면 그걸로
        resolveRegion(initialLat, initialLng);
      } else if (navigator.geolocation) {
        // 없으면 GPS 현재 위치로 자동 감지
        navigator.geolocation.getCurrentPosition(
          (pos) => resolveRegion(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { timeout: 5000 },
        );
      }
    } else {
      document.body.style.overflow = "";
      setName("");
      setDetectedGu("");
      setSelectedDong("");
      setDescription("");
      setTags([]);
      setGender("unknown");
      setNeutered(null);
      setHealthStatus("good");
      setPhotoFile(null);
      setPhotoPreview(null);
      setError("");
      setSubmitting(false);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, initialLat, initialLng]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능해요.");
      return;
    }
    // 원본은 20MB까지 허용. 업로드 직전에 720p WebP로 변환됨.
    if (file.size > 20 * 1024 * 1024) {
      setError("사진은 20MB 이하만 가능해요.");
      return;
    }

    setError("");
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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

    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        photoUrl = await uploadCatPhoto(photoFile);
      }

      // 지도 중심 좌표에 약간의 랜덤 오프셋 (마커 겹침 방지)
      const offsetLat = initialLat + (Math.random() - 0.5) * 0.004;
      const offsetLng = initialLng + (Math.random() - 0.5) * 0.004;

      const newCat = await createCat({
        name: name.trim(),
        description: description.trim() || undefined,
        photo_url: photoUrl,
        lat: offsetLat,
        lng: offsetLng,
        region: selectedDong.trim(),
        tags,
        gender,
        neutered,
        health_status: healthStatus,
      });

      onCreated(newCat);
      onClose();
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
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
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
            href="/login"
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
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      <div
        className="relative mt-auto w-full bg-white rounded-t-[32px] flex flex-col"
        style={{ maxHeight: "92dvh" }}
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-divider">
          <div>
            <h2 className="text-[17px] font-extrabold text-text-main">우리 동네 아이 등록</h2>
            <p className="text-[11px] text-text-sub mt-0.5">
              사진과 위치, 한 줄 소개로 충분해요
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            <X size={18} className="text-text-sub" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* 사진 업로드 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">사진</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full aspect-[4/3] rounded-2xl bg-surface-alt border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition-transform overflow-hidden"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="미리보기"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <Camera size={28} className="text-text-light" strokeWidth={1.5} />
                  <p className="text-[12px] text-text-sub font-medium">사진 추가하기</p>
                  <p className="text-[10px] text-text-light">자동으로 720p WebP로 변환돼요</p>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* 이름 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">
              이름 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 까망이, 치즈, 삼색이"
              maxLength={20}
              className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
            />
          </div>

          {/* 동네 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">
              동네 <span className="text-error">*</span>
              {detectedGu && (
                <span className="text-[10px] font-normal text-text-light ml-2">
                  📍 {detectedGu}
                </span>
              )}
            </label>
            {selectedDong ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
                  <MapPin size={14} className="text-primary shrink-0" />
                  <span className="text-[14px] font-bold text-text-main">{selectedDong}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDong("")}
                  className="text-[12px] text-text-sub underline shrink-0 px-2"
                >
                  변경
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                placeholder="예: 구월동, 역삼동, 해운대동"
                maxLength={20}
                className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
              />
            )}
          </div>

          {/* 한 줄 소개 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">한 줄 소개</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 만수동 골목의 터줏대감. 사람을 봐도 도망가지 않아요."
              maxLength={120}
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted resize-none"
            />
            <p className="text-[10px] text-text-light mt-1 text-right">{description.length}/120</p>
          </div>

          {/* 태그 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">상태 태그</label>
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
                        ? "bg-primary text-white"
                        : "bg-surface-alt text-text-sub border border-border"
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
            <label className="text-[12px] font-bold text-text-main mb-2 block">성별</label>
            <div className="flex gap-2">
              {(Object.entries(GENDER_MAP) as [CatGender, { label: string; emoji: string }][]).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGender(key)}
                  className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${
                    gender === key ? "bg-primary text-white" : "bg-surface-alt text-text-sub border border-border"
                  }`}
                >
                  {info.emoji} {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* 중성화 여부 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">중성화 여부</label>
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
                    neutered === opt.value ? "bg-primary text-white" : "bg-surface-alt text-text-sub border border-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 건강 상태 */}
          <div>
            <label className="text-[12px] font-bold text-text-main mb-2 block">건강 상태</label>
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

          {/* 안내: 하루 1마리 제한 */}
          <div
            className="rounded-2xl px-4 py-2.5 flex items-start gap-2"
            style={{ backgroundColor: "#EEE8E0", border: "1px solid rgba(196,126,90,0.2)" }}
          >
            <span className="text-[13px]">🐾</span>
            <p className="text-[12px] font-semibold leading-snug" style={{ color: "#7A5238" }}>
              하루에 한 마리씩 등록 가능합니다. 신중하게 기록해주세요.
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#EEE3DE" }}>
              <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div
          className="px-5 py-3 border-t border-divider"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
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
    </div>,
    portalRoot,
  );
}
