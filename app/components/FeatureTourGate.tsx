"use client";

// FeatureTourModal을 홈뿐 아니라 (main) 레이아웃 전체(지도·마이페이지·커뮤니티 등)에서
// 로그인 유저 최초 1회 띄우는 게이트. WelcomeGate(/welcome, 가입 직후 축하+슬라이드)와
// 같은 패턴이지만 페이지 이동 없이 오버레이로만 띄운다 — /welcome 위에서는 안 겹치게
// 막아서, 가입 직후엔 welcome이 끝나고 실제 목적지에 도착했을 때 뜨도록 자연스럽게 순서가 잡힌다.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// supabase-js·모달을 전 페이지 공유 청크에서 빼기 위한 지연 로드 — auth-context와 같은 패턴.
// 이 게이트는 (main) 레이아웃 전체에 마운트되므로 정적 import 하나가 곧 전 페이지 first-load다.
const FeatureTourModal = dynamic(() => import("@/app/components/FeatureTourModal"), {
  ssr: false,
});

export default function FeatureTourGate() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"idle" | "show" | "hidden">("idle");
  const [hasRegion, setHasRegion] = useState(false);

  // /cats/ 를 제외 경로에 넣은 이유 (2026-08-09):
  // 이 모달은 z-[200], FirstFeedBar 는 z-40(FirstFeedBar.tsx:77) 이라 가입 직후
  // 고양이 상세에 착지하면 첫 밥 버튼이 통째로 가려진다. 게다가 아래 finish() 가
  // 페이지를 /map 또는 /mypage/activity-regions 로 밀어내서 기회 자체가 사라진다.
  // pick 을 거쳐 가입한 사람의 착지점이 정확히 여기다 — 투어보다 첫 밥이 먼저다.
  const onExcludedPath =
    pathname?.startsWith("/welcome") ||
    pathname?.startsWith("/onboarding") ||
    pathname?.startsWith("/cats/");

  useEffect(() => {
    if (loading || !user) return;
    if (onExcludedPath) return;
    if (status !== "idle") return;

    let cancelled = false;
    (async () => {
      try {
        const [{ createClient }, { listMyActivityRegions }] = await Promise.all([
          import("@/lib/supabase/client"),
          import("@/lib/activity-regions-repo"),
        ]);
        const profileQuery = createClient()
          .from("profiles")
          .select("feature_tour_completed_at")
          .eq("id", user.id)
          .maybeSingle() as Promise<{ data: { feature_tour_completed_at?: string | null } | null }>;
        const [{ data }, regions] = await Promise.all([
          profileQuery,
          listMyActivityRegions().catch(() => []),
        ]);
        if (cancelled) return;
        setHasRegion(regions.length > 0);
        setStatus(data?.feature_tour_completed_at ? "hidden" : "show");
      } catch {
        if (!cancelled) setStatus("hidden");
      }
    })();

    return () => { cancelled = true; };
  }, [user, loading, onExcludedPath, status]);

  if (status !== "show" || onExcludedPath) return null;

  return <FeatureTourModal hasRegion={hasRegion} onDone={() => setStatus("hidden")} />;
}
