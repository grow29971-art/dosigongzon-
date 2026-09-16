// 지도 마커용 고양이/사람 캐릭터 SVG — 냥줍(species-art.ts)에서 이식 (2026-08-04).
// 도시공존 고양이는 종(species) 데이터가 없으므로 cat.id 해시로 팔레트를 결정적으로 고른다
// (같은 고양이는 항상 같은 모습). 순수 문자열 생성 함수라 지도 innerHTML에 바로 쓴다.

type PatternKind =
  | "none"      // 단색
  | "stripes"   // 이마 줄무늬 (치즈/고등어)
  | "tuxedo"    // 흰 주둥이+가슴 (턱시도)
  | "calico"    // 삼색 패치
  | "tortie"    // 카오스 얼룩
  | "points";   // 샴 포인트 (귀·주둥이·다리 진한 색)

interface CatPalette {
  fur: string;
  earInner: string;
  muzzle: string;
  iris: string;
  irisRight?: string; // 오드아이
  pattern: PatternKind;
  patternColor?: string;
  patternColor2?: string;
}

// 한국 길고양이에서 흔한 모습 위주 15종. 키는 cats.art_key에 저장되는 값 —
// AI 사진 판독(deriveArtKey)이 배정하고, 없으면 cat.id 해시로 하나가 배정된다.
const PALETTES: Record<string, CatPalette> = {
  cheese:      { fur: "#F5B653", earInner: "#F09090", muzzle: "#FBE3B7", iris: "#7A5230", pattern: "stripes", patternColor: "#D8933A" }, // 치즈
  mackerel:    { fur: "#9FB4C7", earInner: "#E8A0A8", muzzle: "#E3ECF4", iris: "#4F6A43", pattern: "stripes", patternColor: "#5F7488" }, // 고등어
  tuxedo:      { fur: "#3A3F4B", earInner: "#E8A0A8", muzzle: "#FFFFFF", iris: "#D8A03F", pattern: "tuxedo", patternColor: "#FFFFFF" }, // 턱시도
  allblack:    { fur: "#33363F", earInner: "#5A5E6C", muzzle: "#4A4E5A", iris: "#F2C94C", pattern: "none" },                            // 올블랙
  allwhite:    { fur: "#F7F4EE", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#5FA8D8", pattern: "none" },                            // 올화이트
  graytabby:   { fur: "#B9BDC7", earInner: "#E8A8B0", muzzle: "#E8EAEF", iris: "#7A9A4F", pattern: "stripes", patternColor: "#8E93A1" }, // 회색태비
  calico:      { fur: "#F9F3E7", earInner: "#F0A0A8", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#F0A24E", patternColor2: "#4E4A55" }, // 삼색
  tortie:      { fur: "#5A4636", earInner: "#E8A0A8", muzzle: "#8A6E52", iris: "#E8B44C", pattern: "tortie", patternColor: "#E08A3C", patternColor2: "#3A2E24" }, // 카오스
  oddeye:      { fur: "#FBF8F2", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#5FA8D8", irisRight: "#E8B44C", pattern: "none" },       // 오드아이
  beigetabby:  { fur: "#E3C29A", earInner: "#EFA8A8", muzzle: "#F5E4CB", iris: "#6A8A4F", pattern: "stripes", patternColor: "#C9A276" }, // 베이지태비
  siamese:     { fur: "#F1E3CE", earInner: "#8A6E5A", muzzle: "#C9AE8E", iris: "#4F8FD8", pattern: "points", patternColor: "#6E523E" },  // 샴
  cowcat:      { fur: "#F7F5F0", earInner: "#F0A8B0", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#3A3F4B", patternColor2: "#2E323C" }, // 젖소
  caramel:     { fur: "#D9A05C", earInner: "#EFA098", muzzle: "#F0D0A0", iris: "#7A5230", pattern: "stripes", patternColor: "#B67F3C" }, // 카라멜
  alleyboss:   { fur: "#E0913F", earInner: "#F0A090", muzzle: "#F6D8A8", iris: "#6A8A4F", pattern: "stripes", patternColor: "#B96F28" }, // 골목대장
  russianblue: { fur: "#8B9BB4", earInner: "#C3A8B8", muzzle: "#AEBACC", iris: "#6FCF97", pattern: "none" },                            // 솔리드 그레이
};
const PALETTE_KEYS = Object.keys(PALETTES);

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// seedOrKey가 팔레트 키(art_key)면 그대로, 아니면(cat.id 등) 해시로 결정적 배정
function paletteFor(seedOrKey: string): { art: CatPalette; key: string } {
  if (PALETTES[seedOrKey]) return { art: PALETTES[seedOrKey], key: seedOrKey };
  const key = PALETTE_KEYS[hashSeed(seedOrKey) % PALETTE_KEYS.length];
  return { art: PALETTES[key], key };
}

/**
 * AI 사진 판독 features(colors/pattern/traits — generate-card 라우트의 Gemini 출력) →
 * 마커 캐릭터 팔레트 키. 매핑 불가하면 null (호출측이 저장 생략 → id 해시 폴백).
 * box/supabase_cat_art_key_migration.sql의 백필 CASE와 로직이 일치해야 한다.
 */
export function deriveArtKey(
  f: { colors?: unknown; pattern?: unknown; traits?: unknown } | null | undefined,
): string | null {
  if (!f) return null;
  const colors = (Array.isArray(f.colors) ? f.colors : []).map((c) => String(c).toLowerCase());
  const pattern = String(f.pattern ?? "").toLowerCase();
  const traits = (Array.isArray(f.traits) ? f.traits : []).map((t) => String(t).toLowerCase());
  const has = (...keys: string[]) => keys.some((k) => colors.some((c) => c.includes(k)));
  const orange = has("orange", "ginger", "red", "cream", "apricot");
  const black = has("black");
  const white = has("white");
  const gray = has("gray", "grey", "blue", "silver");
  const brown = has("brown", "beige", "tan", "sand");

  if (traits.some((t) => t.includes("odd_eye") || t.includes("oddeye"))) return "oddeye";
  if (pattern === "calico" || (pattern === "van" && orange && black)) return "calico";
  if (pattern === "tortoiseshell" || pattern === "torbie") return "tortie";
  if (pattern === "tuxedo") return "tuxedo";
  if (pattern === "colorpoint") return "siamese";
  if (pattern === "tabby") {
    if (orange) return "cheese";
    if (gray) return "mackerel";
    if (brown) return "beigetabby";
    return "mackerel";
  }
  if (pattern === "bicolor" || pattern === "van") {
    if (black && white) return "cowcat";
    if (orange) return "cheese";
    return "graytabby";
  }
  // solid 등 — 색으로만 판단
  if (black && !white) return "allblack";
  if (white && !black && !orange && !gray) return "allwhite";
  if (black && white) return "cowcat";
  if (gray) return "russianblue";
  if (orange) return "caramel";
  if (brown) return "beigetabby";
  return null;
}

// ── 사진 실측 색 (art_colors) ──
// Gemini가 사진에서 뽑은 털/무늬 hex를 팔레트 위에 덮어써 "그 고양이 색" 캐릭터를 만든다.

export interface CatArtColors {
  fur?: string | null;     // 몸통 털 대표색
  pattern?: string | null; // 무늬(줄무늬/패치) 색
}

// innerHTML에 박히는 값이라 형식 엄격 검증 (스타일 인젝션 차단)
function safeHex(h: unknown): string | null {
  return typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
}

// 흰색과 혼합해 밝은 파생색(주둥이·배) 생성. p=0(원색)~1(흰색).
function mixWhite(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * p).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/**
 * AI 사진 판독 features(fur_hex/pattern_hex) → 저장용 art_colors.
 * hex 형식이 아니면 버린다. fur가 없으면 전체 null (색 미확정).
 */
export function deriveArtColors(
  f: { fur_hex?: unknown; pattern_hex?: unknown } | null | undefined,
): { fur: string; pattern: string | null } | null {
  if (!f) return null;
  const fur = safeHex(f.fur_hex);
  if (!fur) return null;
  return { fur, pattern: safeHex(f.pattern_hex) };
}

/**
 * cat.id → 옆모습 걷는 전신 고양이 SVG (지도 마커용) — 기본 오른쪽(동쪽) 보기.
 * 이동 방향 반전은 호출측이 컨테이너에 scaleX(-1)를 건다.
 * walking=true면 다리 총총·꼬리 살랑 CSS 애니메이션 (globals.css nyangLegSwing/nyangTailSway).
 * jitter(0..1)는 개체별 주기·위상 분산용 — 생략 시 id 해시에서 유도.
 * colors(사진 실측 hex)가 있으면 팔레트의 털/무늬/주둥이 색을 덮어쓴다.
 */
export function catArtWalkSvg(
  seed: string, width: number,
  opts?: { walking?: boolean; jitter?: number; colors?: CatArtColors | null },
): string {
  const { art: base, key } = paletteFor(seed);
  // 사진 실측 색 오버라이드 — fur가 유효할 때만. 주둥이는 털색을 밝힌 파생색.
  const furOv = safeHex(opts?.colors?.fur);
  const patternOv = safeHex(opts?.colors?.pattern);
  const a: CatPalette = furOv
    ? {
        ...base,
        fur: furOv,
        muzzle: mixWhite(furOv, 0.55),
        patternColor: patternOv ?? base.patternColor,
      }
    : patternOv
      ? { ...base, patternColor: patternOv }
      : base;
  const walking = opts?.walking ?? true;
  const j = opts?.jitter ?? ((hashSeed(seed) >> 4) % 100) / 100;
  // 색 오버라이드가 있으면 clipPath id도 고유화 (같은 키·다른 색 SVG 공존 대비)
  const colorTag = furOv ? `-${furOv.slice(1)}` : "";
  const clipId = `dosi-walkhead-${key}${colorTag}`;
  const bodyClip = `dosi-walkbody-${key}${colorTag}`;
  const height = Math.round((width * 96) / 112);

  // 샴 포인트 — 다리·꼬리가 진한 색
  const limbFur = a.pattern === "points" && a.patternColor ? a.patternColor : a.fur;

  const legDur = 0.52 + j * 0.14;
  const legStyle = (phase: 0 | 1) =>
    `style="transform-box:fill-box;transform-origin:50% 8%;${walking
      ? `animation:nyangLegSwing ${legDur.toFixed(2)}s ease-in-out ${(-phase * legDur / 2 - j * 0.31).toFixed(2)}s infinite`
      : ""}"`;
  // 대각 걸음: far(반대편) 다리는 살짝 어둡게 눌러 원근을 준다. 턱시도는 흰 양말.
  const leg = (x: number, phase: 0 | 1, far: boolean) => `
    <g ${legStyle(phase)}>
      <rect x="${x}" y="72" width="7.5" height="22" rx="3.7" fill="${limbFur}"/>
      ${a.pattern === "tuxedo" ? `<rect x="${x}" y="88" width="7.5" height="6" rx="3" fill="#FFFFFF"/>` : ""}
      ${far ? `<rect x="${x}" y="72" width="7.5" height="22" rx="3.7" fill="rgba(30,22,20,0.16)"/>` : ""}
    </g>`;

  const tailSway =
    `transform-box:fill-box;transform-origin:92% 92%;animation:nyangTailSway ${(1.6 + j * 0.8).toFixed(2)}s ease-in-out ${(-j * 1.5).toFixed(2)}s infinite`;
  const tailStripes = a.pattern === "stripes" && a.patternColor ? `
      <g stroke="${a.patternColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M 13 47 l 6 2.5"/><path d="M 11.5 40 l 6 1.5"/>
      </g>` : "";
  const tail = `<g style="${tailSway}">
      <path d="M 27 62 Q 13 54 11 37" fill="none" stroke="${limbFur}" stroke-width="7" stroke-linecap="round"/>
      ${tailStripes}
    </g>`;

  // 몸통(가로 캡슐) + 무늬 — 좌표는 몸통 클립 기준
  const bodyX = 24, bodyY = 50, bodyW = 54, bodyH = 28;
  let bodyPattern = "";
  if (a.pattern === "stripes") {
    bodyPattern = `
      <g clip-path="url(#${bodyClip})" stroke="${a.patternColor}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M 34 ${bodyY + 1} q 2 8 0 14"/>
        <path d="M 45 ${bodyY + 1} q 2 9 0 15"/>
        <path d="M 56 ${bodyY + 1} q 2 8 0 14"/>
      </g>`;
  } else if (a.pattern === "tuxedo") {
    bodyPattern = `
      <g clip-path="url(#${bodyClip})">
        <ellipse cx="${bodyX + bodyW - 9}" cy="${bodyY + bodyH + 2}" rx="21" ry="14" fill="${a.patternColor}"/>
      </g>`;
  } else if (a.pattern === "calico") {
    bodyPattern = `
      <g clip-path="url(#${bodyClip})">
        <path d="M 29 ${bodyY} q 13 -2 17 8 q -7 10 -19 6 Z" fill="${a.patternColor}"/>
        <path d="M 56 ${bodyY + 13} q 11 -5 17 4 q -4 10 -17 7 Z" fill="${a.patternColor2}"/>
      </g>`;
  } else if (a.pattern === "tortie") {
    bodyPattern = `
      <g clip-path="url(#${bodyClip})" opacity="0.9">
        <ellipse cx="36" cy="${bodyY + 8}" rx="8" ry="5.5" fill="${a.patternColor}" transform="rotate(-14 36 ${bodyY + 8})"/>
        <ellipse cx="55" cy="${bodyY + 6}" rx="7" ry="5" fill="${a.patternColor2}" transform="rotate(10 55 ${bodyY + 6})"/>
        <ellipse cx="46" cy="${bodyY + 19}" rx="6.5" ry="4.5" fill="${a.patternColor2}"/>
        <ellipse cx="66" cy="${bodyY + 17}" rx="6" ry="4" fill="${a.patternColor}"/>
      </g>`;
  }

  return `<svg width="${width}" height="${height}" viewBox="0 0 112 96" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${bodyClip}"><rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="14"/></clipPath></defs>
    ${tail}
    ${leg(33, 0, true)}${leg(58, 1, true)}
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="14" fill="${a.fur}"/>
    <ellipse cx="${bodyX + bodyW / 2}" cy="${bodyY + bodyH - 4}" rx="18" ry="8" fill="${a.muzzle}" opacity="0.3"/>
    ${bodyPattern}
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="14" fill="none" stroke="rgba(40,30,30,0.13)" stroke-width="2"/>
    ${leg(42, 1, false)}${leg(67, 0, false)}
    <g transform="translate(50 -2) scale(0.58)">${headMarkup(a, clipId)}</g>
  </svg>`;
}

// 얼굴 마크업(귀·머리·눈·주둥이 등) — viewBox 0 0 100 100 기준.
function headMarkup(a: CatPalette, clipId: string): string {
  // 무늬 레이어 (머리 타원에 클리핑)
  let pattern = "";
  if (a.pattern === "stripes") {
    pattern = `
      <g clip-path="url(#${clipId})" stroke="${a.patternColor}" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M 42 30 q 1 8 0 13"/>
        <path d="M 50 28 q 0 8 0 14"/>
        <path d="M 58 30 q -1 8 0 13"/>
        <path d="M 18 58 h 8 M 17 66 h 8"/>
        <path d="M 82 58 h -8 M 83 66 h -8"/>
      </g>`;
  } else if (a.pattern === "tuxedo") {
    pattern = `
      <g clip-path="url(#${clipId})">
        <path d="M 30 68 Q 50 48 70 68 L 70 92 L 30 92 Z" fill="${a.patternColor}"/>
      </g>`;
  } else if (a.pattern === "calico") {
    pattern = `
      <g clip-path="url(#${clipId})">
        <path d="M 16 38 Q 30 26 44 36 Q 36 52 18 52 Z" fill="${a.patternColor}"/>
        <path d="M 60 32 Q 76 26 84 42 Q 76 52 62 46 Z" fill="${a.patternColor2}"/>
      </g>`;
  } else if (a.pattern === "tortie") {
    pattern = `
      <g clip-path="url(#${clipId})" opacity="0.9">
        <ellipse cx="34" cy="40" rx="10" ry="7" fill="${a.patternColor}" transform="rotate(-16 34 40)"/>
        <ellipse cx="66" cy="36" rx="9" ry="6" fill="${a.patternColor2}" transform="rotate(12 66 36)"/>
        <ellipse cx="24" cy="62" rx="7" ry="5" fill="${a.patternColor2}"/>
        <ellipse cx="76" cy="60" rx="7" ry="5" fill="${a.patternColor}"/>
        <ellipse cx="52" cy="33" rx="6" ry="4" fill="${a.patternColor2}"/>
      </g>`;
  } else if (a.pattern === "points") {
    pattern = `
      <g clip-path="url(#${clipId})">
        <ellipse cx="50" cy="72" rx="17" ry="12" fill="${a.patternColor}" opacity="0.5"/>
      </g>`;
  }

  const rightIris = a.irisRight ?? a.iris;

  return `
    <defs><clipPath id="${clipId}"><ellipse cx="50" cy="59" rx="35" ry="32"/></clipPath></defs>
    <!-- 귀 (짧고 둥근 팁 — 뾰족귀보다 아기 비율) -->
    <path d="M 20 45 L 15.5 19 Q 15 13.5 20 15.5 L 44 28 Z" fill="${a.fur}"/>
    <path d="M 80 45 L 84.5 19 Q 85 13.5 80 15.5 L 56 28 Z" fill="${a.fur}"/>
    <path d="M 24 39 L 21 23 L 36.5 30 Z" fill="${a.pattern === "points" ? a.patternColor : a.earInner}"/>
    <path d="M 76 39 L 79 23 L 63.5 30 Z" fill="${a.pattern === "points" ? a.patternColor : a.earInner}"/>
    <!-- 머리 -->
    <ellipse cx="50" cy="59" rx="35" ry="32" fill="${a.fur}"/>
    ${pattern}
    <!-- 셰이딩: 좌상단 하이라이트 + 하단 그림자 + 외곽선 -->
    <g clip-path="url(#${clipId})">
      <ellipse cx="37" cy="42" rx="17" ry="9" fill="white" opacity="0.16" transform="rotate(-16 37 42)"/>
      <ellipse cx="50" cy="88" rx="33" ry="13" fill="black" opacity="0.07"/>
    </g>
    <ellipse cx="50" cy="59" rx="35" ry="32" fill="none" stroke="rgba(70,45,38,0.2)" stroke-width="2.2"/>
    <path d="M 20 45 L 15.5 19 Q 15 13.5 20 15.5 L 44 28" fill="none" stroke="rgba(70,45,38,0.18)" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 80 45 L 84.5 19 Q 85 13.5 80 15.5 L 56 28" fill="none" stroke="rgba(70,45,38,0.18)" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- 주둥이 -->
    <ellipse cx="50" cy="71" rx="13" ry="8.5" fill="${a.muzzle}" opacity="0.9"/>
    <!-- 눈 (왕눈 + 이중 하이라이트) -->
    <g>
      <circle cx="35.5" cy="57" r="8" fill="${a.iris}"/>
      <circle cx="35.5" cy="57" r="5.1" fill="#1E1A22"/>
      <circle cx="33" cy="54.6" r="2.4" fill="white"/>
      <circle cx="37.6" cy="59.2" r="1.1" fill="white" opacity="0.85"/>
      <circle cx="64.5" cy="57" r="8" fill="${rightIris}"/>
      <circle cx="64.5" cy="57" r="5.1" fill="#1E1A22"/>
      <circle cx="62" cy="54.6" r="2.4" fill="white"/>
      <circle cx="66.6" cy="59.2" r="1.1" fill="white" opacity="0.85"/>
    </g>
    <!-- 볼터치 -->
    <ellipse cx="26.5" cy="66.5" rx="5.6" ry="3.5" fill="#F09090" opacity="0.5"/>
    <ellipse cx="73.5" cy="66.5" rx="5.6" ry="3.5" fill="#F09090" opacity="0.5"/>
    <!-- 코 (젤리코) + ω입 -->
    <path d="M 47 66.4 L 53 66.4 Q 54.2 66.4 53.5 67.6 L 51 70.2 Q 50 71.2 49 70.2 L 46.5 67.6 Q 45.8 66.4 47 66.4 Z" fill="#E8837A"/>
    <path d="M 50 70.6 q -0.9 3.2 -4.8 2.9 M 50 70.6 q 0.9 3.2 4.8 2.9"
      stroke="#8A6A5A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <!-- 수염 -->
    <g stroke="#8A8A8A" stroke-width="1.4" stroke-linecap="round" opacity="0.5">
      <path d="M 20 68 L 12 66.5"/><path d="M 21 73 L 13 74"/>
      <path d="M 80 68 L 88 66.5"/><path d="M 79 73 L 87 74"/>
    </g>`;
}

/**
 * 내 위치 아바타 — 고양이귀 후드를 쓴 치비 사람 캐릭터 (냥줍 butlerWalkSvg 이식,
 * 후드를 도시공존 테라코타 테마로 리컬러). 정면 얼굴 + 옆모습 몸.
 * 몸통 숨쉬기는 마커 루트 .me-marker의 .me-body CSS가 담당 (globals.css nyangBreathe).
 */
export function personMarkerSvg(width: number): string {
  const height = Math.round((width * 100) / 72);
  const HOODIE = "#B05C36", HOODIE_DARK = "#8F4A2E", PANTS = "#4A4038", SKIN = "#F6D7B8";
  const HAIR = "#6B4A33";
  const OUTLINE = "rgba(40,30,30,0.13)";
  const leg = (x: number, far: boolean) => `
    <g>
      <rect x="${x}" y="72" width="6.4" height="19" rx="3.2" fill="${PANTS}"/>
      <rect x="${x - 0.7}" y="89" width="10" height="7" rx="3.4" fill="#F4F6F9" stroke="${OUTLINE}" stroke-width="1.4"/>
      ${far ? `<rect x="${x - 0.7}" y="72" width="10" height="24" rx="3.4" fill="rgba(30,22,20,0.16)"/>` : ""}
    </g>`;
  const arm = (x: number, far: boolean) => `
    <g>
      <rect x="${x}" y="50" width="6" height="18" rx="3" fill="${far ? HOODIE_DARK : HOODIE}"/>
      <circle cx="${x + 3}" cy="69" r="3.2" fill="${SKIN}"/>
      ${far ? `<rect x="${x}" y="50" width="6" height="22" rx="3" fill="rgba(30,22,20,0.12)"/>` : ""}
    </g>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 72 100" xmlns="http://www.w3.org/2000/svg">
    ${arm(24.5, true)}
    ${leg(29.5, true)}
    <!-- 몸통: A라인 스커트 + 허리가 살짝 들어간 후드집업 -->
    <g class="me-body">
      <path d="M 28.5 62 L 47.5 62 L 53 79 Q 38 82 23 79 Z" fill="${PANTS}"/>
      <path d="M 33 64 L 30.5 80 M 38 64 v 17 M 43 64 L 45.5 80" stroke="rgba(30,24,18,0.18)" stroke-width="1.2" fill="none"/>
      <path d="M 28.5 62 L 47.5 62 L 53 79 Q 38 82 23 79 Z" fill="none" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 27.6 55 Q 26.2 47.6 32 46 L 44 46 Q 49.8 47.6 48.4 55 L 47.4 70 Q 38 72.6 28.6 70 Z" fill="${HOODIE}"/>
      <path d="M 38 47.5 v 23" stroke="${HOODIE_DARK}" stroke-width="1.8"/>
      <path d="M 31 64 q 7 4.5 14 0" stroke="${HOODIE_DARK}" stroke-width="1.8" fill="none"/>
      <path d="M 35 48 l -1.5 6 M 41 48 l 1.5 6" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>
      <path d="M 27.6 55 Q 26.2 47.6 32 46 L 44 46 Q 49.8 47.6 48.4 55 L 47.4 70 Q 38 72.6 28.6 70 Z" fill="none" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
    </g>
    ${leg(39, false)}
    ${arm(44.5, false)}
    <!-- 머리: 긴 머리 + 고양이귀 후드 + 정면 치비 얼굴 -->
    <g>
      <path d="M 27 16 Q 17 27 16.2 45 Q 15.8 57 21.5 60.5 Q 27.6 57.5 27.9 47 Q 27.2 30 33.5 20 Z" fill="${HAIR}" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 49 19 Q 57.4 28 57.7 43 Q 57.7 51 53.4 53.6 Q 50.8 45 49.6 33 Z" fill="${HAIR}" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 25 15 L 20.5 3.5 Q 20 0.5 23.5 2 L 34 8 Z" fill="${HOODIE}" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 51 13 L 56.5 2.5 Q 57.5 -0.5 60 2.5 L 61 9 Q 58 15 52 17 Z" fill="${HOODIE}" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 26.5 12.5 L 23.5 5.5 L 31 9.5 Z" fill="#F5B8C0"/>
      <path d="M 53 11 L 57 4.5 L 57.5 9.5 Z" fill="#F5B8C0"/>
      <circle cx="37" cy="29" r="20" fill="${HOODIE}"/>
      <circle cx="40" cy="30" r="15.5" fill="${SKIN}"/>
      <path d="M 25.5 27 Q 26.5 15 40 14.6 Q 53 15 54.8 26 Q 49.5 21.8 44 24.4 Q 41 20.4 38.5 24.4 Q 33 21.8 25.5 27 Z" fill="${HAIR}"/>
      <path d="M 25.6 26 Q 23.6 34 25 41 Q 28 38 28.4 30 Z" fill="${HAIR}"/>
      <path d="M 54.6 25.5 Q 56.6 34 55.2 41.5 Q 52.2 38 51.8 30 Z" fill="${HAIR}"/>
      <circle cx="37" cy="29" r="20" fill="none" stroke="${OUTLINE}" stroke-width="2"/>
      <!-- 눈·볼·입 (고양이와 같은 왕눈+하이라이트 문법) -->
      <circle cx="35.5" cy="32" r="2.8" fill="#1E1A22"/><circle cx="34.5" cy="31" r="1" fill="white"/>
      <circle cx="46.5" cy="32" r="2.8" fill="#1E1A22"/><circle cx="45.5" cy="31" r="1" fill="white"/>
      <ellipse cx="31.5" cy="37.5" rx="3.4" ry="2.2" fill="#F09090" opacity="0.5"/>
      <ellipse cx="50" cy="37.5" rx="3.4" ry="2.2" fill="#F09090" opacity="0.5"/>
      <path d="M 38.5 38.5 q 2.5 2.5 5 0" stroke="#8A6A5A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}
