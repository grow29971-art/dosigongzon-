// 고양이 사진 스타일 변환 데모 — /lab/cat-style
// 메인 메뉴에 노출 안 함. URL 직접 진입 + 환경변수 설정 시 활성.
// 출시 후 안정화되면 메인 동선(/map cat 카드)에 통합 예정.

"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Sparkles, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { STYLE_DEFS, type CatStyle } from "@/lib/cat-style-transform";
import AIChatCard from "@/app/components/AIChatCard";

const CAT_PHOTOS_BUCKET = "cat-photos"; // 기존 cat 등록과 동일 bucket 사용

export default function CatStyleLabPage() {
  const { user } = useAuth();
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [style, setStyle] = useState<CatStyle | "custom">("anime");
  const [customPrompt, setCustomPrompt] = useState("");
  const [outputDataUrl, setOutputUrl] = useState<string | null>(null);
  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="min-h-dvh px-5 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <p className="text-[14px] font-bold text-text-main mb-2">로그인이 필요해요</p>
        <Link href="/login?next=/lab/cat-style" className="text-[13px] font-bold text-primary">
          로그인하기 →
        </Link>
      </div>
    );
  }

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError("");
    setOutputUrl(null);
    try {
      const supabase = createClient();
      // Storage RLS: 첫 segment가 user.id여야 함. user.id 먼저, 그 다음 lab 하위.
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/lab/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(CAT_PHOTOS_BUCKET)
        .upload(path, file, { upsert: false, cacheControl: "3600" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from(CAT_PHOTOS_BUCKET).getPublicUrl(path);
      setSourceUrl(pub.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleTransform = async () => {
    if (!sourceUrl) return;
    setTransforming(true);
    setError("");
    setOutputUrl(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("세션 만료. 다시 로그인해주세요.");

      const res = await fetch("/api/cat-style/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ imageUrl: sourceUrl, style, customPrompt: style === "custom" ? customPrompt : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "변환 실패");
      setOutputUrl(json.outputDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "변환 실패");
    } finally {
      setTransforming(false);
    }
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <div className="px-4 pt-12 pb-3 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main">AI 도구</h1>
          <p className="text-[10.5px] text-text-sub">사진 변환 · AI 집사 채팅</p>
        </div>
      </div>

      {/* AI 집사 채팅 카드 — 변환 전 또는 사용 안 할 때 진입 */}
      <div className="px-4 mt-1 mb-3">
        <AIChatCard />
      </div>

      {/* 1) 업로드 영역 */}
      <section className="px-5 mt-3">
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-text-light mb-1.5">STEP 1 · UPLOAD</p>
        {!sourceUrl ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-10 rounded-2xl flex flex-col items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
            style={{
              background: "#FFFFFF",
              border: "2px dashed rgba(196,126,90,0.35)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
            }}
          >
            {uploading ? (
              <Loader2 size={22} className="animate-spin text-primary" />
            ) : (
              <>
                <Upload size={22} style={{ color: "#C47E5A" }} />
                <p className="text-[13px] font-extrabold text-text-main">사진 선택하기</p>
                <p className="text-[10.5px] text-text-sub">고양이 사진 1장 (JPG·PNG)</p>
              </>
            )}
          </button>
        ) : (
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "1/1", background: "#EEE8E0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sourceUrl} alt="원본" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => { setSourceUrl(null); setOutputUrl(null); }}
              className="absolute top-2 right-2 px-3 py-1.5 rounded-xl text-[11px] font-extrabold text-white"
              style={{ background: "rgba(0,0,0,0.55)" }}
            >
              다시 선택
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </section>

      {/* 2) 스타일 선택 */}
      {sourceUrl && (
        <section className="px-5 mt-5">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-text-light mb-1.5">STEP 2 · STYLE</p>
          <div className="grid grid-cols-2 gap-2">
            {STYLE_DEFS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className="text-left px-3.5 py-3 rounded-2xl active:scale-[0.97] transition-transform"
                style={{
                  background: style === s.id ? "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" : "#FFFFFF",
                  color: style === s.id ? "#FFFFFF" : "#2C2C2C",
                  border: style === s.id ? "1.5px solid #A8684A" : "1px solid rgba(0,0,0,0.06)",
                  boxShadow: style === s.id ? "0 4px 14px rgba(196,126,90,0.35)" : "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <p className="text-[16px] mb-0.5">{s.emoji} <span className="text-[13px] font-extrabold tracking-tight">{s.name}</span></p>
                <p className="text-[10.5px]" style={{ color: style === s.id ? "rgba(255,255,255,0.80)" : "rgba(60,46,35,0.65)" }}>
                  {s.description}
                </p>
              </button>
            ))}
            {/* 5번째: 직접 작성 */}
            <button
              type="button"
              onClick={() => setStyle("custom")}
              className="text-left px-3.5 py-3 rounded-2xl active:scale-[0.97] transition-transform col-span-2"
              style={{
                background: style === "custom" ? "linear-gradient(135deg, #8B65B8 0%, #6B4FA8 100%)" : "#FFFFFF",
                color: style === "custom" ? "#FFFFFF" : "#2C2C2C",
                border: style === "custom" ? "1.5px solid #6B4FA8" : "1px solid rgba(0,0,0,0.06)",
                boxShadow: style === "custom" ? "0 4px 14px rgba(139,101,184,0.35)" : "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <p className="text-[16px] mb-0.5">✍️ <span className="text-[13px] font-extrabold tracking-tight">직접 작성</span><span className="ml-1.5 text-[9px] font-bold tracking-[0.12em] opacity-70">AI 번역</span></p>
              <p className="text-[10.5px]" style={{ color: style === "custom" ? "rgba(255,255,255,0.80)" : "rgba(60,46,35,0.65)" }}>
                한국어로 자유 입력 — Gemini가 영어 image prompt로 변환
              </p>
            </button>
          </div>

          {/* custom 모드 — textarea */}
          {style === "custom" && (
            <div className="mt-3">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="예) 우주복 입고 별빛 사이를 떠다니는 검은 고양이, 신비로운 분위기"
                rows={3}
                maxLength={500}
                className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none resize-none focus:ring-2 focus:ring-primary/30"
                style={{
                  background: "#FFFFFF",
                  color: "#2C2C2C",
                  border: "1.5px solid rgba(139,101,184,0.25)",
                }}
              />
              <p className="text-[10px] text-text-light mt-1 text-right tabular-nums">
                {customPrompt.length}/500
              </p>
            </div>
          )}
        </section>
      )}

      {/* 3) 변환 버튼 */}
      {sourceUrl && (
        <section className="px-5 mt-5">
          <button
            type="button"
            onClick={handleTransform}
            disabled={transforming}
            className="w-full py-3.5 rounded-2xl text-white text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 6px 18px rgba(196,126,90,0.35)",
            }}
          >
            {transforming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                생성 중… (첫 호출은 최대 40초 cold start)
              </>
            ) : (
              <>
                <Sparkles size={15} />
                생성하기
              </>
            )}
          </button>
          <p className="text-[10.5px] text-center mt-2 text-text-light leading-relaxed">
            🆓 무료 베타 · 일 3회 제한 · 결과 다운로드해서 보관해주세요
            <br />원본 사진을 그대로 변환하지 않고, 같은 스타일의 고양이 일러스트를 생성해요
          </p>
        </section>
      )}

      {/* 4) 결과 */}
      {outputDataUrl && (
        <section className="px-5 mt-6">
          <p className="text-[10px] font-extrabold tracking-[0.18em] mb-1.5" style={{ color: "#6B8E6F" }}>RESULT</p>
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "1/1", background: "#EEE8E0", boxShadow: "0 8px 24px rgba(196,126,90,0.20)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outputDataUrl} alt="변환 결과" className="w-full h-full object-cover" />
          </div>
          <a
            href={outputDataUrl}
            download={`dosigongzon-${style}-${Date.now()}.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[13px] font-extrabold bg-white active:scale-[0.98]"
            style={{ color: "#A8684A", border: "1.5px solid rgba(196,126,90,0.30)" }}
          >
            <Download size={14} />
            결과 다운로드
          </a>
        </section>
      )}

      {error && (
        <div className="mx-5 mt-4 rounded-2xl px-4 py-3" style={{ background: "#FBEAEA" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
        </div>
      )}

      {/* 안내 */}
      <p className="text-center text-[10.5px] text-text-light mt-8 px-6 leading-relaxed">
        🧪 베타 기능 — 운영자 테스트 페이지<br />
        결과는 Replicate AI 모델이 생성하며, 원본 그대로의 보장은 없어요.<br />
        Generation 비용: 약 ₩50/회 (운영자 부담, 일일 3회 제한)
      </p>
    </div>
  );
}
