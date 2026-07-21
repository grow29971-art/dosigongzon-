"use client";

// 홈 히어로 — 내 고양이 대형 스와이프 카드 (2026-07-10 홈 개편)
// 홈 최상단에서 "내 아이들"이 가장 먼저 보이게. 사진 크게 + 오늘 밥 상태 + 1탭 밥주기.
// 데이터 로직은 MyCatsQuickCare와 동일(내 고양이 + 오늘 care_logs), UI만 히어로 카드.
// 고양이 0마리면 null — 신규 유저는 FirstCheerCard/OnboardingCard가 담당.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, PawPrint, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog, type CareType } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { kstTodayStartIso } from "@/lib/kst";

interface CatRow {
  id: string;
  name: string;
  photo_url: string | null;
  doneTypes: CareType[]; // 오늘 내가 기록한 돌봄 유형
  busy: boolean;
}

// 홈에서 1탭으로 기록 가능한 퀵 돌봄 (메모/사진 필요한 유형은 상세 페이지에서)
const QUICK_CARE: { type: CareType; emoji: string; label: string }[] = [
  { type: "water", emoji: "💧", label: "물 줌" },
  { type: "treat", emoji: "🍗", label: "간식 줌" },
  { type: "health", emoji: "🩺", label: "건강 체크" },
  { type: "shelter", emoji: "🏠", label: "쉼터 관리" },
];

export default function MyCatsHero() {
  const router = useRouter();
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [moreOpen, setMoreOpen] = useState<string | null>(null); // 퀵 돌봄 오버레이 열린 고양이 id

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
        .select("cat_id, care_type")
        .eq("author_id", user.id)
        .in("cat_id", ids)
        .gte("logged_at", kstTodayStartIso());
      const doneMap = new Map<string, Set<CareType>>();
      for (const r of (logs ?? []) as { cat_id: string; care_type: CareType }[]) {
        if (!doneMap.has(r.cat_id)) doneMap.set(r.cat_id, new Set());
        doneMap.get(r.cat_id)!.add(r.care_type);
      }
      if (cancelled) return;
      setCats(rows.map((c) => ({ ...c, doneTypes: Array.from(doneMap.get(c.id) ?? []), busy: false })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logCare = async (id: string, type: CareType) => {
    setCats((prev) => prev?.map((c) => (c.id === id ? { ...c, busy: true } : c)) ?? null);
    try {
      await createCareLog({ cat_id: id, care_type: type });
      setCats((prev) =>
        prev?.map((c) =>
          c.id === id
            ? { ...c, doneTypes: c.doneTypes.includes(type) ? c.doneTypes : [...c.doneTypes, type], busy: false }
            : c,
        ) ?? null,
      );
      setMoreOpen(null);
      try { navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
    } catch {
      setCats((prev) => prev?.map((c) => (c.id === id ? { ...c, busy: false } : c)) ?? null);
    }
  };

  if (!cats || cats.length === 0) return null;
  const doneCount = cats.filter((c) => c.doneTypes.includes("feed")).length;

  return (
    <div className="mb-5">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-extrabold text-text-main tracking-tight">내 아이들</h2>
          <span
            className="text-[10.5px] font-extrabold px-2 py-0.5 chip-square"
            style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
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
          const fedToday = cat.doneTypes.includes("feed");
          return (
            <div
              key={cat.id}
              className="relative shrink-0 overflow-hidden active:scale-[0.98] transition-transform"
              style={{
                width: 168,
                aspectRatio: "3 / 4",
                borderRadius: 22,
                scrollSnapAlign: "start",
                background: "var(--color-surface-alt)",
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
                className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 chip-square text-[9.5px] font-extrabold pointer-events-none"
                style={{
                  background: fedToday ? "rgba(34,163,102,0.92)" : "rgba(255,255,255,0.92)",
                  color: fedToday ? "#fff" : "var(--color-text-sub)",
                }}
              >
                {fedToday ? <>✓ 오늘 밥</> : <>🍚 아직 전</>}
              </span>

              {/* 이름 + 밥주기/돌봄 버튼 */}
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pointer-events-none">
                <p className="text-[15.5px] font-extrabold text-white drop-shadow tracking-tight mb-2 truncate">
                  {cat.name}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!fedToday && !cat.busy) logCare(cat.id, "feed"); }}
                    disabled={fedToday || cat.busy}
                    className="flex-1 min-w-0 py-2 rounded-xl text-[12px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-transform pointer-events-auto"
                    style={{
                      background: fedToday ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.95)",
                      color: fedToday ? "#fff" : "var(--color-text-main)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    {cat.busy ? (
                      "기록 중…"
                    ) : fedToday ? (
                      <><Check size={13} strokeWidth={3} /> 완료</>
                    ) : (
                      <>🍚 밥주기</>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMoreOpen(moreOpen === cat.id ? null : cat.id); }}
                    aria-label={`${cat.name} 다른 돌봄 기록`}
                    className="shrink-0 w-[34px] rounded-xl flex items-center justify-center active:scale-95 transition-transform pointer-events-auto"
                    style={{ background: "rgba(255,255,255,0.28)", backdropFilter: "blur(4px)" }}
                  >
                    <Plus size={15} strokeWidth={3} className="text-white" />
                  </button>
                </div>
              </div>

              {/* 퀵 돌봄 오버레이 (물/간식/건강/쉼터) */}
              {moreOpen === cat.id && (
                <div
                  className="absolute inset-0 flex flex-col justify-end px-3 pb-3 pt-8"
                  style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(3px)", borderRadius: 22 }}
                >
                  <button
                    onClick={() => setMoreOpen(null)}
                    aria-label="닫기"
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.22)" }}
                  >
                    <X size={14} className="text-white" strokeWidth={3} />
                  </button>
                  <p className="text-[11px] font-extrabold text-white/85 mb-2 px-0.5">다른 돌봄 기록</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    {QUICK_CARE.map((q) => {
                      const done = cat.doneTypes.includes(q.type);
                      return (
                        <button
                          key={q.type}
                          onClick={() => { if (!cat.busy) logCare(cat.id, q.type); }}
                          disabled={cat.busy}
                          className="py-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                          style={{
                            background: done ? "rgba(34,163,102,0.35)" : "rgba(255,255,255,0.92)",
                            color: done ? "#fff" : "var(--color-text-main)",
                          }}
                        >
                          <span>{q.emoji}</span> {q.label}{done && <Check size={11} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                  <Link
                    href={`/cats/${cat.id}`}
                    className="py-1.5 rounded-xl text-[10.5px] font-bold text-white/80 text-center"
                    style={{ background: "rgba(255,255,255,0.14)" }}
                  >
                    메모·사진과 함께 기록 →
                  </Link>
                </div>
              )}
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
            style={{ background: "var(--color-primary-soft)" }}
          >
            <Plus size={20} style={{ color: "var(--color-primary)" }} strokeWidth={2.5} />
          </div>
          <span className="text-[11.5px] font-extrabold" style={{ color: "var(--color-primary)" }}>
            새 친구 등록
          </span>
        </Link>
      </div>
    </div>
  );
}
