"use client";

// 홈 — 내 고양이 오늘 돌봄 리스트 (2026-07-10 홈 개편 → 2026-09-16 「익숙한 동네앱」 리디자인)
// 홈 최상단에서 "내 아이들"이 가장 먼저 보이게. 원형 사진 + 오늘 밥 상태 + 1탭 밥주기.
// 데이터 로직은 MyCatsQuickCare와 동일(내 고양이 + 오늘 care_logs). UI는 당근·토스 구분선 리스트
// (행 64px, 좌 원형 썸네일·중앙 2줄·우 버튼) — 대형 사진 카드·그라디언트는 폐기.
// 고양이 0마리면 null — 신규 유저는 FirstCheerCard/OnboardingCard가 담당.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog, type CareType } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { catArtWalkSvg } from "@/lib/cat-art";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { kstTodayStartIso } from "@/lib/kst";
import { prioritizePendingFeed, countPendingFeed } from "@/lib/care-inbox";

interface CatRow {
  id: string;
  name: string;
  photo_url: string | null;
  doneTypes: CareType[]; // 오늘 내가 기록한 돌봄 유형
  busy: boolean;
}

// 홈에서 1탭으로 기록 가능한 퀵 돌봄 (메모/사진 필요한 유형은 상세 페이지에서)
// emoji 필드는 데이터 계약상 유지, 화면에는 그리지 않는다(리디자인 2026-09-16).
const QUICK_CARE: { type: CareType; emoji: string; label: string }[] = [
  { type: "water", emoji: "💧", label: "물 줌" },
  { type: "treat", emoji: "🍗", label: "간식 줌" },
  { type: "health", emoji: "🩺", label: "건강 체크" },
  { type: "shelter", emoji: "🏠", label: "쉼터 관리" },
];

interface MyCatsHeroProps {
  careInboxMode?: boolean;
}

