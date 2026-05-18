"use client";

// 2026-05-18 패치 안내 배너 — Private Circle·안전 강화.
// 로그인 유저 홈 상단에 표시, 닫으면 localStorage로 영구 dismiss.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X, ArrowRight } from "lucide-react";

const DISMISS_KEY = "dosigongzon_patch_518_dismissed";

export default function PatchUpdateBanner518() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <section className="px-5 mt-3">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #4F6B53 0%, #6B8E6F 70%, #8FAE92 100%)",
          boxShadow: "0 8px 24px rgba(79,107,83,0.20), 0 2px 6px rgba(79,107,83,0.12)",
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} color="#FFF7C4" />
              <span className="text-[10px] font-extrabold tracking-[0.18em]" style={{ color: "#FFF7C4" }}>
                NEW · 5/18 업데이트
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 active:scale-90 transition-transform"
              aria-label="닫기"
            >
              <X size={16} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
          <p className="text-[14.5px] font-extrabold text-white leading-snug mb-2 tracking-tight">
            🛡 Private Circle — 믿는 이웃에게만 핀 공개
          </p>
          <p className="text-[12px] leading-[1.75]" style={{ color: "rgba(255,255,255,0.92)" }}>
            걱정되는 아이는 <b style={{ color: "#FFF7C4" }}>"내 서클"</b>로 등록하면 내가
            승인한 이웃에게만 보입니다. 일반 가입자에게도 외부인에게도 노출되지 않아요.
          </p>
          <p className="text-[11.5px] mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            함께 강화: 좌표 ±444m 흐림 · 비로그인 외부인 도트만 · 위치 단어 자동 차단 ·
            사진 GPS 자동 제거
          </p>
          <Link
            href="/mypage/circle"
            onClick={handleDismiss}
            className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ background: "rgba(255,255,255,0.95)", color: "#4F6B53" }}
          >
            <span>내 서클 시작하기</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
