// 서울 25개 구별 등록 고양이 수 집계.
// HomeLanding/areas 두 곳에서 공유. RPC가 region별 count만 반환하므로
// 50,000행 select 대비 egress ~1000배 절감. unstable_cache로 모든
// 익명 방문자가 캐시된 결과를 공유 (10분 갱신).

import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { SEOUL_GUS } from "@/lib/seoul-regions";

async function fetchGuCounts(): Promise<Record<string, number>> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.rpc("cat_count_by_region");
    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const row of data as { region: string | null; count: number }[]) {
      if (!row.region) continue;
      const c = Number(row.count) || 0;
      const matchedGu = SEOUL_GUS.find((g) => row.region!.includes(g.name));
      if (matchedGu) {
        counts[matchedGu.slug] = (counts[matchedGu.slug] ?? 0) + c;
        continue;
      }
      for (const g of SEOUL_GUS) {
        if (g.dongs.some((d) => row.region!.includes(d))) {
          counts[g.slug] = (counts[g.slug] ?? 0) + c;
          break;
        }
      }
    }
    return counts;
  } catch {
    return {};
  }
}

export const getGuCounts = unstable_cache(fetchGuCounts, ["cat-gu-counts"], {
  revalidate: 600,
  tags: ["cat-gu-counts"],
});
