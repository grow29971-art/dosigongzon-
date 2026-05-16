// "지금 활발한 동네 TOP" 산출.
// 메트릭 3종 (이번 주 신규 등록 / 활동 캣맘 / 치료 병원) 결합 점수로 랭킹.
// HomeLanding(비로그인 랜딩)에서 사용. 10분 캐시로 anon 방문자 전체 공유.

import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { SEOUL_GUS } from "@/lib/seoul-regions";
import { getGuCounts } from "@/lib/region-counts";

export interface RegionActivity {
  slug: string;
  name: string;
  totalCats: number;
  recentCats: number;       // 최근 7일 신규 등록
  activeCaretakers: number; // 최근 7일 활동 캣맘 (distinct)
  hospitals: number;        // 등록 치료 병원
  score: number;
}

const RECENT_DAYS = 7;

/** region 문자열을 SEOUL_GUS slug로 매핑. 매치 못 하면 null. */
function regionToGuSlug(region: string): string | null {
  const matchedGu = SEOUL_GUS.find((g) => region.includes(g.name));
  if (matchedGu) return matchedGu.slug;
  for (const g of SEOUL_GUS) {
    if (g.dongs.some((d) => region.includes(d))) return g.slug;
  }
  return null;
}

async function fetchActiveRegions(): Promise<RegionActivity[]> {
  try {
    const supabase = createAnonClient();
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [totalCounts, recentRes, hospitalsRes] = await Promise.all([
      getGuCounts(),
      supabase
        .from("cats")
        .select("region, caretaker_id")
        .gte("created_at", since),
      supabase
        .from("rescue_hospitals")
        .select("region")
        .eq("hidden", false),
    ]);

    type RecentRow = { region: string | null; caretaker_id: string | null };
    type HospitalRow = { region: string | null };

    const recentByGu: Record<string, { count: number; caretakers: Set<string> }> = {};
    for (const row of (recentRes.data ?? []) as RecentRow[]) {
      if (!row.region) continue;
      const slug = regionToGuSlug(row.region);
      if (!slug) continue;
      const e = recentByGu[slug] ?? (recentByGu[slug] = { count: 0, caretakers: new Set() });
      e.count++;
      if (row.caretaker_id) e.caretakers.add(row.caretaker_id);
    }

    const hospitalsByGu: Record<string, number> = {};
    for (const row of (hospitalsRes.data ?? []) as HospitalRow[]) {
      if (!row.region) continue;
      const slug = regionToGuSlug(row.region);
      if (!slug) continue;
      hospitalsByGu[slug] = (hospitalsByGu[slug] ?? 0) + 1;
    }

    const results: RegionActivity[] = SEOUL_GUS.map((g) => {
      const total = totalCounts[g.slug] ?? 0;
      const r = recentByGu[g.slug];
      const recentCats = r?.count ?? 0;
      const activeCaretakers = r?.caretakers.size ?? 0;
      const hospitals = hospitalsByGu[g.slug] ?? 0;
      // 최근 활동 가중치 가장 높게, 캣맘 다음, 병원·누적은 보조 시그널.
      const score = recentCats * 5 + activeCaretakers * 3 + hospitals * 1 + total * 0.1;
      return { slug: g.slug, name: g.name, totalCats: total, recentCats, activeCaretakers, hospitals, score };
    });

    return results.sort((a, b) => b.score - a.score).filter((r) => r.score > 0);
  } catch {
    return [];
  }
}

export const getActiveRegionsTop3 = unstable_cache(
  async (): Promise<RegionActivity[]> => {
    const all = await fetchActiveRegions();
    return all.slice(0, 3);
  },
  ["active-regions-top3"],
  { revalidate: 600, tags: ["active-regions-top3"] },
);
