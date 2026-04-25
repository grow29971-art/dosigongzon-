"use client";

// 1000명 이벤트 — 키링 응모 페이지.
// 로그인 가드 → 폼(이름·주소·전화·고양이 사진) → POST /api/event/keyring → admin 알림.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2, Gift, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { convertImageToWebp } from "@/lib/cats-repo";
import { useToast } from "@/app/components/Toast";

export default function KeyringEventPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [catName, setCatName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [alreadyEntered, setAlreadyEntered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 비로그인이면 로그인 페이지로
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/event/keyring");
    }
  }, [user, authLoading, router]);

  // 이미 응모했는지 확인
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("event_keyring_entries")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((res: { data: { id: string } | null }) => {
        if (res.data) setAlreadyEntered(true);
      });
  }, [user]);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("이미지는 20MB 이하만 가능해요.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!catName.trim() || !photoFile) {
      setError("고양이 이름과 사진을 입력해주세요.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const supabase = createClient();
      // 1) 사진 업로드 (cat-photos 버킷 재활용)
      const webp = await convertImageToWebp(photoFile);
      const fileName = `${user.id}/event-keyring-${Date.now()}.webp`;
      const { error: uploadErr } = await supabase.storage
        .from("cat-photos")
        .upload(fileName, webp, { contentType: "image/webp", upsert: false });
      if (uploadErr) throw new Error(`사진 업로드 실패: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from("cat-photos").getPublicUrl(fileName);
      const cat_photo_url = urlData.publicUrl;

      // 2) API 호출 → DB insert + admin notification
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/event/keyring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          cat_name: catName.trim(),
          cat_photo_url,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "응모 실패");

      setDone(true);
      toast.success("응모 완료! 추첨 결과를 기다려주세요 🎁");
    } catch (err) {
      setError(err instanceof Error ? err.message : "응모 중 오류 발생");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[18px] font-extrabold text-text-main flex items-center gap-1.5">
          <Gift size={16} style={{ color: "#C47E5A" }} />
          1000명 이벤트 응모
        </h1>
      </div>

      {/* 안내 카드 */}
      <div className="px-4 mt-2 mb-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
            border: "1.5px solid rgba(196,126,90,0.25)",
          }}
        >
          <p className="text-[10.5px] font-extrabold tracking-[0.12em] mb-1" style={{ color: "#C47E5A" }}>
            🎁 길고양이 모양 아크릴 키링
          </p>
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight mb-1">
            가입자 1,000명 달성 시 20명 추첨
          </p>
          <p className="text-[11.5px] text-text-sub leading-relaxed">
            첨부하신 길고양이 사진을 기반으로 키링을 제작해서 보내드려요.
            사진은 정면·측면 등 키링으로 만들기 좋은 또렷한 컷으로 부탁드려요.
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-4">
        {done ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#E8ECE5", border: "1px solid #D6DCD2" }}
          >
            <Check size={36} className="mx-auto mb-3" style={{ color: "#6B8E6F" }} />
            <p className="text-[16px] font-extrabold text-text-main mb-2">응모 완료!</p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              가입자 1,000명 달성 시 추첨해서 등록된 쪽지·연락처로 안내드릴게요.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              홈으로
            </Link>
          </div>
        ) : alreadyEntered ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#FFF4E0", border: "1px solid #F5DAB0" }}
          >
            <Gift size={36} className="mx-auto mb-3" style={{ color: "#B07A1C" }} />
            <p className="text-[16px] font-extrabold text-text-main mb-2">이미 응모하셨어요</p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              한 분당 한 번만 응모 가능해요. 추첨 결과는 곧 안내드릴게요.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold"
            >
              홈으로
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 고양이 이름 */}
            <div>
              <label className="text-[12px] font-bold text-text-main mb-1.5 block">
                고양이 이름 <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="예: 까망이, 치즈, 나비"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
                style={{ background: "#FFFFFF", border: "1px solid #E3DCD3" }}
              />
            </div>

            {/* 고양이 사진 */}
            <div>
              <label className="text-[12px] font-bold text-text-main mb-1.5 block">
                키링 제작용 고양이 사진 <span className="text-error">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoPick}
              />
              {photoPreview ? (
                <div className="relative inline-block">
                  <Image
                    src={photoPreview}
                    alt="첨부된 고양이 사진"
                    width={140}
                    height={140}
                    unoptimized
                    className="rounded-xl object-cover"
                    style={{ width: 140, height: 140 }}
                  />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-text-main flex items-center justify-center"
                    aria-label="사진 제거"
                  >
                    <X size={12} color="#fff" strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-8 rounded-xl flex flex-col items-center justify-center gap-2 active:scale-[0.98]"
                  style={{ background: "#FFFFFF", border: "1.5px dashed #C47E5A" }}
                >
                  <Camera size={24} className="text-primary" />
                  <span className="text-[12.5px] font-bold text-primary">사진 첨부</span>
                  <span className="text-[10.5px] text-text-light">JPG·PNG·WebP · 최대 20MB</span>
                </button>
              )}
            </div>

            {/* 에러 */}
            {error && (
              <div className="rounded-xl px-4 py-3" style={{ background: "#FBEAEA" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
              </div>
            )}

            {/* 제출 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !catName.trim() || !photoFile}
              className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold disabled:opacity-50 active:scale-[0.97] flex items-center justify-center gap-2"
              style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.30)" }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
              {submitting ? "응모 중..." : "응모 완료하기"}
            </button>

            <p className="text-[10.5px] text-text-light text-center leading-relaxed pt-2">
              · 추첨되시면 쪽지로 배송 정보를 따로 여쭤볼게요.<br />
              · 한 분당 1회만 응모 가능합니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
