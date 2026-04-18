// ══════════════════════════════════════════
// 도시공존 — 활동 지역 Repository
// 당근마켓 스타일: 유저당 최대 2개 활동 지역 (중심 + 반경)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type RegionSlot = 1 | 2;

export interface ActivityRegion {
  user_id: string;
  slot: RegionSlot;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityRegionInput {
  slot: RegionSlot;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  is_primary?: boolean;
}

// ── 반경 프리셋 (당근마켓 참고) ──
export const RADIUS_PRESETS: { value: number; label: string }[] = [
  { value: 500,  label: "500m" },
  { value: 1000, label: "1km" },
  { value: 2000, label: "2km" },
  { value: 3000, label: "3km" },
  { value: 5000, label: "5km" },
];

// ── Haversine: 두 좌표 간 거리(m) ──
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── 좌표가 활동 지역 중 하나라도 포함되는지 ──
export function isInRegions(
  point: { lat: number; lng: number },
  regions: ActivityRegion[],
): boolean {
  if (regions.length === 0) return true; // 설정 없으면 필터 안 함
  return regions.some(
    (r) => distanceMeters(point, { lat: r.lat, lng: r.lng }) <= r.radius_m,
  );
}

// ── 특정 지역(활성화된 탭)에 포함되는지 ──
export function isInRegion(
  point: { lat: number; lng: number },
  region: ActivityRegion | null,
): boolean {
  if (!region) return true;
  return distanceMeters(point, { lat: region.lat, lng: region.lng }) <= region.radius_m;
}

// ══════════════════════════════════════════
// 조회
// ══════════════════════════════════════════

export async function listMyActivityRegions(): Promise<ActivityRegion[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_activity_regions")
    .select("*")
    .eq("user_id", user.id)
    .order("slot", { ascending: true });

  if (error) {
    console.error("[activity-regions-repo] listMyActivityRegions failed:", error);
    return [];
  }
  return (data ?? []) as ActivityRegion[];
}

// ══════════════════════════════════════════
// 저장 (upsert)
// ══════════════════════════════════════════

export async function upsertActivityRegion(
  input: ActivityRegionInput,
): Promise<ActivityRegion> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const row = {
    user_id: user.id,
    slot: input.slot,
    name: input.name.trim().slice(0, 40),
    lat: input.lat,
    lng: input.lng,
    radius_m: Math.max(300, Math.min(5000, Math.round(input.radius_m))),
    is_primary: input.is_primary ?? input.slot === 1,
  };

  // is_primary=true 인 경우, 다른 슬롯의 is_primary를 false로 내려야 유니크 인덱스 충돌 방지
  if (row.is_primary) {
    await supabase
      .from("user_activity_regions")
      .update({ is_primary: false })
      .eq("user_id", user.id)
      .neq("slot", row.slot);
  }

  const { data, error } = await supabase
    .from("user_activity_regions")
    .upsert(row, { onConflict: "user_id,slot" })
    .select()
    .single();

  if (error) {
    console.error("[activity-regions-repo] upsert failed:", error);
    throw new Error(`활동 지역을 저장할 수 없어요: ${error.message}`);
  }
  return data as ActivityRegion;
}

// ══════════════════════════════════════════
// 삭제
// ══════════════════════════════════════════

export async function deleteActivityRegion(slot: RegionSlot): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { error } = await supabase
    .from("user_activity_regions")
    .delete()
    .eq("user_id", user.id)
    .eq("slot", slot);

  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

// ══════════════════════════════════════════
// 주 활동 지역 지정
// ══════════════════════════════════════════

export async function setPrimaryRegion(slot: RegionSlot): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  // 다른 슬롯부터 해제 → 유니크 부분 인덱스 충돌 방지
  await supabase
    .from("user_activity_regions")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .neq("slot", slot);

  const { error } = await supabase
    .from("user_activity_regions")
    .update({ is_primary: true })
    .eq("user_id", user.id)
    .eq("slot", slot);

  if (error) throw new Error(`주 활동 지역 지정 실패: ${error.message}`);
}
