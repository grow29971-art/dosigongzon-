"use client";

// 배틀 날씨/시간 오버레이 — HD-2D 베이스 배경(PNG) 위에 겹치는 레이어.
// Figma 시안(심야 골목 스냅샷)의 룩을 기준으로 6종을 CSS+인라인 SVG로 구현.
// 픽셀 요소(달·구름·눈)는 crispEdges로 또렷하게, 틴트·글로우는 부드러운 그라디언트로(HD-2D).
// 움직이는 입자(빗줄기·눈송이·불씨)는 EnvScene의 ParticleCanvas가 담당 — 여기는 무드·정적 연출.
// 키프레임: globals.css의 bw-* 시리즈.

export type BattleWeatherKey = "night" | "noon" | "rain" | "heat" | "fog" | "snow";

const abs = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: "absolute", inset: 0, pointerEvents: "none", ...extra,
});

// 픽셀 보름달 — 사각 픽셀 뭉치 (crispEdges) + 이중 헤일로
function PixelMoon() {
  const P = 6; // 픽셀 크기
  const cells = [
    [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
    [1, 4], [2, 4], [3, 4],
  ];
  const craters = [[2, 1], [3, 3], [1, 3]];
  return (
    <div style={{ position: "absolute", top: "6%", left: "10%" }}>
      <div style={{
        position: "absolute", top: -26, left: -26, width: P * 5 + 52, height: P * 5 + 52, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,190,0.35) 0%, rgba(255,240,190,0.12) 55%, transparent 75%)",
      }} />
      <svg width={P * 5} height={P * 5} shapeRendering="crispEdges" style={{ position: "relative" }}>
        {cells.map(([x, y], i) => <rect key={i} x={x * P} y={y * P} width={P} height={P} fill="#F5E6A8" />)}
        {craters.map(([x, y], i) => <rect key={`c${i}`} x={x * P} y={y * P} width={P} height={P} fill="#DCC97F" />)}
      </svg>
    </div>
  );
}

// 반짝이는 별 — 위쪽 40%에 고정 배치, 시차 트윙클
function Stars() {
  const pts = [[8, 4], [18, 9], [30, 3], [44, 7], [57, 4], [68, 10], [80, 5], [90, 12], [24, 16], [50, 14], [74, 18], [12, 22], [62, 24], [88, 26], [38, 20]];
  return (
    <div style={abs()}>
      {pts.map(([x, y], i) => (
        <span key={i} style={{
          position: "absolute", left: `${x}%`, top: `${y}%`, width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          background: "#FFF6D8", animation: `bw-twinkle ${2 + (i % 4) * 0.7}s ease-in-out ${i * 0.35}s infinite`,
        }} />
      ))}
    </div>
  );
}

// 픽셀 뭉게구름 한 덩이
function PixelCloud({ scale = 1 }: { scale?: number }) {
  const P = 7 * scale;
  const cells = [[2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2]];
  return (
    <svg width={P * 8} height={P * 3} shapeRendering="crispEdges">
      {cells.map(([x, y], i) => <rect key={i} x={x * P} y={y * P} width={P} height={P} fill="rgba(255,255,255,0.85)" />)}
    </svg>
  );
}

