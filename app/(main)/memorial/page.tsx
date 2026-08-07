"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Flower2, Undo2 } from "lucide-react";
import {
  listMemorialCats,
  listMyFlowerCatIds,
  toggleMemorialFlower,
  restoreCatFromStar,
  type MemorialCat,
} from "@/lib/cats-repo";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

// 배경 별 — id 없이 페이지 고정 시드
function makeStars(count: number) {
  let h = 917503;
  const next = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, () => ({
    left: next() * 100,
    top: next() * 100,
    size: 1 + next() * 2,
    delay: next() * 4,
    opacity: 0.2 + next() * 0.55,
  }));
}

function daysBetween(from: string, to: string) {
  const d = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  return Math.max(d, 0);
}

export default function MemorialPage() {
  const toast = useToast();
  const [cats, setCats] = useState<MemorialCat[] | null>(null);
  const [flowered, setFlowered] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const stars = useMemo(() => makeStars(70), []);

  const load = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([listMemorialCats(), listMyFlowerCatIds()]);
      setCats(list);
      setFlowered(mine);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "고양이별을 불러오지 못했어요");
      setCats([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void (async () => {
      const { data } = await createClient().auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, [load]);

  const handleFlower = async (catId: string) => {
    // 낙관적 갱신 — 실패하면 되돌린다
    const was = flowered.has(catId);
    setFlowered((prev) => {
      const n = new Set(prev);
      if (was) n.delete(catId); else n.add(catId);
      return n;
    });
    setCats((prev) =>
      prev?.map((c) => (c.id === catId ? { ...c, flower_count: c.flower_count + (was ? -1 : 1) } : c)) ?? prev,
    );
    try {
      await toggleMemorialFlower(catId);
    } catch (err) {
      setFlowered((prev) => {
        const n = new Set(prev);
        if (was) n.add(catId); else n.delete(catId);
        return n;
      });
      setCats((prev) =>
        prev?.map((c) => (c.id === catId ? { ...c, flower_count: c.flower_count + (was ? 1 : -1) } : c)) ?? prev,
      );
      toast.error(err instanceof Error ? err.message : "헌화하지 못했어요");
    }
  };

  const handleRestore = async (cat: MemorialCat) => {
    if (!confirm(`${cat.name}(이)를 다시 지도로 되돌릴까요?`)) return;
    try {
      await restoreCatFromStar(cat.id);
      setCats((prev) => prev?.filter((c) => c.id !== cat.id) ?? prev);
      toast.success(`${cat.name}(이)가 지도로 돌아왔어요`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "되돌리지 못했어요");
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{ background: "linear-gradient(180deg, #0d0b18 0%, #241d3a 40%, #3a2c4d 100%)" }}
    >
      {/* 밤하늘 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              background: "#fff",
              opacity: s.opacity,
              animation: `memStarTwinkle 3.6s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative px-5 pb-28" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        {/* 헤더 */}
        <div className="flex items-center gap-2 py-3">
          <Link
            href="/map"
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="뒤로"
          >
            <ChevronLeft size={20} color="#fff" />
          </Link>
        </div>

        <div className="text-center pt-6 pb-10">
          <div className="inline-flex" style={{ animation: "memGlow 3s ease-in-out infinite" }}>
            <Star size={34} color="#FFE9A8" fill="#FFE9A8" />
          </div>
          <h1 className="text-[24px] font-bold text-white mt-4">고양이별</h1>
          <p className="text-[14px] leading-[1.7] mt-3" style={{ color: "rgba(255,255,255,0.62)" }}>
            먼저 떠난 아이들이 머무는 곳이에요.
            <br />
            이름과 돌본 기록은 지워지지 않아요.
          </p>
        </div>

        {/* 목록 */}
        {cats === null && (
          <p className="text-center text-[14px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            불러오는 중…
          </p>
        )}

        {cats?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[15px] leading-[1.8]" style={{ color: "rgba(255,255,255,0.55)" }}>
              아직 고양이별에 온 아이가 없어요.
              <br />
              모두 잘 지내고 있다는 뜻이에요.
            </p>
            <Link
              href="/map"
              className="inline-flex items-center justify-center h-[46px] px-6 rounded-2xl mt-7 text-[14px] font-bold"
              style={{ background: "rgba(255,255,255,0.92)", color: "#3a2c4d" }}
            >
              지도로 돌아가기
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {cats?.map((cat) => {
            const cared = daysBetween(cat.created_at, cat.memorial_at);
            const mine = userId && cat.caretaker_id === userId;
            return (
              <div
                key={cat.id}
                className="p-5"
                style={{
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="flex items-start gap-4">
                  <Link href={`/cats/${cat.id}`} className="shrink-0">
                    <div
                      className="rounded-full overflow-hidden"
                      style={{
                        width: 72,
                        height: 72,
                        border: "2px solid rgba(255,233,168,0.5)",
                        boxShadow: "0 0 22px rgba(255,233,168,0.28)",
                        background: "#2a2340",
                      }}
                    >
                      {cat.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[28px]">🐈</div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link href={`/cats/${cat.id}`}>
                      <h2 className="text-[17px] font-bold text-white truncate">{cat.name}</h2>
                    </Link>
                    <p className="text-[12.5px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {cat.region ?? "지역 미상"} · 함께한 {cared}일
                      {cat.care_log_count > 0 && ` · 돌봄 기록 ${cat.care_log_count}개`}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.34)" }}>
                      {new Date(cat.memorial_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      에 고양이별로
                    </p>
                  </div>
                </div>

                {cat.memorial_note && (
                  <p
                    className="text-[13.5px] leading-[1.7] mt-4 px-4 py-3 whitespace-pre-wrap"
                    style={{
                      color: "rgba(255,255,255,0.78)",
                      background: "rgba(0,0,0,0.18)",
                      borderRadius: 14,
                    }}
                  >
                    {cat.memorial_note}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => handleFlower(cat.id)}
                    className="flex-1 h-[42px] rounded-xl flex items-center justify-center gap-1.5 text-[13.5px] font-semibold active:scale-[0.97] transition-transform"
                    style={{
                      background: flowered.has(cat.id) ? "rgba(255,233,168,0.92)" : "rgba(255,255,255,0.1)",
                      color: flowered.has(cat.id) ? "#3a2c4d" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    <Flower2 size={15} />
                    {flowered.has(cat.id) ? "헌화했어요" : "헌화하기"}
                    {cat.flower_count > 0 && ` ${cat.flower_count}`}
                  </button>

                  {mine && (
                    <button
                      onClick={() => handleRestore(cat)}
                      className="h-[42px] px-4 rounded-xl flex items-center gap-1.5 text-[13px] active:scale-[0.97] transition-transform"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
                      title="다시 지도로"
                    >
                      <Undo2 size={14} />
                      되돌리기
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes memStarTwinkle {
          0%, 100% { opacity: 0.18; }
          50%      { opacity: 1; }
        }
        @keyframes memGlow {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 8px rgba(255,233,168,0.55)); }
          50%      { transform: scale(1.1);  filter: drop-shadow(0 0 22px rgba(255,233,168,0.9)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="memStarTwinkle"], [style*="memGlow"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
