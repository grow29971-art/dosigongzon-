"use client";

// 내 아이 오늘 한 끼 — 1탭 돌봄 로깅. (HomeAuthed, catCount>0 유저)
// 핵심 루프(돌봄 기록) 마찰 직격: 지도→고양이→탭→입력→저장(5+단계) → 홈에서 1탭.
// 오늘 이미 줬으면 ✓ 잠금(이중 기록 방지). 더 자세히는 지도/고양이 상세에서.
// 데이터: 내 고양이 fetch + 오늘 내 care_logs fetch, 마운트 1회.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";

interface CatRow {
  id: string;
  name: string;
  photo_url: string | null;
  fedToday: boolean;
  busy: boolean;
}

// KST 오늘 00:00 → UTC ISO (logged_at 비교용)
function kstTodayStartIso(): string {
  const kstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstDate + "T00:00:00+09:00").toISOString();
}

export default function MyCatsQuickCare() {
  const [cats, setCats] = useState<CatRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: myCats } = await sb
        .from("cats")
        .select("id, name, photo_url")
        .eq("caretaker_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (!myCats || myCats.length === 0) {
        if (!cancelled) setCats([]);
        return;
      }
      const rows = myCats as { id: string; name: string; photo_url: string | null }[];
      const ids = rows.map((c) => c.id);
      const { data: logs } = await sb
        .from("care_logs")
        .select("cat_id")
        .eq("author_id", user.id)
        .in("cat_id", ids)
        .gte("logged_at", kstTodayStartIso());
      const fedSet = new Set((logs ?? []).map((r: { cat_id: string }) => r.cat_id));
      if (cancelled) return;
      setCats(rows.map((c) => ({ ...c, fedToday: fedSet.has(c.id), busy: false })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const feed = async (id: string) => {
    setCats((prev) => prev?.map((c) => (c.id === id ? { ...c, busy: true } : c)) ?? null);
    try {
      await createCareLog({ cat_id: id, care_type: "feed" });
      setCats((prev) => prev?.map((c) => (c.id === id ? { ...c, fedToday: true, busy: false } : c)) ?? null);
      try { navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
    } catch {
      setCats((prev) => prev?.map((c) => (c.id === id ? { ...c, busy: false } : c)) ?? null);
    }
  };

  if (!cats || cats.length === 0) return null;
  const doneCount = cats.filter((c) => c.fedToday).length;

  return (
    <div
      className="mb-3 p-4"
      style={{
        background: "linear-gradient(135deg, #FFF6E8 0%, #FCE9CC 100%)",
        borderRadius: 18,
        border: "1px solid rgba(232,141,90,0.25)",
        boxShadow: "0 4px 14px rgba(232,141,90,0.1)",
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: "#A8684A" }}>내 아이 오늘 한 끼</p>
          <p className="text-[12px] text-text-sub mt-0.5">탭 한 번이면 끝 — 메모·사진 없이도 OK</p>
        </div>
        <p className="text-[11.5px] font-extrabold shrink-0" style={{ color: "#A8684A" }}>
          <span style={{ color: doneCount === cats.length ? "#6B8E6F" : "#E88D5A" }}>{doneCount}</span>/{cats.length}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {cats.map((c) => {
          const thumb = thumbnailUrl(c.photo_url, 96);
          return (
            <div key={c.id} className="shrink-0 w-[80px] flex flex-col items-center">
              <Link href={`/cats/${c.id}`} className="block">
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{
                    background: "#F4E6CE",
                    border: c.fedToday ? "2px solid #6B8E6F" : "2px solid rgba(92,141,238,0.3)",
                  }}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">🐱</span>
                  )}
                </div>
              </Link>
              <p className="text-[10.5px] font-bold text-center mt-1 truncate w-full" style={{ color: "#2A2A28" }}>
                {c.name}
              </p>
              <button
                type="button"
                onClick={() => feed(c.id)}
                disabled={c.fedToday || c.busy}
                className="mt-1 h-7 px-2.5 rounded-full flex items-center justify-center gap-0.5 active:scale-90 transition-transform"
                style={{
                  background: c.fedToday ? "#6B8E6F" : "#E88D5A",
                  color: "#fff",
                  opacity: c.busy ? 0.6 : 1,
                  cursor: c.fedToday ? "default" : "pointer",
                }}
                aria-label={c.fedToday ? `${c.name} 오늘 한 끼 완료` : `${c.name} 오늘 한 끼 기록`}
              >
                {c.fedToday ? (
                  <>
                    <Check size={11} strokeWidth={3} />
                    <span className="text-[10px] font-extrabold">완료</span>
                  </>
                ) : (
                  <span className="text-[11px] font-extrabold">🍚 한 끼</span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <Link
        href="/map"
        className="mt-2 flex items-center justify-center gap-1 text-[11px] font-bold py-1.5"
        style={{ color: "#A8684A" }}
      >
        더 자세히 기록(사진·메모·종류) <ChevronRight size={12} />
      </Link>
    </div>
  );
}
