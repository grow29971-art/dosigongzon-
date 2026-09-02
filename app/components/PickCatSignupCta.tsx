"use client";

// 비로그인 고양이 상세의 "{이름} 소식 받기" CTA — 온보딩 pick 지점 (2026-07-24, 카피 2026-09-02)
// "지도가 곧 온보딩"(7/22 B안)에서 pick = 지도→상세로 들어온 방문자가 이 아이를 계기로
// 가입을 결심하는 순간. 누르면 pending_care 커밋(localStorage) + onboarding_pick 계측 후
// 가입으로 보낸다. 가입 후 홈에서 PendingCareHandoff가 이 키를 이어받아 첫 밥 CTA로 연결.
// (구 /onboarding pick 화면은 7/22 폐지 — 쓰기 경로가 함께 사라져 퍼널 3스텝이 죽어 있었다)

import Link from "next/link";
import { useEffect } from "react";
import { logFunnelEvent } from "@/lib/funnel-repo";

const PENDING_KEY = "dosigongzon_pending_care";

export default function PickCatSignupCta({ catId, catName }: { catId: string; catName: string }) {
  // 이 컴포넌트는 비로그인일 때만 렌더되므로(cats/[id]/page.tsx의 !currentUserId 블록),
  // 마운트 = "비로그인 방문자가 고양이 상세에 도달"이다. pick 바로 앞단을 재는 스텝으로,
  // 이게 없으면 onboarding_pick이 0일 때 "동선이 안 닿았다"와 "닿았는데 안 눌렀다"를
  // 구분할 수 없다. (logFunnelEvent는 스텝당 기기 1회 가드가 있어 중복 걱정 없음)
  useEffect(() => {
    logFunnelEvent("cat_detail_view_anon", catId);
  }, [catId]);

  const commit = () => {
    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ id: catId, name: catName, at: new Date().toISOString() }),
      );
    } catch { /* 저장소 차단 — 핸드오프만 포기, 가입 동선은 유지 */ }
    // fetch keepalive라 페이지 이동에도 전송이 살아남는다
    logFunnelEvent("onboarding_pick", catId);
  };

  return (
    <Link
      href={`/signup?next=${encodeURIComponent(`/cats/${catId}`)}`}
      onClick={commit}
      className="flex-[1.6] flex items-center justify-center py-2.5 rounded-xl text-white text-[13px] font-bold press transition-transform"
      style={{
        background: "var(--color-primary)",
        boxShadow: "var(--shadow-primary)",
      }}
    >
      {catName ? `${catName} 소식 받기` : "이 아이 소식 받기"}
    </Link>
  );
}
