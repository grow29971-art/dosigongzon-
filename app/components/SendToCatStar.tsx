"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, X, Volume2, VolumeX } from "lucide-react";
import { sendCatToStar } from "@/lib/cats-repo";
import { useToast } from "@/app/components/Toast";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { catArtWalkSvg } from "@/lib/cat-art";

type Phase = "confirm" | "flying" | "done";

interface Props {
  cat: { id: string; name: string; photo_url: string | null };
  onClose: () => void;
  /** 전송이 끝났을 때 — 지도에서 마커를 빼는 등 부모 정리용 */
  onSent: () => void;
}

// ── 무지개다리 곡선 ──
// 화면 왼쪽 아래에서 시작해 오른쪽 위 하늘로 이어진다. viewBox 360×300 기준.
// 고양이가 걷는 길(WALK)은 다리 윗면에서 살짝 띄운 같은 형태의 곡선.
// 2026-09-16 리디자인: 7색 무지개 대신 흰 선 7겹(투명도만 다름) — 장식색·글로우 금지 규칙.
const BRIDGE = "M -10 300 Q 150 130 370 30";
const WALK = "M -10 282 Q 150 112 370 12";
const BRIDGE_LAYERS = [0.95, 0.8, 0.66, 0.54, 0.44, 0.34, 0.26];

const SOUND_KEY = "memorial_sound_off";

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
    top: next() * 70,
    size: 1 + next() * 2.2,
    delay: next() * 3,
    opacity: 0.25 + next() * 0.6,
  }));
}

/**
 * 떠나보내는 소리 — 오디오 파일 없이 Web Audio 로 합성한다.
 * (외부 에셋을 붙이면 CSP·용량·저작권이 따라오고, 이 한 장면에만 쓰인다)
 * 오르골 느낌의 5음계 상행 + 마지막에 은은한 종소리.
 * 버튼 클릭(사용자 제스처) 직후에 만들어야 브라우저 자동재생 정책을 통과한다.
 */
function playFarewellChime(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;

  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  // 오르골 한 음 — 사인 기음 + 옥타브 배음, 지수 감쇠
  const note = (freq: number, at: number, dur: number, vol: number) => {
    for (const [mult, share] of [[1, 1], [2, 0.34], [3, 0.12]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(vol * share, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + dur + 0.05);
    }
  };

  // C 장5음계 상행 — 고양이가 다리를 건너는 동안
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
  scale.forEach((f, i) => note(f, 0.7 + i * 0.42, 1.6, 0.34 - i * 0.02));

  // 도착 종소리
  note(1567.98, 4.3, 2.6, 0.2);
  note(2093.0, 4.36, 2.4, 0.12);

  // 바람결 — 아주 옅은 화이트 노이즈 페이드
  const len = ctx.sampleRate * 6;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.06;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, ctx.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 1.2);
  ng.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 6);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(master);
  noise.start();
  noise.stop(ctx.currentTime + 6);

  return ctx;
}

