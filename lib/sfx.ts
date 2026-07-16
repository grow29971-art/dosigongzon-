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
  // 백그라운드에서 타이머 기반 효과음(하트비트/도트 틱 등)이 단 한 번만 걸려도
  // 여기서 무조건 resume()해버리면 suspend()가 무효화된다 — 화면이 실제로
  // 보이는 상태일 때만 resume해서, 숨겨진 동안엔 어떤 sfx 호출이 와도 계속 무음이게 한다.
  if (ctx.state === "suspended" && document.visibilityState === "visible") ctx.resume();
  return ctx;
}

// iOS Safari는 진짜 사용자 제스처(터치/클릭) 콜백 안에서 AudioContext를 만들어야
// 이후 setTimeout 등에서의 재생도 막히지 않는다. 터치 시작 시점에 미리 호출해 준비.
export function primeSfx() { getCtx(); }

// 앱을 백그라운드로 보내거나 화면을 꺼도 환경음(루프)이 계속 재생되던 문제 방지 —
// 탭이 숨겨지면 오디오 컨텍스트 자체를 suspend해서 모든 소리를 멈추고, 돌아오면 이어서 재생.
// visibilitychange 하나만 걸어뒀더니 카카오톡 인앱브라우저 등 일부 모바일 웹뷰에서
// 홈 화면으로 나갈 때 이 이벤트가 안 붙는 경우가 있어(webview lifecycle이 표준과 다름),
// window blur/pagehide를 보조 신호로 같이 걸어 이중으로 막는다.
if (typeof window !== "undefined") {
  const suspendNow = () => { if (ctx && ctx.state === "running") ctx.suspend(); };
  const resumeIfVisible = () => { if (ctx && ctx.state === "suspended" && document.visibilityState === "visible") ctx.resume(); };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") suspendNow(); else resumeIfVisible();
  });
  window.addEventListener("pagehide", suspendNow);
  window.addEventListener("blur", suspendNow);
  window.addEventListener("focus", resumeIfVisible);
  window.addEventListener("pageshow", resumeIfVisible);
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

// ── 짧은 합성 리버브 — 감쇠하는 노이즈를 임펄스 응답으로 써서 "공간감"을 준다.
// 단일 오실레이터 삐-소리가 저렴하게 들리는 가장 큰 이유가 이 공간감 부재라서,
// 타격/포획 계열 효과음은 이 send를 살짝 섞어 방 안에서 울리는 느낌을 낸다.
let reverbNode: ConvolverNode | null = null;
function getReverb(audioCtx: AudioContext): ConvolverNode {
  if (reverbNode) return reverbNode;
  const len = Math.floor(audioCtx.sampleRate * 0.55);
  const buffer = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
  }
  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = buffer;
  return reverbNode;
}
// 드라이(직접음) + 리버브 센드를 함께 목적지에 연결하는 공용 라우팅
function routeOut(audioCtx: AudioContext, node: AudioNode, wetAmount = 0) {
  node.connect(audioCtx.destination);
  if (wetAmount > 0) {
    const send = audioCtx.createGain();
    send.gain.value = wetAmount;
    node.connect(send).connect(getReverb(audioCtx)).connect(audioCtx.destination);
  }
}

