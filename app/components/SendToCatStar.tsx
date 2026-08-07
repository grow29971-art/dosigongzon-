"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X } from "lucide-react";
import { sendCatToStar } from "@/lib/cats-repo";
import { useToast } from "@/app/components/Toast";

type Phase = "confirm" | "flying" | "done";

interface Props {
  cat: { id: string; name: string; photo_url: string | null };
  onClose: () => void;
  /** 전송이 끝났을 때 — 지도에서 마커를 빼는 등 부모 정리용 */
  onSent: () => void;
}

// 배경 별. Math.random 을 쓰면 리렌더마다 별이 튀므로 id 기반 결정적 배치.
function makeStars(seed: string, count: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, () => ({
    left: next() * 100,
    top: next() * 100,
    size: 1 + next() * 2.2,
    delay: next() * 3,
    opacity: 0.25 + next() * 0.6,
  }));
}

export default function SendToCatStar({ cat, onClose, onSent }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const stars = useMemo(() => makeStars(cat.id, 46), [cat.id]);

  // 애니메이션이 끝나면 마무리 화면으로. 모션 최소화 설정이면 곧바로 넘긴다.
  useEffect(() => {
    if (phase !== "flying") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("done"), reduced ? 400 : 3600);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSend = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sendCatToStar(cat.id, note);
      setPhase("flying");
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "고양이별로 보내지 못했어요");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{
        zIndex: 100,
        background:
          phase === "confirm"
            ? "rgba(20,16,30,0.62)"
            : "linear-gradient(180deg, #0d0b18 0%, #241d3a 45%, #3a2c4d 100%)",
        transition: "background 700ms ease",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="고양이별로 보내기"
    >
      {/* 밤하늘 — 전송 단계부터 */}
      {phase !== "confirm" && (
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
                animation: `starTwinkle 3.2s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── 1) 확인 ── */}
      {phase === "confirm" && (
        <div
          className="relative w-full bg-white overflow-hidden"
          style={{ maxWidth: 400, borderRadius: 26, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="닫기"
          >
            <X size={17} className="text-gray-500" />
          </button>

          <div className="px-6 pt-8 pb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #3a2c4d, #6b5b8a)" }}
            >
              <Star size={24} color="#FFE9A8" fill="#FFE9A8" />
            </div>

            <h2 className="text-[19px] font-bold text-gray-900 mb-2">
              {cat.name}(이)를 고양이별로 보낼까요?
            </h2>
            <p className="text-[14px] leading-[1.65] text-gray-600 mb-5">
              지도에서는 내려가지만 <b className="text-gray-800">사라지지 않아요.</b> 지금까지 남긴 돌봄
              기록과 사진, 카드는 그대로 고양이별에 보관되고 언제든 다시 볼 수 있어요.
            </p>

            <label className="block text-[13px] font-semibold text-gray-700 mb-2">
              마지막 인사 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="하고 싶은 말이 있다면 남겨주세요."
              className="w-full text-[14px] leading-[1.6] px-4 py-3 outline-none resize-none"
              style={{ borderRadius: 14, background: "#F6F3F0", border: "1px solid #E7E0DA" }}
            />
            <div className="text-right text-[11px] text-gray-400 mt-1 mb-5">{note.length}/200</div>

            <button
              onClick={handleSend}
              disabled={busy}
              className="w-full h-[52px] rounded-2xl text-white text-[15px] font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #3a2c4d, #6b5b8a)" }}
            >
              {busy ? "보내는 중…" : "고양이별로 보내기"}
            </button>
            <button
              onClick={onClose}
              className="w-full h-[46px] mt-2 text-[14px] font-medium text-gray-500"
            >
              아직 아니에요
            </button>
            <p className="text-[11.5px] text-gray-400 text-center mt-1">
              잘못 보냈다면 고양이별에서 다시 지도로 되돌릴 수 있어요.
            </p>
          </div>
        </div>
      )}

      {/* ── 2) 올라가는 중 ── */}
      {phase === "flying" && (
        <div className="relative flex flex-col items-center" style={{ animation: "starFadeIn 800ms ease both" }}>
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: 132,
              height: 132,
              border: "3px solid rgba(255,233,168,0.75)",
              boxShadow: "0 0 44px rgba(255,233,168,0.55)",
              background: "#2a2340",
              animation: "catAscend 3.6s cubic-bezier(0.35,0,0.25,1) forwards",
            }}
          >
            {cat.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cat.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[44px]">🐈</div>
            )}
          </div>
          <p
            className="text-[15px] mt-8 text-center"
            style={{ color: "rgba(255,255,255,0.82)", animation: "starFadeIn 1.2s ease 0.6s both" }}
          >
            {cat.name}(이)가 고양이별로 가고 있어요
          </p>
        </div>
      )}

      {/* ── 3) 도착 ── */}
      {phase === "done" && (
        <div
          className="relative flex flex-col items-center w-full"
          style={{ maxWidth: 340, animation: "starFadeIn 900ms ease both" }}
        >
          <div style={{ animation: "arrivedGlow 2.6s ease-in-out infinite" }}>
            <Star size={44} color="#FFE9A8" fill="#FFE9A8" />
          </div>
          <h2 className="text-[20px] font-bold text-white mt-6 text-center">
            {cat.name}(이)가 고양이별에 닿았어요
          </h2>
          <p className="text-[14px] leading-[1.7] text-center mt-3" style={{ color: "rgba(255,255,255,0.72)" }}>
            그동안 돌봐주셔서 고마웠어요.
            <br />
            {cat.name}(이)의 기록은 고양이별에 남아 있어요.
          </p>

          <button
            onClick={() => router.push("/memorial")}
            className="w-full h-[52px] rounded-2xl mt-8 text-[15px] font-bold active:scale-[0.98] transition-transform"
            style={{ background: "rgba(255,255,255,0.94)", color: "#3a2c4d" }}
          >
            고양이별 가보기
          </button>
          <button onClick={onClose} className="w-full h-[46px] mt-1 text-[14px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            닫기
          </button>
        </div>
      )}

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
        @keyframes catAscend {
          0%   { transform: translateY(120px) scale(1);    opacity: 0; filter: blur(0); }
          18%  { transform: translateY(60px)  scale(1);    opacity: 1; }
          75%  { transform: translateY(-150px) scale(0.42); opacity: 0.85; }
          100% { transform: translateY(-230px) scale(0.12); opacity: 0; filter: blur(2px); }
        }
        @keyframes starFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes arrivedGlow {
          0%, 100% { transform: scale(1);    filter: drop-shadow(0 0 10px rgba(255,233,168,0.6)); }
          50%      { transform: scale(1.12); filter: drop-shadow(0 0 26px rgba(255,233,168,0.95)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="catAscend"], [style*="starTwinkle"], [style*="arrivedGlow"], [style*="starFadeIn"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