export default function SendToCatStar({ cat, onClose, onSent }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("confirm");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  const stars = useMemo(() => makeStars(cat.id, 48), [cat.id]);
  const photo = useMemo(() => sanitizeImageUrl(cat.photo_url) || null, [cat.photo_url]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      /* 저장소 차단 환경 — 기본값(소리 켜짐) 유지 */
    }
  }, []);

  // 애니메이션이 끝나면 마무리 화면으로. 모션 최소화 설정이면 곧바로 넘긴다.
  useEffect(() => {
    if (phase !== "flying") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("done"), reduced ? 400 : 5300);
    return () => clearTimeout(t);
  }, [phase]);

  // 화면을 벗어나면 소리도 끊는다
  useEffect(() => () => { void audioRef.current?.close().catch(() => {}); }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* 무시 */
    }
    if (next) {
      void audioRef.current?.close().catch(() => {});
      audioRef.current = null;
    }
  };

  const handleSend = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await sendCatToStar(cat.id, note);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!muted && !reduced) audioRef.current = playFarewellChime();
      setPhase("flying");
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "고양이별로 보내지 못했어요");
      setBusy(false);
    }
  };

  const scene = phase !== "confirm";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{
        zIndex: 100,
        background: scene ? "var(--color-gray-900)" : "rgba(0,0,0,0.55)",
        transition: "background 700ms ease",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="고양이별로 보내기"
    >
      {/* 밤하늘 */}
      {scene && (
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
                background: "var(--color-surface)",
                opacity: s.opacity,
                animation: `starTwinkle 3.2s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* 소리 토글 — 전송 장면에서만 */}
      {scene && (
        <button
          onClick={toggleMute}
          className="absolute w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            top: "max(env(safe-area-inset-top), 14px)",
            right: 16,
            background: "rgba(255,255,255,0.1)",
            zIndex: 5,
          }}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
        >
          {muted ? <VolumeX size={16} color="rgba(255,255,255,0.7)" /> : <Volume2 size={16} color="rgba(255,255,255,0.7)" />}
        </button>
      )}

      {/* ── 1) 확인 ── */}
      {phase === "confirm" && (
        <div
          className="relative w-full overflow-hidden"
          style={{ maxWidth: 400, background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center press-strong"
            style={{ background: "var(--color-gray-100)" }}
            aria-label="닫기"
          >
            <X size={17} className="text-text-sub" />
          </button>

          <div className="px-6 pt-7 pb-6">
            <div className="mb-3 text-text-sub">
              <Star size={22} />
            </div>

            <h2 className="text-[20px] font-bold text-text-main mb-2">
              {cat.name}(이)를 고양이별로 보낼까요?
            </h2>
            <p className="text-[15px] leading-[1.65] text-text-sub mb-5">
              지도에서는 내려가지만 <b className="text-text-main">사라지지 않아요.</b> 돌봄 기록과 사진은
              고양이별에 그대로 남아요.
            </p>

            <label className="block text-[13px] font-semibold text-text-sub mb-2">
              마지막 인사 <span className="font-normal text-text-light">(선택)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="하고 싶은 말이 있다면 남겨주세요."
              className="w-full text-[15px] leading-[1.6] px-4 py-3 outline-none resize-none text-text-main"
              style={{ borderRadius: "var(--radius-input)", background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
            />
            <div className="text-right text-[11px] text-text-light mt-1 mb-5">{note.length}/200</div>

            <button
              onClick={handleSend}
              disabled={busy}
              className="w-full h-12 text-white text-[15px] font-semibold press disabled:opacity-60"
              style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
            >
              {busy ? "보내는 중…" : "고양이별로 보내기"}
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 mt-2 text-[15px] font-medium text-text-sub"
            >
              아직 아니에요
            </button>
            <p className="text-[13px] text-text-light text-center mt-1">
              잘못 보냈다면 고양이별에서 다시 지도로 되돌릴 수 있어요.
            </p>
          </div>
        </div>
      )}

      {/* ── 2) 무지개다리 건너기 ── */}
      {phase === "flying" && (
        <div className="relative w-full flex flex-col items-center" style={{ maxWidth: 380 }}>
          <div className="relative w-full" style={{ aspectRatio: "360 / 300" }}>
            <svg
              viewBox="0 0 360 300"
              className="absolute inset-0 w-full h-full overflow-visible"
              aria-hidden="true"
            >
              {/* 다리 7겹 — 아래에서 위로 한 겹씩 그려진다 (흰 선, 투명도만 다름) */}
              <g>
                {BRIDGE_LAYERS.map((alpha, i) => (
                  <path
                    key={alpha}
                    d={BRIDGE}
                    fill="none"
                    stroke="var(--color-surface)"
                    strokeOpacity={alpha}
                    strokeWidth="6"
                    strokeLinecap="round"
                    transform={`translate(0 ${i * 6.5})`}
                    style={{
                      strokeDasharray: 640,
                      strokeDashoffset: 640,
                      animation: `bridgeDraw 1.5s cubic-bezier(0.4,0,0.3,1) ${i * 0.07}s forwards`,
                    }}
                  />
                ))}
              </g>

              {/* 발자국 — 지나간 자리에 하나씩 남는다 */}
              {[0.16, 0.3, 0.44, 0.58, 0.72].map((t, i) => (
                <circle
                  key={t}
                  r="2.6"
                  fill="var(--color-surface)"
                  opacity="0"
                  style={{
                    offsetPath: `path("${WALK}")`,
                    offsetDistance: `${t * 100}%`,
                    animation: `pawFade 2.6s ease-out ${1.05 + i * 0.52}s forwards`,
                  }}
                />
              ))}
            </svg>

            {/* 건너는 고양이 — 다리 곡선(offset-path)을 따라 실제로 걷는다 */}
            {/* 크기 0 인 점이 곡선 위를 이동하고, 사진은 음수 마진으로 그 점에 중심을 맞춘다.
                (박스에 크기를 주면 offset-anchor 기본값이 박스 중심이라 그림이 어긋난다) */}
            <div
              className="absolute"
              style={{
                left: 0,
                top: 0,
                width: 0,
                height: 0,
                offsetPath: `path("${WALK}")`,
                offsetRotate: "0deg",
                offsetDistance: "0%",
                animation: "catCross 4s cubic-bezier(0.42,0,0.6,1) 0.7s forwards",
              }}
            >
              <div style={{ animation: "catBob 0.62s ease-in-out infinite", transformOrigin: "center" }}>
                <div
                  className="rounded-full overflow-hidden"
                  style={{
                    width: 60,
                    height: 60,
                    marginLeft: -30,
                    marginTop: -30,
                    border: "2px solid var(--color-surface)",
                    background: "var(--color-gray-800)",
                  }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: catArtWalkSvg(cat.id, 44, { walking: false }) }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 다리 끝의 별 — 고양이가 도착할 즈음 커진다 */}
            <div
              className="absolute"
              style={{
                right: "2%",
                top: "4%",
                color: "var(--color-surface)",
                opacity: 0,
                animation: "arrivalLight 1.3s ease-out 4s forwards",
              }}
            >
              <Star size={28} />
            </div>
          </div>

          <p
            className="text-[15px] mt-2 text-center"
            style={{ color: "rgba(255,255,255,0.85)", animation: "starFadeIn 1.2s ease 0.8s both" }}
          >
            {cat.name}(이)가 무지개다리를 건너고 있어요
          </p>
        </div>
      )}

      {/* ── 3) 도착 ── */}
      {phase === "done" && (
        <div
          className="relative flex flex-col items-center w-full"
          style={{ maxWidth: 340, animation: "starFadeIn 900ms ease both" }}
        >
          <div style={{ animation: "arrivedGlow 2.6s ease-in-out infinite", color: "var(--color-surface)" }}>
            <Star size={44} />
          </div>
          <h2 className="text-[20px] font-bold text-white mt-6 text-center">
            {cat.name}(이)가 무지개다리를 건넜어요
          </h2>
          <p className="text-[15px] leading-[1.7] text-center mt-3" style={{ color: "rgba(255,255,255,0.72)" }}>
            그동안 돌봐주셔서 고마웠어요.
            <br />
            {cat.name}(이)의 기록은 고양이별에 남아 있어요.
          </p>

          <button
            onClick={() => router.push(`/memorial/${cat.id}`)}
            className="w-full h-12 mt-8 text-[15px] font-semibold press"
            style={{ background: "var(--color-surface)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
          >
            함께한 기록 보기
          </button>
          <button onClick={onClose} className="w-full h-11 mt-1 text-[15px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            닫기
          </button>
        </div>
      )}

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
        @keyframes bridgeDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes catCross {
          0%   { offset-distance: 0%;   opacity: 0; }
          8%   { opacity: 1; }
          82%  { offset-distance: 88%;  opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes catBob {
          0%, 100% { transform: translateY(0)    rotate(-1.5deg); }
          50%      { transform: translateY(-4px) rotate(1.5deg); }
        }
        @keyframes pawFade {
          0%   { opacity: 0; }
          18%  { opacity: 0.95; }
          100% { opacity: 0; }
        }
        @keyframes arrivalLight {
          0%   { opacity: 0; transform: scale(0.4); }
          45%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0.9; transform: scale(1); }
        }
        @keyframes starFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes arrivedGlow {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="catCross"], [style*="catBob"], [style*="starTwinkle"], [style*="bridgeDraw"],
          [style*="pawFade"], [style*="arrivalLight"], [style*="arrivedGlow"], [style*="starFadeIn"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