interface ToneOpts {
  freq: number; duration: number; type?: OscillatorType; volume?: number;
  slideTo?: number; delay?: number; detune?: number; reverb?: number;
}
function tone({ freq, duration, type = "sine", volume = 0.18, slideTo, delay = 0, detune = 0, reverb = 0 }: ToneOpts) {
  if (isSfxMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  routeOut(audioCtx, gain, reverb);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// 살짝 디튠된 오실레이터 2~3개를 겹쳐서 얇은 단일 삐-소리 대신 풍성한 화음을 낸다
// (신스 유니즌 기법 — 진짜 신스/게임 음악에서 두께감을 낼 때 쓰는 표준 트릭).
function richTone({ freq, duration, type = "triangle", volume = 0.16, delay = 0, reverb = 0.35 }: ToneOpts) {
  tone({ freq, duration, type, volume: volume * 0.7, delay, detune: -9, reverb });
  tone({ freq, duration, type, volume, delay, detune: 0, reverb });
  tone({ freq, duration, type, volume: volume * 0.7, delay, detune: 9, reverb });
}

// ── 노이즈 버스트 — 필터링된 화이트노이즈. 타격/충격/포획 성공음의 "퍽/파삭"하는
// 질감은 순수 톤만으로는 절대 안 나오고 노이즈 레이어가 있어야 진짜 손맛이 남.
interface NoiseOpts {
  duration: number; volume?: number; delay?: number;
  filterType?: BiquadFilterType; filterFreq?: number; filterQ?: number; reverb?: number;
}
function noiseBurst({ duration, volume = 0.2, delay = 0, filterType = "bandpass", filterFreq = 1800, filterQ = 1, reverb = 0 }: NoiseOpts) {
  if (isSfxMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(gain);
  routeOut(audioCtx, gain, reverb);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ── 퍼커시브 펀치 — 피치가 뚝 떨어지는 저음 오실레이터(몸통) + 노이즈 크랙(어택)을
// 동시에 터뜨려서 "퍽!" 하는 실제 타격감을 만든다. hit/impact/catchHit 계열의 뼈대.
function punch({ volume = 0.22, freq = 150, duration = 0.16, delay = 0, crackFreq = 2200, reverb = 0.25 }:
  { volume?: number; freq?: number; duration?: number; delay?: number; crackFreq?: number; reverb?: number }) {
  tone({ freq, duration, type: "square", volume, slideTo: freq * 0.35, delay, reverb });
  noiseBurst({ duration: Math.min(0.05, duration * 0.4), volume: volume * 0.9, delay, filterFreq: crackFreq, filterQ: 0.7, reverb });
}

export const sfx = {
  click: () => {
    tone({ freq: 700, duration: 0.035, type: "sine", volume: 0.07 });
    noiseBurst({ duration: 0.02, volume: 0.05, filterFreq: 3200, filterQ: 1.2 });
  },
  hit: () => punch({ freq: 150, duration: 0.13, volume: 0.24, crackFreq: 2000, reverb: 0.2 }),
  crit: () => {
    punch({ freq: 130, duration: 0.16, volume: 0.3, crackFreq: 2600, reverb: 0.3 });
    richTone({ freq: 990, duration: 0.18, type: "triangle", volume: 0.16, delay: 0.06, reverb: 0.4 });
  },
  dodge: () => {
    tone({ freq: 600, duration: 0.09, type: "sine", volume: 0.09, slideTo: 950 });
    noiseBurst({ duration: 0.12, volume: 0.06, filterType: "highpass", filterFreq: 2600, filterQ: 0.5 });
  },
  status: () => tone({ freq: 700, duration: 0.14, type: "triangle", volume: 0.12, slideTo: 420 }),
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => richTone({ freq: f, duration: 0.24, type: "triangle", volume: 0.15, delay: i * 0.11, reverb: 0.4 }));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => richTone({ freq: f, duration: 0.3, type: "sine", volume: 0.14, delay: i * 0.14, reverb: 0.35 }));
  },
  throwCan: () => {
    tone({ freq: 280, duration: 0.35, type: "sine", volume: 0.1, slideTo: 520 });
    noiseBurst({ duration: 0.3, volume: 0.05, filterType: "bandpass", filterFreq: 1400, filterQ: 0.4, delay: 0.02 });
  },
  catchHit: () => {
    punch({ freq: 170, duration: 0.14, volume: 0.24, crackFreq: 2400, reverb: 0.3 });
    richTone({ freq: 980, duration: 0.14, type: "sine", volume: 0.13, delay: 0.04, reverb: 0.35 });
  },
  perfect: () => {
    [660, 880, 1108, 1320].forEach((f, i) => richTone({ freq: f, duration: 0.18, type: "triangle", volume: 0.16, delay: i * 0.08, reverb: 0.45 }));
    noiseBurst({ duration: 0.4, volume: 0.05, filterType: "highpass", filterFreq: 5000, filterQ: 0.4, delay: 0.02 });
  },
  miss: () => {
    tone({ freq: 260, duration: 0.18, type: "sine", volume: 0.1, slideTo: 120 });
    noiseBurst({ duration: 0.1, volume: 0.08, filterType: "lowpass", filterFreq: 500, filterQ: 0.6 });
  },

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
    punch({ freq: 75, duration: 0.28, volume: 0.28, crackFreq: 2600, reverb: 0.4 });
    noiseBurst({ duration: 0.18, volume: 0.12, filterType: "lowpass", filterFreq: 700, filterQ: 0.5, delay: 0.02, reverb: 0.3 });
  },

  // 매 턴 도트(독/출혈) 틱 — 위 효과음보다 훨씬 작고 짧게
  poisonTick: () => tone({ freq: 300, duration: 0.12, type: "sawtooth", volume: 0.06, slideTo: 200 }),
  bleedTick: () => tone({ freq: 700, duration: 0.05, type: "sawtooth", volume: 0.07, slideTo: 300 }),

  guard: () => {
    tone({ freq: 150, duration: 0.12, type: "sine", volume: 0.12 });
    noiseBurst({ duration: 0.06, volume: 0.1, filterType: "bandpass", filterFreq: 3000, filterQ: 3, reverb: 0.15 });
    tone({ freq: 900, duration: 0.05, type: "sine", volume: 0.06, delay: 0.02 });
  },
  itemUse: () => richTone({ freq: 700, duration: 0.14, type: "triangle", volume: 0.12, reverb: 0.3 }),
  countdownTick: () => {
    tone({ freq: 440, duration: 0.06, type: "square", volume: 0.09 });
    noiseBurst({ duration: 0.02, volume: 0.04, filterFreq: 3000, filterQ: 1 });
  },
  countdownGo: () => {
    punch({ freq: 220, duration: 0.1, volume: 0.18, crackFreq: 3000, reverb: 0.25 });
    richTone({ freq: 880, duration: 0.16, type: "triangle", volume: 0.15, delay: 0.09, reverb: 0.35 });
  },
  levelUp: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => richTone({ freq: f, duration: 0.16, type: "triangle", volume: 0.14, delay: i * 0.07, reverb: 0.4 }));
    noiseBurst({ duration: 0.3, volume: 0.04, filterType: "highpass", filterFreq: 6000, filterQ: 0.4, delay: 0.28 });
  },
  bossAppear: () => {
    punch({ freq: 90, duration: 0.5, volume: 0.24, crackFreq: 900, reverb: 0.45 });
    tone({ freq: 220, duration: 0.4, type: "square", volume: 0.08, slideTo: 140, delay: 0.05 });
  },

  // 포획 미니게임 전용
  chargeUp: () => {
    tone({ freq: 220, duration: 0.35, type: "sawtooth", volume: 0.06, slideTo: 520 });
    noiseBurst({ duration: 0.32, volume: 0.03, filterType: "bandpass", filterFreq: 900, filterQ: 0.5, delay: 0.02 });
  },
  shutter: () => {
    noiseBurst({ duration: 0.03, volume: 0.14, filterType: "highpass", filterFreq: 3500, filterQ: 0.6 });
    tone({ freq: 2400, duration: 0.02, type: "square", volume: 0.1 });
    noiseBurst({ duration: 0.02, volume: 0.1, filterType: "bandpass", filterFreq: 1200, filterQ: 2, delay: 0.03 });
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

  // ── 골골송 — 다마고치 쓰다듬기 시 고양이 그르렁. ──
  // 오디오 파일 없이: 저역 톱니/삼각 몸통 + 브라운 노이즈 숨결을 약 26Hz LFO 트레몰로로
  // 맥동시켜 "그르르르" 맥놀이를 만든다. 폰 스피커 로우롤오프를 감안해 몸통을 100Hz대에 둠.
  purr: ({ duration = 1.1, volume = 0.14 }: { duration?: number; volume?: number } = {}) => {
    if (isSfxMuted()) return;
    const audioCtx = getCtx();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;

    // 몸통 — 저음(배음 풍부) + 옥타브 아래 두께감
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth"; osc.frequency.setValueAtTime(104, t0);
    const osc2 = audioCtx.createOscillator();
    osc2.type = "triangle"; osc2.frequency.setValueAtTime(52, t0);

    // 숨결 텍스처 — 브라운 노이즈
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = last * 3.2; }
    const noise = audioCtx.createBufferSource(); noise.buffer = buf;

    // 뭉근하게 — 그르렁은 부드러운 소리
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 600; lp.Q.value = 0.7;

    // 골골 맥동 — 26Hz LFO로 진폭 변조(트레몰로)
    const trem = audioCtx.createGain(); trem.gain.setValueAtTime(0.55, t0);
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine"; lfo.frequency.setValueAtTime(26, t0);
    const lfoDepth = audioCtx.createGain(); lfoDepth.gain.setValueAtTime(0.45, t0);
    lfo.connect(lfoDepth).connect(trem.gain);

    // 엔벨로프 — 부드럽게 들어오고 나감
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(volume, t0 + 0.14);
    env.gain.setValueAtTime(volume, t0 + Math.max(0.2, duration - 0.25));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(lp); osc2.connect(lp); noise.connect(lp);
    lp.connect(trem).connect(env);
    routeOut(audioCtx, env, 0.18);

    const stopAt = t0 + duration + 0.05;
    osc.start(t0); osc2.start(t0); noise.start(t0); lfo.start(t0);
    osc.stop(stopAt); osc2.stop(stopAt); noise.stop(stopAt); lfo.stop(stopAt);
  },
};
