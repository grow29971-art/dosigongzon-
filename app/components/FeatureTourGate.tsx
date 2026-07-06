"use client";

// FeatureTourModal을 홈뿐 아니라 (main) 레이아웃 전체(지도·마이페이지·커뮤니티 등)에서
// 로그인 유저 최초 1회 띄우는 게이트. WelcomeGate(/welcome, 가입 직후 축하+슬라이드)와
// 같은 패턴이지만 페이지 이동 없이 오버레이로만 띄운다 — /welcome 위에서는 안 겹치게
// 막아서, 가입 직후엔 welcome이 끝나고 실제 목적지에 도착했을 때 뜨도록 자연스럽게 순서가 잡힌다.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { listMyActivityRegions, type ActivityRegion } from "@/lib/activity-regions-repo";
import FeatureTourModal from "@/app/components/FeatureTourModal";

export default function FeatureTourGate() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"idle" | "show" | "hidden">("idle");
  const [hasRegion, setHasRegion] = useState(false);

  const onExcludedPath = pathname?.startsWith("/welcome") || pathname?.startsWith("/onboarding");

  useEffect(() => {
    if (loading || !user) return;
    if (onExcludedPath) return;
    if (status !== "idle") return;

    let cancelled = false;
    const profileQuery = createClient()
      .from("profiles")
      .select("feature_tour_completed_at")
      .eq("id", user.id)
      .maybeSingle() as Promise<{ data: { feature_tour_completed_at?: string | null } | null }>;
    const regionsQuery: Promise<ActivityRegion[]> = listMyActivityRegions().catch(() => []);

    Promise.all([profileQuery, regionsQuery])
      .then(([{ data }, regions]) => {
        if (cancelled) return;
        setHasRegion(regions.length > 0);
        setStatus(data?.feature_tour_completed_at ? "hidden" : "show");
      })
      .catch(() => { if (!cancelled) setStatus("hidden"); });

    return () => { cancelled = true; };
  }, [user, loading, onExcludedPath, status]);

  if (status !== "show" || onExcludedPath) return null;

  return <FeatureTourModal hasRegion={hasRegion} onDone={() => setStatus("hidden")} />;
}
