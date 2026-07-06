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

// 앱을 백그라운드로 보내거나 화면을 꺼도 환경음(루프)이 계속 재생되던 문제 방지 —
// 탭이 숨겨지면 오디오 컨텍스트 자체를 suspend해서 모든 소리를 멈추고, 돌아오면 이어서 재생.
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") {
      if (ctx.state === "running") ctx.suspend();
    } else if (ctx.state === "suspended") {
      ctx.resume();
    }
  });
}

export function isSfxMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}
export function setSfxMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (ambientGain) {
    const ac = ambientGain.context;
    ambientGain.gain.cancelScheduledValues(ac.currentTime);
    ambientGain.gain.linearRampToValueAtTime(muted ? 0 : ambientTargetVolume, ac.currentTime + 0.3);
  }
}

// ── 환경 배경음(루프) ── 타격음과 별개로 배틀 배경(비/불씨/안개 등) 분위기를 계속 깔아준다.
// 오디오 파일 없이 화이트노이즈 버퍼 + 밴드패스 필터로 합성 — 환경마다 주파수 대역만 다르게.
let ambientNoiseBuffer: AudioBuffer | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;
let ambientTargetVolume = 0;

function getNoiseBuffer(audioCtx: AudioContext): AudioBuffer {
  if (ambientNoiseBuffer) return ambientNoiseBuffer;
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  ambientNoiseBuffer = buffer;
  return buffer;
}

export function stopAmbient() {
  if (ambientGain) {
    const ac = ambientGain.context;
    ambientGain.gain.cancelScheduledValues(ac.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.35);
  }
  const src = ambientSource;
  if (src) setTimeout(() => { try { src.stop(); } catch { /* 이미 멈췄으면 무시 */ } }, 400);
  ambientSource = null;
  ambientGain = null;
}

export type AmbientEnv = "night" | "noon" | "rain" | "heat" | "fog";
const AMBIENT_PRESET: Record<AmbientEnv, { freq: number; q: number; vol: number }> = {
  rain:  { freq: 3200, q: 0.6, vol: 0.05 },
  heat:  { freq: 900,  q: 1.2, vol: 0.035 },
  fog:   { freq: 500,  q: 1.5, vol: 0.03 },
  night: { freq: 700,  q: 2.0, vol: 0.022 },
  noon:  { freq: 1600, q: 0.8, vol: 0.02 },
};