export default function BattleWeather({ env }: { env: BattleWeatherKey | null }) {
  if (!env) return null;

  if (env === "night") {
    return (
      <div style={abs()}>
        <div style={abs({ background: "linear-gradient(180deg, rgba(14,20,58,0.62) 0%, rgba(16,22,54,0.44) 55%, rgba(10,14,36,0.5) 100%)" })} />
        <Stars />
        <PixelMoon />
        {/* 창문·가로등 불빛 — 건물대(상단 1/3)에 은은한 온광 */}
        {[[68, 20], [82, 33], [58, 38]].map(([x, y], i) => (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: 54, height: 54, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,196,88,0.34) 0%, rgba(255,196,88,0.1) 55%, transparent 75%)",
            animation: `bw-glow ${3 + i}s ease-in-out ${i * 0.8}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  if (env === "heat") {
    return (
      <div style={abs()}>
        <div style={abs({ background: "linear-gradient(180deg, rgba(255,132,42,0.34) 0%, rgba(214,74,96,0.26) 55%, rgba(96,42,110,0.3) 100%)" })} />
        {/* 낮게 걸린 태양 글로우 */}
        <div style={{
          position: "absolute", left: "50%", top: "30%", transform: "translateX(-50%)", width: 170, height: 170, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,214,120,0.55) 0%, rgba(255,150,70,0.25) 45%, transparent 70%)",
          animation: "bw-glow 4s ease-in-out infinite",
        }} />
        {/* 아지랑이 — 지면 근처 가로 물결 */}
        <div style={abs({
          top: "58%",
          background: "repeating-linear-gradient(180deg, transparent 0px, transparent 7px, rgba(255,190,120,0.07) 7px, rgba(255,190,120,0.07) 9px)",
          animation: "bw-heatwave 2.6s ease-in-out infinite",
        })} />
      </div>
    );
  }

  if (env === "rain") {
    return (
      <div style={abs()}>
        <div style={abs({ background: "linear-gradient(180deg, rgba(52,66,94,0.4) 0%, rgba(44,58,84,0.32) 100%)" })} />
        {/* 대각선 빗줄기 밴드 (입자는 ParticleCanvas가 추가) */}
        <div style={abs({
          backgroundImage: "repeating-linear-gradient(105deg, transparent 0px, transparent 9px, rgba(190,212,255,0.2) 9px, rgba(190,212,255,0.2) 10px)",
          backgroundSize: "70px 120px",
          animation: "bw-rain 0.6s linear infinite",
        })} />
        {/* 바닥 웅덩이 반사 */}
        {[[24, 90, 84], [66, 86, 60]].map(([x, y, w], i) => (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`, width: w, height: 12, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(178,204,240,0.3) 0%, transparent 70%)",
            animation: `bw-glow ${2.4 + i}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    );
  }

  if (env === "snow") {
    return (
      <div style={abs()}>
        <div style={abs({ background: "linear-gradient(180deg, rgba(150,182,224,0.3) 0%, rgba(180,204,238,0.22) 100%)" })} />
        {/* 지면 적설 — 아래쪽 흰 띠 */}
        <div style={abs({ top: "84%", background: "linear-gradient(180deg, transparent 0%, rgba(235,242,252,0.28) 60%, rgba(240,246,255,0.4) 100%)" })} />
        {/* 느린 눈송이 레이어 (입자는 ParticleCanvas가 추가) */}
        <div style={abs({
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1.6px, transparent 2.4px), radial-gradient(circle, rgba(255,255,255,0.6) 1.2px, transparent 2px)",
          backgroundSize: "110px 110px, 150px 150px",
          animation: "bw-snow 11s linear infinite",
        })} />
      </div>
    );
  }

  if (env === "fog") {
    return (
      <div style={abs()}>
        <div style={abs({ background: "rgba(176,176,202,0.24)" })} />
        {/* 안개 띠 3겹 — 깊이감 있게 서로 다른 속도로 흔들림 */}
        {[[16, 0.34, 9], [42, 0.26, 13], [68, 0.3, 17]].map(([top, op, dur], i) => (
          <div key={i} style={{
            position: "absolute", left: "-20%", right: "-20%", top: `${top}%`, height: "18%",
            background: `linear-gradient(180deg, transparent 0%, rgba(214,212,232,${op}) 45%, transparent 100%)`,
            filter: "blur(7px)",
            animation: `bw-fog ${dur}s ease-in-out ${i * 1.4}s infinite`,
          }} />
        ))}
        {/* 흐릿한 광륜 */}
        <div style={{
          position: "absolute", left: "72%", top: "22%", width: 80, height: 80, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,244,214,0.24) 0%, transparent 70%)",
        }} />
      </div>
    );
  }

  // noon — 맑은 한낮
  return (
    <div style={abs()}>
      <div style={abs({ background: "linear-gradient(180deg, rgba(255,250,225,0.12) 0%, transparent 55%)" })} />
      {/* 흐르는 픽셀 구름 2덩이 */}
      <div style={{ position: "absolute", top: "5%", left: 0, animation: "bw-cloud 46s linear infinite" }}><PixelCloud /></div>
      <div style={{ position: "absolute", top: "14%", left: 0, animation: "bw-cloud 68s linear -22s infinite" }}><PixelCloud scale={0.7} /></div>
      {/* 대각선 햇살 */}
      {[14, 30, 46].map((left, i) => (
        <div key={i} style={{
          position: "absolute", top: "-12%", left: `${left + 30}%`, width: 34, height: "62%",
          transform: "rotate(24deg)", transformOrigin: "top center",
          background: "linear-gradient(180deg, rgba(255,240,180,0.2) 0%, transparent 85%)",
          animation: `bw-glow ${5 + i * 1.3}s ease-in-out ${i}s infinite`,
        }} />
      ))}
    </div>
  );
}
