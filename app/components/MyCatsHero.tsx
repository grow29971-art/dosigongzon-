"use client";

// 홈 히어로 — 내 고양이 대형 스와이프 카드 (2026-07-10 홈 개편)
// 홈 최상단에서 "내 아이들"이 가장 먼저 보이게. 사진 크게 + 오늘 밥 상태 + 1탭 밥주기.
// 데이터 로직은 MyCatsQuickCare와 동일(내 고양이 + 오늘 care_logs), UI만 히어로 카드.
// 고양이 0마리면 null — 신규 유저는 FirstCheerCard/OnboardingCard가 담당.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, PawPrint, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

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

export default function MyCatsHero() {
  const router = useRouter();
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
        .limit(10);
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
    <div className="mb-5">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-text-main tracking-tight">내 고양이</h2>
          <span
            className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(49,130,246,0.1)", color: "#3182F6" }}
          >
            {doneCount}/{cats.length} 오늘 밥
          </span>
        </div>
        <Link href="/mypage" className="flex items-center gap-0.5 text-[12px] font-bold text-text-light">
          전체보기 <ChevronRight size={13} />
        </Link>
      </div>

      {/* 가로 스와이프 카드 */}
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {cats.map((cat) => {
          const photo = cat.photo_url
            ? sanitizeImageUrl(thumbnailUrl(cat.photo_url, 480) ?? cat.photo_url, "")
            : "";
          return (
            <div
              key={cat.id}
              className="relative shrink-0 overflow-hidden active:scale-[0.98] transition-transform"
              style={{
                width: 168,
                aspectRatio: "3 / 4",
                borderRadius: 22,
                scrollSnapAlign: "start",
                background: "#F2F4F6",
                boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
              }}
            >
              {/* 사진 (탭 → 상세) */}
              <button
                className="absolute inset-0 w-full h-full text-left"
                onClick={() => router.push(`/cats/${cat.id}`)}
                aria-label={`${cat.name} 상세 보기`}
              >
                {photo ? (
                  <Image src={photo} alt={cat.name} fill className="object-cover" sizes="168px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PawPrint size={44} style={{ color: "rgba(49,130,246,0.25)" }} />
                  </div>
                )}
                {/* 하단 그라디언트 */}
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{ height: "55%", background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)" }}
                />
              </button>

              {/* 오늘 상태 칩 */}
              <span
                className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full text-[9.5px] font-extrabold pointer-events-none"
                style={{
                  background: cat.fedToday ? "rgba(34,163,102,0.92)" : "rgba(255,255,255,0.92)",
                  color: cat.fedToday ? "#fff" : "#4E5968",
                }}
              >
                {cat.fedToday ? <>✓ 오늘 밥</> : <>🍚 아직 전</>}
              </span>

              {/* 이름 + 밥주기 버튼 */}
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">
                <p className="text-[15.5px] font-extrabold text-white drop-shadow tracking-tight mb-2 truncate">
                  {cat.name}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); if (!cat.fedToday && !cat.busy) feed(cat.id); }}
                  disabled={cat.fedToday || cat.busy}
                  className="w-full py-2 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-transform pointer-events-auto"
                  style={{
                    background: cat.fedToday ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.95)",
                    color: cat.fedToday ? "#fff" : "#191F28",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {cat.busy ? (
                    "기록 중…"
                  ) : cat.fedToday ? (
                    <><Check size={13} strokeWidth={3} /> 완료</>
                  ) : (
                    <>🍚 밥주기</>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* + 새 친구 등록 카드 */}
        <Link
          href="/map"
          className="shrink-0 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{
            width: 130,
            aspectRatio: "3 / 4.13",
            borderRadius: 22,
            scrollSnapAlign: "start",
            background: "#FFFFFF",
            border: "1.5px dashed rgba(49,130,246,0.35)",
          }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "rgba(49,130,246,0.1)" }}
          >
            <Plus size={20} style={{ color: "#3182F6" }} strokeWidth={2.5} />
          </div>
          <span className="text-[11.5px] font-extrabold" style={{ color: "#3182F6" }}>
            새 친구 등록
          </span>
        </Link>
      </div>
    </div>
  );
}
