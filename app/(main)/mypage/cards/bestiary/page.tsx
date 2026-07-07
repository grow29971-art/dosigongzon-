"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookMarked, Share2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { PVE_BESTIARY, PVE_BOSS, bestiaryPhotoUrl, type BestiaryEntry } from "@/lib/pve-bestiary";

export default function BestiaryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [seenKeys, setSeenKeys] = useState<string[]>([]);
  const [defeatedKeys, setDefeatedKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<BestiaryEntry | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    createClient()
      .from("profiles").select("pve_seen_keys,pve_defeated_keys").eq("id", user.id).maybeSingle()
      .then((res: { data: unknown }) => {
        const row = res.data as { pve_seen_keys?: string[]; pve_defeated_keys?: string[] } | null;
        setSeenKeys(row?.pve_seen_keys ?? []);
        setDefeatedKeys(row?.pve_defeated_keys ?? []);
        setLoading(false);
      });
  }, [user, authLoading, router]);

  const all = [...PVE_BESTIARY, PVE_BOSS];
  const seenCount = all.filter(e => seenKeys.includes(e.key)).length;
  const defeatedCount = all.filter(e => defeatedKeys.includes(e.key)).length;
  const pct = Math.round((seenCount / all.length) * 100);

  const share = () => {
    const text = `동네 도감 ${seenCount}/${all.length}마리 발견! 🐾 도시공존에서 PVE 배틀하면서 동네 불청객 도감 채우는 중이에요.`;
    router.push(`/community/write?t=${encodeURIComponent(text.slice(0, 50))}&content=${encodeURIComponent(text)}`);
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><BookMarked size={18} /> 동네 도감</h1>
        {seenCount > 0 && (
          <button onClick={share} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{ background: "rgba(255,255,255,0.08)", color: "#B4AFC2" }}>
            <Share2 size={12} /> 자랑하기
          </button>
        )}
      </div>

      <div className="px-4 pb-10">
        {/* 진행률 요약 */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-end justify-between mb-2">
            <span className="text-white text-[24px] font-black">{seenCount}<span className="text-[14px] font-bold text-gray-500">/{all.length}</span></span>
            <span className="text-[11px] font-bold text-gray-500">이겨본 개체 {defeatedCount}마리</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#5C8DEE,#8B6FE0)", transition: "width 0.4s ease" }} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-500" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {all.map((entry) => {
              const seen = seenKeys.includes(entry.key);
              const defeated = defeatedKeys.includes(entry.key);
              const photo = bestiaryPhotoUrl(entry);
              return (
                <button
                  key={entry.key}
                  onClick={() => seen && setSelected(entry)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.05)", cursor: seen ? "pointer" : "default" }}
                >
                  <div
                    className="relative rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      width: 56, height: 56,
                      background: seen ? "#1A1A2A" : "rgba(255,255,255,0.06)",
                      boxShadow: seen ? `0 0 0 2px ${defeated ? "#FFC15E" : "#5C8DEE"}` : "none",
                    }}
                  >
                    {seen && photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={entry.name} className="w-full h-full object-cover" loading="lazy" decoding="async"
                        style={{ filter: defeated ? undefined : "grayscale(0.4) brightness(0.85)" }} />
                    ) : (
                      <span style={{ fontSize: 22, opacity: 0.3 }}>❔</span>
                    )}
                  </div>
                  <span className="text-[10.5px] font-bold" style={{ color: seen ? "#E5E3EE" : "#565266" }}>
                    {seen ? entry.name : "???"}
                  </span>
                  {seen && (
                    <span className="text-[8.5px] font-bold" style={{ color: defeated ? "#FFC15E" : "#6B6578" }}>
                      {defeated ? "승리" : "조우"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: "#1A1A2A" }}>
            {bestiaryPhotoUrl(selected) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bestiaryPhotoUrl(selected)!} alt={selected.name} className="w-full aspect-square object-cover" />
            )}
            <div className="p-5 text-center">
              <p className="text-white text-[20px] font-black mb-1">{selected.emoji} {selected.name}</p>
              <p className="text-[12px] font-bold" style={{ color: defeatedKeys.includes(selected.key) ? "#FFC15E" : "#8A8598" }}>
                {defeatedKeys.includes(selected.key) ? "🏆 승리한 적 있어요" : "👀 조우했지만 아직 못 이겼어요"}
              </p>
              <button onClick={() => setSelected(null)} className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#5C8DEE,#8B6FE0)" }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
