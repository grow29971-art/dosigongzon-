// ══════════════════════════════════════════
// 도시공존 — 구조동물 치료 도움병원 Repository
// Supabase public.rescue_hospitals
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export interface RescueHospital {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  note: string | null;
  tags: string[];
  pinned: boolean;
  lat: number | null;
  lng: number | null;
  source: string;
  kakao_place_id: string | null;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export type RescueHospitalInput = Omit<
  RescueHospital,
  "id" | "created_at" | "updated_at" | "source" | "kakao_place_id" | "hidden"
> & {
  lat?: number | null;
  lng?: number | null;
};

// ── 읽기 (전체 로드 — Supabase 기본 1000행 제한 우회) ──
export async function listRescueHospitals(): Promise<RescueHospital[]> {
  const supabase = createClient();
  const all: RescueHospital[] = [];
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("rescue_hospitals")
      .select("*")
      .eq("hidden", false)
      .order("pinned", { ascending: false })
      .order("city", { ascending: true })
      .order("district", { ascending: true })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[hospitals-repo] listRescueHospitals failed:", error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as RescueHospital[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

// ── admin CRUD ──
export async function createRescueHospital(
  input: RescueHospitalInput,
): Promise<RescueHospital> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rescue_hospitals")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[hospitals-repo] createRescueHospital failed:", error);
    throw new Error(`병원 추가 실패: ${error.message}`);
  }
  return data as RescueHospital;
}

export async function updateRescueHospital(
  id: string,
  input: Partial<RescueHospitalInput>,
): Promise<RescueHospital> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rescue_hospitals")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[hospitals-repo] updateRescueHospital failed:", error);
    throw new Error(`병원 수정 실패: ${error.message}`);
  }
  return data as RescueHospital;
}

export async function deleteRescueHospital(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("rescue_hospitals")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[hospitals-repo] deleteRescueHospital failed:", error);
    throw new Error(`병원 삭제 실패: ${error.message}`);
  }
}

// ── 그루핑 유틸: 시별 → 군별 → 병원 목록 ──
export interface HospitalGroup {
  city: string;
  districts: {
    district: string;
    hospitals: RescueHospital[];
  }[];
}

export function groupByCityDistrict(
  hospitals: RescueHospital[],
): HospitalGroup[] {
  const cityMap = new Map<string, Map<string, RescueHospital[]>>();

  for (const h of hospitals) {
    if (!cityMap.has(h.city)) {
      cityMap.set(h.city, new Map());
    }
    const districtMap = cityMap.get(h.city)!;
    if (!districtMap.has(h.district)) {
      districtMap.set(h.district, []);
    }
    districtMap.get(h.district)!.push(h);
  }

  return Array.from(cityMap.entries()).map(([city, districtMap]) => ({
    city,
    districts: Array.from(districtMap.entries()).map(([district, hospitals]) => ({
      district,
      hospitals,
    })),
  }));
}
