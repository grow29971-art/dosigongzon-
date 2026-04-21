import { createClient } from "@/lib/supabase/client";

export interface CatLocationHistoryRow {
  id: string;
  cat_id: string;
  cat_name: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  old_region: string | null;
  new_region: string | null;
  distance_m: number | null;
  created_at: string;
}

export async function listRecentLocationChanges(
  limit: number = 100,
): Promise<CatLocationHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_recent_cat_location_changes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`이력 조회 실패: ${error.message}`);
  return (data ?? []) as CatLocationHistoryRow[];
}

export async function listCatLocationHistory(
  catId: string,
): Promise<CatLocationHistoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cat_location_history")
    .select(
      "id, cat_id, changed_by, changed_by_name, old_region, new_region, distance_m, created_at",
    )
    .eq("cat_id", catId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`이력 조회 실패: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    cat_name: null,
  })) as CatLocationHistoryRow[];
}