export default function MyCatsHero({ careInboxMode = false }: MyCatsHeroProps) {
  const router = useRouter();
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [moreOpen, setMoreOpen] = useState<string | null>(null); // 퀵 돌봄 펼침 열린 고양이 id

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
        // 고양이별로 보낸 아이 제외 (2026-08-09). 이게 없으면 떠난 아이가
        // "오늘의 돌봄"에 남아 매일 아침 "밥주기" 버튼을 내민다.
        .is("memorial_at", null)
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
      setCats(rows.map((c) => ({
        ...c,
        doneTypes: Array.from(doneMap.get(c.id) ?? []),
        busy: false,
      })));
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
  const pendingCount = countPendingFeed(cats);
  const displayedCats = careInboxMode
    ? prioritizePendingFeed(cats)
    : cats;

  return (
    <div className="mb-5">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-bold text-text-main">
            {careInboxMode && pendingCount > 0 ? "오늘의 돌봄" : "내 아이들"}
          </h2>
          <span className="text-[13px] text-text-light tabular-nums">
            {careInboxMode && pendingCount > 0
              ? `아직 ${pendingCount}마리`
              : `${doneCount}/${cats.length} 오늘 밥`}
          </span>
        </div>
        <Link href="/mypage" className="flex items-center gap-0.5 text-[13px] font-medium text-text-light">
          전체보기 <ChevronRight size={13} />
        </Link>
      </div>

      {/* 구분선 리스트 */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        {displayedCats.map((cat, idx) => {
          const photo = cat.photo_url
            ? sanitizeImageUrl(thumbnailUrl(cat.photo_url, 160) ?? cat.photo_url, "")
            : "";
          const fedToday = cat.doneTypes.includes("feed");
          const open = moreOpen === cat.id;
          return (
            <div key={cat.id} style={{ borderTop: idx > 0 ? "1px solid var(--color-divider)" : "none" }}>
              <div className="flex items-center gap-3 px-4" style={{ minHeight: 64 }}>
                {/* 원형 썸네일 (탭 → 상세) */}
                <button
                  type="button"
                  className="relative shrink-0 w-12 h-12 rounded-full overflow-hidden press-strong"
                  style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
                  onClick={() => router.push(`/cats/${cat.id}`)}
                  aria-label={`${cat.name} 상세 보기`}
                >
                  {photo ? (
                    <Image src={photo} alt={cat.name} fill className="object-cover" sizes="48px" />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: catArtWalkSvg(cat.id, 36, { walking: false }) }}
                    />
                  )}
                </button>

                {/* 이름 + 오늘 상태 */}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left py-3"
                  onClick={() => router.push(`/cats/${cat.id}`)}
                >
                  <p className="text-[15px] font-semibold text-text-main truncate leading-snug">{cat.name}</p>
                  <p
                    className="text-[13px] mt-0.5 leading-snug"
                    style={{ color: fedToday ? "var(--color-sage)" : "var(--color-text-sub)" }}
                  >
                    {fedToday ? "오늘 밥 완료" : "아직 밥 전"}
                  </p>
                </button>

                {/* 밥주기 + 더보기 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!fedToday && !cat.busy) logCare(cat.id, "feed"); }}
                    disabled={fedToday || cat.busy}
                    className="h-8 px-3 text-[13px] font-semibold flex items-center justify-center gap-1 press-strong transition-transform disabled:opacity-100"
                    style={{
                      borderRadius: "var(--radius-input)",
                      background: fedToday ? "var(--color-surface-alt)" : "var(--color-primary)",
                      color: fedToday ? "var(--color-text-light)" : "var(--color-surface)",
                    }}
                  >
                    {cat.busy ? (
                      "기록 중…"
                    ) : fedToday ? (
                      <><Check size={13} strokeWidth={3} /> 완료</>
                    ) : (
                      <>밥주기</>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMoreOpen(open ? null : cat.id); }}
                    aria-label={`${cat.name} 다른 돌봄 기록`}
                    aria-expanded={open}
                    className="w-8 h-8 rounded-full flex items-center justify-center press-strong transition-transform"
                    style={{ background: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}
                  >
                    {open ? <X size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>

              {/* 퀵 돌봄 펼침 (물/간식/건강/쉼터) */}
              {open && (
                <div className="px-4 pb-3">
                  <p className="text-[11px] text-text-light mb-1.5">다른 돌봄 기록</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_CARE.map((q) => {
                      const done = cat.doneTypes.includes(q.type);
                      return (
                        <button
                          key={q.type}
                          onClick={() => { if (!cat.busy) logCare(cat.id, q.type); }}
                          disabled={cat.busy}
                          className="h-8 text-[13px] font-medium flex items-center justify-center gap-1 press-strong transition-transform"
                          style={{
                            borderRadius: "var(--radius-input)",
                            background: done ? "var(--color-sage-soft)" : "var(--color-surface)",
                            color: done ? "var(--color-sage)" : "var(--color-text-main)",
                            border: `1px solid ${done ? "transparent" : "var(--color-border)"}`,
                          }}
                        >
                          {q.label}{done && <Check size={11} strokeWidth={3} />}
                        </button>
                      );
                    })}
                  </div>
                  <Link
                    href={`/cats/${cat.id}`}
                    className="mt-2 inline-flex items-center gap-0.5 text-[13px] font-medium"
                    style={{ color: "var(--color-primary)" }}
                  >
                    메모·사진과 함께 기록 <ChevronRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          );
        })}

        {/* + 새 친구 등록 행 */}
        <Link
          href="/map"
          className="flex items-center gap-3 px-4 press transition-transform"
          style={{ minHeight: 56, borderTop: "1px solid var(--color-divider)" }}
        >
          <span
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-surface-alt)", color: "var(--color-primary)" }}
          >
            <Plus size={18} strokeWidth={2.5} />
          </span>
          <span className="flex-1 text-[15px] font-semibold" style={{ color: "var(--color-primary)" }}>
            새 친구 등록
          </span>
          <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
        </Link>
      </div>
    </div>
  );
}
