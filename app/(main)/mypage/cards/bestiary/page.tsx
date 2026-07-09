"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookMarked, Share2, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { PVE_BESTIARY, PVE_BOSS, bestiaryPhotoUrl, dexNoLabel, type BestiaryEntry } from "@/lib/pve-bestiary";
import StickerIcon from "@/app/components/StickerIcon";
import { UI, progressTrackStyle, progressFillStyle, pageBgStyle } from "@/lib/battle-ui-theme";

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

  const all = [...PVE_BESTIARY, PVE_BOSS].sort((a, b) => a.dexNo - b.dexNo);
  const seenCount = all.filter(e => seenKeys.includes(e.key)).length;
  const defeatedCount = all.filter(e => defeatedKeys.includes(e.key)).length;
  const pct = Math.round((seenCount / all.length) * 100);

  const share = () => {
    const text = `동네 도감 ${seenCount}/${all.length}마리 발견! 🐾 도시공존에서 PVE 배틀하면서 동네 불청객 도감 채우는 중이에요.`;
    router.push(`/community/write?t=${encodeURIComponent(text.slice(0, 50))}&content=${encodeURIComponent(text)}`);
  };

  const selectedSeen = selected ? seenKeys.includes(selected.key) : false;
  const selectedDefeated = selected ? defeatedKeys.includes(selected.key) : false;

  return (
    <div className="min-h-dvh" style={pageBgStyle()}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "linear-gradient(180deg, #14141C 0%, rgba(20,20,28,0) 100%)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><StickerIcon icon={BookMarked} color={UI.accent.green} size={30} /> 동네 도감</h1>
        {seenCount > 0 && (
          <button onClick={share} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{ background: "rgba(255,255,255,0.08)", color: UI.textSub }}>
            <Share2 size={12} /> 자랑하기
          </button>
        )}
      </div>

      <div className="px-4 pb-10">
        {/* 진행률 요약 */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
          <div className="flex items-end justify-between mb-2">
            <span className="text-white text-[24px] font-black">{seenCount}<span className="text-[14px] font-bold" style={{ color: UI.textMuted }}>/{all.length}</span></span>
            <span className="text-[11px] font-bold" style={{ color: UI.textMuted }}>이겨본 개체 {defeatedCount}마리</span>
          </div>
          <div style={progressTrackStyle()}>
            <div style={progressFillStyle(UI.accent.pink, pct)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: UI.textMuted }} /></div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {all.map((entry) => {
              const seen = seenKeys.includes(entry.key);
              const defeated = defeatedKeys.includes(entry.key);
              const photo = bestiaryPhotoUrl(entry);
              const ringColor = defeated ? entry.categoryColor : seen ? "#565266" : "transparent";
              return (
                <button
                  key={entry.key}
                  onClick={() => seen && setSelected(entry)}
                  className="relative flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}`, cursor: seen ? "pointer" : "default" }}
                >
                  <span className="absolute top-1.5 left-2 text-[8.5px] font-black tabular-nums" style={{ color: UI.textMuted }}>
                    {dexNoLabel(entry.dexNo)}
                  </span>
                  <div
                    className="relative rounded-full overflow-hidden flex items-center justify-center mt-2.5"
                    style={{
                      width: 56, height: 56,
                      background: seen ? UI.panelAlt : "rgba(255,255,255,0.06)",
                      boxShadow: `0 0 0 2px ${ringColor}`,
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
                  <span className="text-[10.5px] font-bold" style={{ color: seen ? UI.textMain : UI.textMuted }}>
                    {seen ? entry.name : "???"}
                  </span>
                  {seen && (
                    <span className="flex items-center gap-0.5 text-[8.5px] font-bold" style={{ color: defeated ? entry.categoryColor : UI.textSub }}>
                      {!defeated && <Lock size={8} />}
                      {defeated ? "승리" : "조우"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 모달 — 포켓몬 도감 스타일 */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: UI.panelAlt, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
            <div className="relative">
              {bestiaryPhotoUrl(selected) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bestiaryPhotoUrl(selected)!} alt={selected.name} className="w-full aspect-square object-cover"
                  style={{ filter: selectedDefeated ? undefined : "grayscale(0.35) brightness(0.8)" }} />
              )}
              <span className="absolute top-3 left-3 px-2 py-1 rounded-lg text-[11px] font-black tabular-nums text-white"
                style={{ background: "rgba(0,0,0,0.5)" }}>
                {dexNoLabel(selected.dexNo)}
              </span>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white text-[20px] font-black">{selected.emoji} {selected.name}</p>
              </div>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10.5px] font-extrabold text-white mb-3"
                style={{ background: selected.categoryColor }}>
                {selected.category}
              </span>

              {selectedDefeated ? (
                <>
                  <div className="flex gap-1.5 mb-3">
                    {selected.traits.map((t) => (
                      <span key={t} className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: UI.textSub }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold mb-1.5" style={{ color: selected.categoryColor }}>
                    성격 · {selected.personality}
                  </p>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: UI.textSub }}>
                    {selected.story}
                  </p>
                  <p className="text-[11px] font-bold mt-3" style={{ color: UI.accent.gold }}>🏆 승리한 적 있어요</p>
                </>
              ) : (
                <>
                  <div className="rounded-2xl px-4 py-5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <Lock size={20} className="mx-auto mb-2" style={{ color: UI.textMuted }} />
                    <p className="text-[13px] font-black tracking-widest" style={{ color: UI.textMuted }}>????</p>
                    <p className="text-[11px] mt-1.5" style={{ color: UI.textSub }}>
                      이 녀석을 배틀에서 이기면<br />성격·특징·이야기가 공개돼요
                    </p>
                  </div>
                  <p className="text-[11px] font-bold mt-3" style={{ color: UI.textSub }}>👀 조우했지만 아직 못 이겼어요</p>
                </>
              )}

              <button onClick={() => setSelected(null)} className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-extrabold"
                style={{ background: `${UI.accent.pink}1F`, color: UI.accent.pink, boxShadow: `inset 0 0 0 1px ${UI.accent.pink}` }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