export function setAmbientEnv(env: AmbientEnv | null) {
  stopAmbient();
  if (!env) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;

  const src = audioCtx.createBufferSource();
  src.buffer = getNoiseBuffer(audioCtx);
  src.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  const preset = AMBIENT_PRESET[env];
  filter.frequency.value = preset.freq;
  filter.Q.value = preset.q;

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  src.connect(filter).connect(gain).connect(audioCtx.destination);
  src.start();

  ambientTargetVolume = preset.vol;
  if (!isSfxMuted()) gain.gain.linearRampToValueAtTime(preset.vol, audioCtx.currentTime + 0.6);

  ambientSource = src;
  ambientGain = gain;
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

  // 상태이상 성향별 효과음 — 카드 위 시각 이펙트(StatusFx)의 색상 체계와 짝을 맞춤
  ice: () => {
    tone({ freq: 1400, duration: 0.12, type: "sine", volume: 0.13, slideTo: 1000 });
    tone({ freq: 1900, duration: 0.1, type: "sine", volume: 0.09, slideTo: 1400, delay: 0.05 });
  },
  fear: () => tone({ freq: 150, duration: 0.35, type: "sawtooth", volume: 0.12, slideTo: 70 }),
  shock: () => {
    tone({ freq: 1800, duration: 0.04, type: "square", volume: 0.12 });
    tone({ freq: 2200, duration: 0.04, type: "square", volume: 0.1, delay: 0.05 });
    tone({ freq: 1600, duration: 0.05, type: "square", volume: 0.1, delay: 0.1 });
  },
  sleep: () => tone({ freq: 500, duration: 0.4, type: "sine", volume: 0.08, slideTo: 280 }),
  poison: () => tone({ freq: 340, duration: 0.22, type: "sawtooth", volume: 0.1, slideTo: 180 }),
  bleed: () => tone({ freq: 900, duration: 0.06, type: "sawtooth", volume: 0.13, slideTo: 200 }),
  bind: () => {
    tone({ freq: 180, duration: 0.08, type: "square", volume: 0.14 });
    tone({ freq: 170, duration: 0.08, type: "square", volume: 0.11, delay: 0.09 });
  },
  life: () => {
    [440, 554, 659].forEach((f, i) => tone({ freq: f, duration: 0.15, type: "triangle", volume: 0.11, delay: i * 0.06 }));
  },
  // 순수 고배율 궁극기(메테오/종말의 일격 등) 전용 — 묵직한 저음 폭발 + 크랙
  impact: () => {
    tone({ freq: 80, duration: 0.22, type: "sawtooth", volume: 0.2, slideTo: 40 });
    tone({ freq: 1400, duration: 0.05, type: "square", volume: 0.13, delay: 0.02 });
    tone({ freq: 900, duration: 0.08, type: "square", volume: 0.1, delay: 0.06 });
  },

  // 매 턴 도트(독/출혈) 틱 — 위 효과음보다 훨씬 작고 짧게
  poisonTick: () => tone({ freq: 300, duration: 0.12, type: "sawtooth", volume: 0.06, slideTo: 200 }),
  bleedTick: () => tone({ freq: 700, duration: 0.05, type: "sawtooth", volume: 0.07, slideTo: 300 }),

  guard: () => {
    tone({ freq: 150, duration: 0.12, type: "sine", volume: 0.13 });
    tone({ freq: 400, duration: 0.08, type: "triangle", volume: 0.07, delay: 0.02 });
  },
  itemUse: () => tone({ freq: 700, duration: 0.1, type: "triangle", volume: 0.12, slideTo: 1000 }),
  countdownTick: () => tone({ freq: 440, duration: 0.08, type: "square", volume: 0.1 }),
  countdownGo: () => {
    tone({ freq: 660, duration: 0.1, type: "square", volume: 0.15 });
    tone({ freq: 880, duration: 0.15, type: "square", volume: 0.15, delay: 0.09 });
  },
  levelUp: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, duration: 0.15, type: "triangle", volume: 0.14, delay: i * 0.07 }));
  },
  bossAppear: () => {
    tone({ freq: 110, duration: 0.5, type: "sawtooth", volume: 0.15, slideTo: 70 });
    tone({ freq: 220, duration: 0.4, type: "square", volume: 0.09, slideTo: 140, delay: 0.05 });
  },

  // 포획 미니게임 전용
  chargeUp: () => tone({ freq: 220, duration: 0.35, type: "sawtooth", volume: 0.07, slideTo: 520 }),
  shutter: () => {
    tone({ freq: 2400, duration: 0.02, type: "square", volume: 0.16 });
    tone({ freq: 1100, duration: 0.03, type: "square", volume: 0.12, delay: 0.03 });
  },

  // 긴장감 연출 — 위기 진입 스팅어 + 위기 상태 지속 하트비트
  danger: () => {
    tone({ freq: 300, duration: 0.18, type: "sawtooth", volume: 0.13, slideTo: 160 });
    tone({ freq: 220, duration: 0.26, type: "sawtooth", volume: 0.11, slideTo: 110, delay: 0.12 });
  },
  heartbeat: () => {
    tone({ freq: 90, duration: 0.09, type: "sine", volume: 0.09 });
    tone({ freq: 80, duration: 0.09, type: "sine", volume: 0.07, delay: 0.16 });
  },
  comeback: () => {
    tone({ freq: 200, duration: 0.1, type: "sawtooth", volume: 0.12 });
    tone({ freq: 500, duration: 0.18, type: "triangle", volume: 0.14, delay: 0.08, slideTo: 700 });
  },
};
