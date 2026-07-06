// 가벼운 WebAudio 기반 효과음 신디사이저 — 오디오 파일 없이 오실레이터로 직접 합성한다.
// 배틀/포획 화면의 타격감(손맛)을 위한 효과음에 쓴다. 음소거 여부는 localStorage에 공유 저장.

const MUTE_KEY = "city_sfx_muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// iOS Safari는 진짜 사용자 제스처(터치/클릭) 콜백 안에서 AudioContext를 만들어야
// 이후 setTimeout 등에서의 재생도 막히지 않는다. 터치 시작 시점에 미리 호출해 준비.
export function primeSfx() { getCtx(); }

export function isSfxMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}
export function setSfxMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

interface ToneOpts {
  freq: number; duration: number; type?: OscillatorType; volume?: number;
  slideTo?: number; delay?: number;
}
function tone({ freq, duration, type = "sine", volume = 0.18, slideTo, delay = 0 }: ToneOpts) {
  if (isSfxMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  click: () => tone({ freq: 520, duration: 0.05, type: "square", volume: 0.08 }),
  hit: () => tone({ freq: 160, duration: 0.09, type: "square", volume: 0.16, slideTo: 70 }),
  crit: () => {
    tone({ freq: 220, duration: 0.09, type: "square", volume: 0.2, slideTo: 90 });
    tone({ freq: 880, duration: 0.14, type: "triangle", volume: 0.14, delay: 0.05 });
  },
  dodge: () => tone({ freq: 600, duration: 0.08, type: "sine", volume: 0.1, slideTo: 900 }),
  status: () => tone({ freq: 700, duration: 0.14, type: "triangle", volume: 0.12, slideTo: 420 }),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.22, type: "triangle", volume: 0.16, delay: i * 0.11 }));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => tone({ freq: f, duration: 0.28, type: "sine", volume: 0.15, delay: i * 0.14 }));
  },
  throwCan: () => tone({ freq: 280, duration: 0.35, type: "sine", volume: 0.12, slideTo: 520 }),
  catchHit: () => {
    tone({ freq: 180, duration: 0.12, type: "square", volume: 0.2 });
    tone({ freq: 900, duration: 0.1, type: "sine", volume: 0.12, delay: 0.03 });
  },
  perfect: () => {
    [660, 880, 1108, 1320].forEach((f, i) => tone({ freq: f, duration: 0.16, type: "triangle", volume: 0.17, delay: i * 0.08 }));
  },
  miss: () => tone({ freq: 260, duration: 0.18, type: "sine", volume: 0.12, slideTo: 120 }),
};
