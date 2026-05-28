// 동네 고양이 도감 — 수집 메커니즘. (DB 마이그레이션 없음)
// 우리 동네(주 활동지역 반경) 공개 고양이 중, 내가 등록/돌봄/댓글로 "만난" 아이 = 수집.
// 미수집 아이는 실루엣으로 노출 → "만나러 가기"로 핵심 돌봄 루프 유도.

import { createClient } from "@/lib/supabase/client";
import { listCats } from "@/lib/cats-repo";
import { listMyActivityRegions, distanceMeters } from "@/lib/activity-regions-repo";

export interface DexCat {
  id: string;
  name: string;
  photoUrl: string | null;
  collected: boolean;
  mine: boolean; // 내가 등록한 아이
}

export interface NeighborhoodCollection {
  regionName: string | null;
  hasRegion: boolean;
  cats: DexCat[];
  collectedCount: number;
  total: number;
}

const empty = (regionName: string | null, hasRegion: boolean): NeighborhoodCollection => ({
  regionName,
  hasRegion,
  cats: [],
  collectedCount: 0,
  total: 0,
});

export async function getNeighborhoodCollection(): Promise<NeighborhoodCollection> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty(null, false);

  const regions = await listMyActivityRegions();
  const primary = regions.find((r) => r.is_primary) ?? regions[0] ?? null;
  if (!primary) return empty(null, false);

  const allCats = await listCats(); // RLS상 볼 수 있는 고양이만 반환
  const neighborhood = allCats.filter(
    (c) => distanceMeters({ lat: c.lat, lng: c.lng }, { lat: primary.lat, lng: primary.lng }) <= primary.radius_m,
  );
  if (neighborhood.length === 0) return empty(primary.name, true);

  const ids = neighborhood.map((c) => c.id);
  const [careRes, commentRes] = await Promise.all([
    supabase.from("care_logs").select("cat_id").eq("author_id", user.id).in("cat_id", ids),
    supabase.from("cat_comments").select("cat_id").eq("author_id", user.id).in("cat_id", ids),
  ]);
  const met = new Set<string>();
  for (const r of (careRes.data ?? []) as { cat_id: string }[]) met.add(r.cat_id);
  for (const r of (commentRes.data ?? []) as { cat_id: string }[]) met.add(r.cat_id);

  const cats: DexCat[] = neighborhood.map((c) => {
    const mine = c.caretaker_id === user.id;
    return {
      id: c.id,
      name: c.name,
      photoUrl: c.photo_url,
      collected: mine || met.has(c.id),
      mine,
    };
  });
  // 수집한 아이 먼저(자랑), 그다음 미수집 — 그 안에선 이름순
  cats.sort((a, b) => Number(b.collected) - Number(a.collected) || a.name.localeCompare(b.name, "ko"));

  return {
    regionName: primary.name,
    hasRegion: true,
    cats,
    collectedCount: cats.filter((c) => c.collected).length,
    total: cats.length,
  };
}
