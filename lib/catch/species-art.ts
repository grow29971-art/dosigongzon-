// 종별 고양이 아트 — 이모지 대신 쓰는 치비 스타일 SVG 얼굴.
// 지도 마커(innerHTML 문자열)와 React 화면 양쪽에서 쓰도록 순수 문자열 생성 함수로 구현.
// 종을 추가하면 SPECIES_ART에 팔레트/무늬만 추가하면 된다.

type PatternKind =
  | "none"        // 단색
  | "stripes"     // 이마 줄무늬 (고등어/설산)
  | "tuxedo"      // 흰 주둥이+가슴 (턱시도)
  | "calico"      // 삼색 패치
  | "tortie"      // 카오스 얼룩
  | "points"      // 샴 포인트 (귀·주둥이 진한 색)
  | "stars";      // 밤하늘 별박이

interface SpeciesArt {
  fur: string;        // 기본 털색
  earInner: string;
  muzzle: string;     // 주둥이(입 주변) 색
  iris: string;       // 눈동자(홍채) 색
  irisRight?: string; // 오드아이 전용 — 오른눈 색
  pattern: PatternKind;
  patternColor?: string;
  patternColor2?: string;
  mane?: string;      // 황금냥 갈기색
  wrinkles?: boolean; // 민털냥 주름
}

const ART: Record<string, SpeciesArt> = {
  // 일반
  cheese:      { fur: "#F5B653", earInner: "#F09090", muzzle: "#FBE3B7", iris: "#7A5230", pattern: "stripes", patternColor: "#D8933A" },
  mackerel:    { fur: "#9FB4C7", earInner: "#E8A0A8", muzzle: "#E3ECF4", iris: "#4F6A43", pattern: "stripes", patternColor: "#5F7488" },
  tuxedo:      { fur: "#3A3F4B", earInner: "#E8A0A8", muzzle: "#FFFFFF", iris: "#D8A03F", pattern: "tuxedo", patternColor: "#FFFFFF" },
  allblack:    { fur: "#33363F", earInner: "#5A5E6C", muzzle: "#4A4E5A", iris: "#F2C94C", pattern: "none" },
  allwhite:    { fur: "#F7F4EE", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#5FA8D8", pattern: "none" },
  graytabby:   { fur: "#B9BDC7", earInner: "#E8A8B0", muzzle: "#E8EAEF", iris: "#7A9A4F", pattern: "stripes", patternColor: "#8E93A1" },
  // 고급
  calico:      { fur: "#F9F3E7", earInner: "#F0A0A8", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#F0A24E", patternColor2: "#4E4A55" },
  tortie:      { fur: "#5A4636", earInner: "#E8A0A8", muzzle: "#8A6E52", iris: "#E8B44C", pattern: "tortie", patternColor: "#E08A3C", patternColor2: "#3A2E24" },
  oddeye:      { fur: "#FBF8F2", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#5FA8D8", irisRight: "#E8B44C", pattern: "none" },
  munchkin:    { fur: "#E3C29A", earInner: "#EFA8A8", muzzle: "#F5E4CB", iris: "#6A8A4F", pattern: "stripes", patternColor: "#C9A276" },
  bobtail:     { fur: "#D8CFC2", earInner: "#EFA8A8", muzzle: "#EFE9DF", iris: "#C97F3C", pattern: "calico", patternColor: "#B98A5E", patternColor2: "#8A8078" },
  // 레어
  russianblue: { fur: "#8B9BB4", earInner: "#C3A8B8", muzzle: "#AEBACC", iris: "#6FCF97", pattern: "none" },
  siamese:     { fur: "#F1E3CE", earInner: "#8A6E5A", muzzle: "#C9AE8E", iris: "#4F8FD8", pattern: "points", patternColor: "#6E523E" },
  norwegian:   { fur: "#B0876A", earInner: "#E8A8A8", muzzle: "#EFE0D0", iris: "#5F9A4F", pattern: "stripes", patternColor: "#8A6248", mane: "#D9B896" },
  sphynx:      { fur: "#E8C4B0", earInner: "#D89890", muzzle: "#F2DACB", iris: "#5FA8D8", pattern: "none", wrinkles: true },
  // 레전드
  goldenking:  { fur: "#F2B94A", earInner: "#E08A50", muzzle: "#FBE0AC", iris: "#B85C2E", pattern: "none", mane: "#D88C2E" },
  snowspirit:  { fur: "#F4F7FA", earInner: "#B8C8D8", muzzle: "#FFFFFF", iris: "#58B8E8", pattern: "stripes", patternColor: "#9FB4C4" },
  nightlord:   { fur: "#2E3252", earInner: "#5A5E8C", muzzle: "#42476B", iris: "#F2E29C", pattern: "stars", patternColor: "#F2E9B8" },

  // ═══ 대확장 100종 (2026-07-24) — spawn-species.ts No.019~118과 1:1 ═══
  // 일반 확장
  milk:        { fur: "#F6F1E7", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#8A9BB0", pattern: "none" },
  latte:       { fur: "#D9BC96", earInner: "#EFA8A8", muzzle: "#F0E2CC", iris: "#6A5238", pattern: "stripes", patternColor: "#B99668" },
  mochi:       { fur: "#E5DED2", earInner: "#F0A8B0", muzzle: "#F4EFE6", iris: "#7A6A52", pattern: "none" },
  sparrow:     { fur: "#A98F6E", earInner: "#E8A0A8", muzzle: "#D8C4A8", iris: "#5F5238", pattern: "stripes", patternColor: "#86694A" },
  dawnfog:     { fur: "#AEB8C4", earInner: "#D8A8B8", muzzle: "#D8E0E8", iris: "#6F8FD8", pattern: "none" },
  alleyboss:   { fur: "#E0913F", earInner: "#F0A090", muzzle: "#F6D8A8", iris: "#6A8A4F", pattern: "stripes", patternColor: "#B96F28" },
  churuthief:  { fur: "#E8C9A0", earInner: "#F0A0A8", muzzle: "#F6E6CC", iris: "#C97F3C", pattern: "tortie", patternColor: "#C9955C", patternColor2: "#8A6E52" },
  boots:       { fur: "#3E4350", earInner: "#E8A0A8", muzzle: "#FFFFFF", iris: "#F2C94C", pattern: "tuxedo", patternColor: "#FFFFFF" },
  chonk:       { fur: "#9FA6B4", earInner: "#E8A8B0", muzzle: "#D0D5DD", iris: "#7A9A4F", pattern: "none" },
  punch:       { fur: "#B96F4A", earInner: "#E8A090", muzzle: "#E0B896", iris: "#E8B44C", pattern: "stripes", patternColor: "#8F5232" },
  breadloaf:   { fur: "#E2B984", earInner: "#EFA8A8", muzzle: "#F4DFC0", iris: "#7A5230", pattern: "stripes", patternColor: "#C49258" },
  nap:         { fur: "#D8C6AC", earInner: "#F0A8B0", muzzle: "#EDE2CE", iris: "#8A9BB0", pattern: "none" },
  scratcher:   { fur: "#A8825F", earInner: "#E8A0A0", muzzle: "#D6BB9A", iris: "#5F9A4F", pattern: "stripes", patternColor: "#83603F" },
  tsundere:    { fur: "#EDE6DA", earInner: "#F5B0B8", muzzle: "#FFFFFF", iris: "#5FA8D8", pattern: "calico", patternColor: "#C9B08A", patternColor2: "#8E93A1" },
  doorcat:     { fur: "#4A4E5A", earInner: "#D8A0A8", muzzle: "#F4F6F9", iris: "#D8A03F", pattern: "tuxedo", patternColor: "#F4F6F9" },
  boxcat:      { fur: "#C89A66", earInner: "#EFA8A0", muzzle: "#E6C9A0", iris: "#6A5238", pattern: "none" },
  piggy:       { fur: "#B8B2A6", earInner: "#E8A8B0", muzzle: "#DAD5CA", iris: "#7A6A52", pattern: "calico", patternColor: "#8E93A1", patternColor2: "#EFE9DF" },
  whiskers:    { fur: "#EFEDE8", earInner: "#E8B0B8", muzzle: "#FFFFFF", iris: "#8A9BB0", pattern: "none" },
  backalley:   { fur: "#6A7080", earInner: "#B89098", muzzle: "#9AA0AE", iris: "#F2C94C", pattern: "stripes", patternColor: "#4E5462" },
  morning:     { fur: "#F2DCA8", earInner: "#F0A8A0", muzzle: "#F9EED0", iris: "#6A8A4F", pattern: "stripes", patternColor: "#D9B876" },
  raindrop:    { fur: "#9FAEC4", earInner: "#D0A0B0", muzzle: "#CAD5E4", iris: "#5FA8D8", pattern: "none" },
  button:      { fur: "#F4F0E8", earInner: "#F5B0B8", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#4E4A55", patternColor2: "#8E93A1" },
  aegyo:       { fur: "#E8CBA8", earInner: "#F0A0A8", muzzle: "#F6E4CA", iris: "#C97F3C", pattern: "none" },
  yawn:        { fur: "#DED3C2", earInner: "#EFA8B0", muzzle: "#F0E8DA", iris: "#8A9BB0", pattern: "none" },
  kneady:      { fur: "#E9C9B8", earInner: "#F0A0A0", muzzle: "#F6E2D6", iris: "#5F9A4F", pattern: "none" },
  furball:     { fur: "#C4BBB0", earInner: "#E8A8B0", muzzle: "#E0D8CE", iris: "#E8B44C", pattern: "none" },
  bell:        { fur: "#F6EFE2", earInner: "#F5B0B8", muzzle: "#FFFFFF", iris: "#6A8A4F", pattern: "calico", patternColor: "#E0913F", patternColor2: "#C9B08A" },
  rooftop:     { fur: "#7E8A99", earInner: "#C098A8", muzzle: "#AEBAC8", iris: "#F2C94C", pattern: "stripes", patternColor: "#5D6875" },
  wallcat:     { fur: "#B07A55", earInner: "#E8A098", muzzle: "#DCB894", iris: "#5FA8D8", pattern: "none" },
  flowerbed:   { fur: "#A89078", earInner: "#E8A8A8", muzzle: "#D4C2AC", iris: "#5F9A4F", pattern: "none" },
  groomer:     { fur: "#F2EAE0", earInner: "#F5B8C0", muzzle: "#FFFFFF", iris: "#C97F3C", pattern: "none" },
  purr:        { fur: "#B8A794", earInner: "#E8A8A8", muzzle: "#DACCBC", iris: "#D8A03F", pattern: "none" },
  slurp:       { fur: "#D2A878", earInner: "#EFA8A0", muzzle: "#ECD4B4", iris: "#6A5238", pattern: "stripes", patternColor: "#B08653" },
  bellyup:     { fur: "#E6E0D4", earInner: "#F0A8B0", muzzle: "#F6F2E8", iris: "#5FA8D8", pattern: "calico", patternColor: "#9FA6B4", patternColor2: "#C9B08A" },
  toasty:      { fur: "#D9B088", earInner: "#EFA8A0", muzzle: "#EED8BC", iris: "#7A5230", pattern: "none" },
  tunacan:     { fur: "#C0C8D2", earInner: "#D8A8B8", muzzle: "#E2E7ED", iris: "#4F8FD8", pattern: "stripes", patternColor: "#98A2AE" },
  anchovy:     { fur: "#AEBBC9", earInner: "#D8A8B8", muzzle: "#D6DEE6", iris: "#6FCF97", pattern: "none" },
  market:      { fur: "#8A6E52", earInner: "#D8A098", muzzle: "#BCA284", iris: "#E8B44C", pattern: "tortie", patternColor: "#C9955C", patternColor2: "#4E4A55" },
  playground:  { fur: "#D8C09A", earInner: "#F0A8A8", muzzle: "#EEDFC4", iris: "#5F9A4F", pattern: "none" },
  dashcat:     { fur: "#9A7A5A", earInner: "#E0A098", muzzle: "#C8AC8C", iris: "#F2C94C", pattern: "stripes", patternColor: "#755B3F" },
  // 희귀 확장
  cowcat:      { fur: "#F7F5F0", earInner: "#F0A8B0", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#3A3F4B", patternColor2: "#2E323C" },
  halfmoon:    { fur: "#33363F", earInner: "#5A5E6C", muzzle: "#F4F6F9", iris: "#5FA8D8", pattern: "tuxedo", patternColor: "#F4F6F9" },
  goldnecklace:{ fur: "#E3C79A", earInner: "#F0A8A0", muzzle: "#F4E4C4", iris: "#6A5238", pattern: "none", mane: "#D8A03F" },
  swirl:       { fur: "#B9A58E", earInner: "#E8A8A8", muzzle: "#DACCB8", iris: "#C97F3C", pattern: "tortie", patternColor: "#8A6E52", patternColor2: "#5A4636" },
  mandarin:    { fur: "#EFA24E", earInner: "#F0A090", muzzle: "#F9D8A8", iris: "#5F9A4F", pattern: "stripes", patternColor: "#D07E2E" },
  cottoncandy: { fur: "#F6E4E6", earInner: "#F0A8B8", muzzle: "#FCF2F2", iris: "#E8B44C", pattern: "none" },
  charcoal:    { fur: "#4A4642", earInner: "#8A7A74", muzzle: "#6E6862", iris: "#E0913F", pattern: "none" },
  maple:       { fur: "#C97F3C", earInner: "#E89890", muzzle: "#E8B888", iris: "#6A8A4F", pattern: "calico", patternColor: "#A34A2A", patternColor2: "#E3B24E" },
  vanilla:     { fur: "#F4E9D2", earInner: "#F5B0B0", muzzle: "#FBF4E6", iris: "#C97F3C", pattern: "none" },
  mocha:       { fur: "#6E5240", earInner: "#B88A80", muzzle: "#967860", iris: "#E8B44C", pattern: "tortie", patternColor: "#8A6E52", patternColor2: "#3E2E22" },
  caramel:     { fur: "#D9A05C", earInner: "#EFA098", muzzle: "#F0D0A0", iris: "#7A5230", pattern: "stripes", patternColor: "#B67F3C" },
  chestnut:    { fur: "#8A5E3E", earInner: "#D09888", muzzle: "#B8906C", iris: "#5F9A4F", pattern: "none" },
  eyebrow:     { fur: "#F2EDE2", earInner: "#F5B0B8", muzzle: "#FFFFFF", iris: "#7A5230", pattern: "calico", patternColor: "#3A3F4B", patternColor2: "#8E93A1" },
  socks:       { fur: "#5A5E6C", earInner: "#C8A0A8", muzzle: "#FFFFFF", iris: "#D8A03F", pattern: "tuxedo", patternColor: "#FFFFFF" },
  necktie:     { fur: "#F4F6F9", earInner: "#F0B0B8", muzzle: "#FFFFFF", iris: "#4F8FD8", pattern: "calico", patternColor: "#2E3240", patternColor2: "#8E93A1" },
  marble:      { fur: "#E8E4DC", earInner: "#E8B0B8", muzzle: "#F4F1EA", iris: "#5FA8D8", pattern: "tortie", patternColor: "#B9B2A6", patternColor2: "#6E6A62" },
  peach:       { fur: "#F6D8C4", earInner: "#F0A090", muzzle: "#FBEADC", iris: "#6A8A4F", pattern: "none" },
  mint:        { fur: "#C9D8D2", earInner: "#E8A8B0", muzzle: "#E4EEEA", iris: "#5F9A4F", pattern: "none" },
  pepper:      { fur: "#D8D2C6", earInner: "#E8A8A8", muzzle: "#EAE6DC", iris: "#E0913F", pattern: "tortie", patternColor: "#4E4A55", patternColor2: "#8A8078" },
  salt:        { fur: "#F8F6F2", earInner: "#E8B8C0", muzzle: "#FFFFFF", iris: "#5FA8D8", pattern: "points", patternColor: "#B9BDC7" },
  lilac:       { fur: "#C9BED2", earInner: "#E8A8C0", muzzle: "#E4DCEC", iris: "#E8B44C", pattern: "none" },
  acorn:       { fur: "#A87E52", earInner: "#E8A098", muzzle: "#D0AE84", iris: "#6A5238", pattern: "stripes", patternColor: "#7E5C38" },
  walnut:      { fur: "#8E6E4E", earInner: "#D0A090", muzzle: "#BC9C78", iris: "#C97F3C", pattern: "none" },
  cherrycat:   { fur: "#F6E8E0", earInner: "#E86A6A", muzzle: "#FCF2EC", iris: "#5FA8D8", pattern: "none" },
  cloudcat:    { fur: "#F2F4F6", earInner: "#E8B8C0", muzzle: "#FFFFFF", iris: "#8A9BB0", pattern: "none" },
  sunsetcat:   { fur: "#E8945A", earInner: "#F0A090", muzzle: "#F6CCA0", iris: "#4F8FD8", pattern: "calico", patternColor: "#D06A4A", patternColor2: "#F2C078" },
  dewdrop:     { fur: "#D8E4E8", earInner: "#E0B0B8", muzzle: "#EEF4F6", iris: "#6FCF97", pattern: "none" },
  mulberry:    { fur: "#6E5A78", earInner: "#B890A8", muzzle: "#98829E", iris: "#E8B44C", pattern: "none" },
  injeolmi:    { fur: "#E8D8B0", earInner: "#F0B0A8", muzzle: "#F4EAD0", iris: "#7A5230", pattern: "none" },
  mugwort:     { fur: "#A8B098", earInner: "#E0A8A8", muzzle: "#CCD2C0", iris: "#C97F3C", pattern: "none" },
  // 레어 확장
  persian:     { fur: "#F2E6D8", earInner: "#F0B0B0", muzzle: "#FBF3E8", iris: "#C97F3C", pattern: "none", mane: "#E8D5BC" },
  mainecoon:   { fur: "#9A7250", earInner: "#E0A098", muzzle: "#C8A480", iris: "#6A8A4F", pattern: "stripes", patternColor: "#74522F", mane: "#B8906A" },
  bengal:      { fur: "#D9A55C", earInner: "#EFA090", muzzle: "#F0D0A0", iris: "#5F9A4F", pattern: "tortie", patternColor: "#6E4A28", patternColor2: "#3E2E1A" },
  desertcat:   { fur: "#D9B87E", earInner: "#EFA898", muzzle: "#EEDBB4", iris: "#E8B44C", pattern: "stripes", patternColor: "#B99358" },
  angora:      { fur: "#FBF9F4", earInner: "#F5C0C8", muzzle: "#FFFFFF", iris: "#5FA8D8", pattern: "none", mane: "#F2EEE6" },
  fold:        { fur: "#B9B2A6", earInner: "#E0A8A8", muzzle: "#D8D2C6", iris: "#C97F3C", pattern: "none" },
  ragdoll:     { fur: "#EDE4D8", earInner: "#D8A8A0", muzzle: "#F6F0E8", iris: "#4F8FD8", pattern: "points", patternColor: "#8A7460" },
  himalayan:   { fur: "#F2E8D8", earInner: "#C09080", muzzle: "#E0C8AC", iris: "#5FA8D8", pattern: "points", patternColor: "#6E523E" },
  jade:        { fur: "#C4CCC4", earInner: "#E0A8B0", muzzle: "#E0E6E0", iris: "#4FC9A0", pattern: "none" },
  amethyst:    { fur: "#8E82A0", earInner: "#C8A0C0", muzzle: "#B4A8C4", iris: "#B87FD8", pattern: "none" },
  pearl:       { fur: "#F4F0EA", earInner: "#F0B8C0", muzzle: "#FFFFFF", iris: "#8A9BB0", pattern: "none" },
  obsidian:    { fur: "#26282E", earInner: "#585C68", muzzle: "#3E424C", iris: "#F2C94C", pattern: "none" },
  blossom:     { fur: "#F8ECEE", earInner: "#F0A8C0", muzzle: "#FEF6F8", iris: "#6A8A4F", pattern: "calico", patternColor: "#F0B8C8", patternColor2: "#E89AB0" },
  frost:       { fur: "#E8EEF2", earInner: "#C8C0D0", muzzle: "#F6FAFC", iris: "#58B8E8", pattern: "stripes", patternColor: "#B8C8D4" },
  fogcat:      { fur: "#B4BCC4", earInner: "#C0A8B8", muzzle: "#D4DAE0", iris: "#F2E29C", pattern: "points", patternColor: "#8A94A0" },
  lighthouse:  { fur: "#2E3240", earInner: "#787C8C", muzzle: "#F4F6F9", iris: "#F2C94C", pattern: "tuxedo", patternColor: "#F4F6F9" },
  aurora:      { fur: "#D8E8E4", earInner: "#C0B8D8", muzzle: "#ECF4F2", iris: "#6FCF97", pattern: "calico", patternColor: "#A8D8C8", patternColor2: "#B8C8E8" },
  starcandy:   { fur: "#F6F2E8", earInner: "#F0B8C8", muzzle: "#FCFAF4", iris: "#E8B44C", pattern: "calico", patternColor: "#F0C8D8", patternColor2: "#B8D0F0" },
  wisp:        { fur: "#3A5A5E", earInner: "#6E9296", muzzle: "#527478", iris: "#7FE8D8", pattern: "none" },
  moonhalo:    { fur: "#C8CEDA", earInner: "#D8B8C8", muzzle: "#E4E8F0", iris: "#F2E29C", pattern: "none", mane: "#E8ECF4" },
  // 레전드 확장
  haetae:      { fur: "#E8D8A8", earInner: "#E0A888", muzzle: "#F4EACC", iris: "#4F8FD8", pattern: "none", mane: "#C9A84C" },
  sansin:      { fur: "#F2F0EA", earInner: "#D8B8B8", muzzle: "#FCFAF6", iris: "#6FCF97", pattern: "none", mane: "#D8D4C8" },
  gumiho:      { fur: "#E8944A", earInner: "#F0B090", muzzle: "#F8D0A8", iris: "#F2C94C", pattern: "none", mane: "#D06A2E" },
  dragonking:  { fur: "#3E6E8E", earInner: "#78A8C0", muzzle: "#5A8CA8", iris: "#7FE8D8", pattern: "stars", patternColor: "#7FD8E8" },
  phoenix:     { fur: "#E85A3A", earInner: "#F0A070", muzzle: "#F8A878", iris: "#F2C94C", pattern: "calico", patternColor: "#F2A03C", patternColor2: "#C93A2A" },
  galaxy:      { fur: "#3A3654", earInner: "#7A70A0", muzzle: "#5A5478", iris: "#B87FD8", pattern: "stars", patternColor: "#C8B8F0" },
  thunder:     { fur: "#5A6274", earInner: "#98A0B4", muzzle: "#828CA0", iris: "#F2E29C", pattern: "stripes", patternColor: "#3E4654" },
  rainbowcat:  { fur: "#F6F4F0", earInner: "#F0B0C0", muzzle: "#FFFFFF", iris: "#6FCF97", pattern: "calico", patternColor: "#F0A8B8", patternColor2: "#A8D8F0" },
  daybreak:    { fur: "#F2D8B8", earInner: "#F0A898", muzzle: "#FAECD8", iris: "#58B8E8", pattern: "none", mane: "#F0B878" },
  guardian:    { fur: "#F4F0E6", earInner: "#E8B8B0", muzzle: "#FCFAF2", iris: "#D8A03F", pattern: "none", mane: "#E8D5A0" },
};

const FALLBACK: SpeciesArt = { fur: "#D8B98A", earInner: "#EFA8A8", muzzle: "#F0E0C8", iris: "#6A5238", pattern: "none" };

/**
 * 종 키 → 치비 고양이 얼굴 SVG 문자열 (viewBox 0 0 100 100).
 * 지도 마커 innerHTML과 React(dangerouslySetInnerHTML) 양쪽에서 사용.
 */
export function speciesArtSvg(speciesKey: string, size: number): string {
  const a = ART[speciesKey] ?? FALLBACK;
  // 한 페이지에 여러 SVG가 공존하므로 clipPath id는 종 키로 고유화
  const clipId = `cc-head-${speciesKey}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${headMarkup(a, clipId)}</svg>`;
}

/**
 * 종 키 → <img src>·캔버스 어디서든 쓸 수 있는 아트 데이터 URL.
 * 실사 사진이 없는 확장 종(No.019~)의 speciesPhotoUrl 폴백 — 앉은 전신 아트에
 * 따뜻한 배경을 깔아 원형 크롭(트레이/포획 화면/도감)에서도 사진처럼 보이게 한다.
 */
export function speciesArtDataUrl(speciesKey: string, size = 200, bg = "#FFF6E4"): string {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="100" height="100" fill="${bg}"/>`
    + speciesArtBodySvg(speciesKey, size).replace(/^<svg[^>]*>/, `<svg width="100" height="100" viewBox="0 0 100 100">`)
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * 종 키 → 앉은 전신 고양이 SVG (viewBox 0 0 100 100) — 다마고치 케어 히어로용.
 * 얼굴은 speciesArtSvg와 동일 마크업을 상단으로 축소 배치하고, 아래에 몸통·꼬리·앞발을 그린다.
 * 팔레트(fur/muzzle/pattern)를 그대로 써서 종 정체성(색·눈·줄무늬)이 유지된다.
 */
export function speciesArtBodySvg(speciesKey: string, size: number): string {
  const a = ART[speciesKey] ?? FALLBACK;
  const clipId = `cc-bodyhead-${speciesKey}`;
  const bodyClip = `cc-body-${speciesKey}`;
  const bodyPath = "M 28 92 Q 18 68 33 53 Q 41 48 50 48 Q 59 48 67 53 Q 82 68 72 92 Q 61 96 50 96 Q 39 96 28 92 Z";
  // 줄무늬 종만 몸통·꼬리에 줄을 얹어 정체성 강화 (나머지는 단색 fur + 배 하이라이트로 충분)
  const bodyStripes = a.pattern === "stripes" ? `
    <g clip-path="url(#${bodyClip})" stroke="${a.patternColor}" stroke-width="4.5" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M 30 64 q 20 -6 40 0"/>
      <path d="M 29 74 q 21 -5 42 0"/>
      <path d="M 30 84 q 20 -4 40 0"/>
    </g>` : "";
  const tailStripes = a.pattern === "stripes" ? `
    <g stroke="${a.patternColor}" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M 85 78 q 4 -1 6 -3"/><path d="M 88 68 q 3 -1 4 -3"/>
    </g>` : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="${bodyClip}"><path d="${bodyPath}"/></clipPath></defs>
    <ellipse cx="50" cy="95.5" rx="29" ry="4.5" fill="black" opacity="0.08"/>
    <!-- 꼬리 (몸 뒤에서 오른쪽으로 말림) -->
    <path d="M 71 88 Q 93 84 89 62 Q 87 52 78 56" fill="none" stroke="${a.fur}" stroke-width="11" stroke-linecap="round"/>
    <path d="M 71 88 Q 93 84 89 62 Q 87 52 78 56" fill="none" stroke="rgba(40,30,30,0.12)" stroke-width="12.6" stroke-linecap="round" opacity="0.35"/>
    <path d="M 71 88 Q 93 84 89 62 Q 87 52 78 56" fill="none" stroke="${a.fur}" stroke-width="11" stroke-linecap="round"/>
    ${tailStripes}
    <!-- 몸통(앉은 엉덩이) -->
    <path d="${bodyPath}" fill="${a.fur}"/>
    <ellipse cx="50" cy="78" rx="14" ry="15" fill="${a.muzzle}" opacity="0.35"/>
    ${bodyStripes}
    <!-- 앞발 -->
    <rect x="39.5" y="73" width="8.5" height="21" rx="4.2" fill="${a.fur}"/>
    <rect x="52" y="73" width="8.5" height="21" rx="4.2" fill="${a.fur}"/>
    <g stroke="rgba(40,30,30,0.13)" stroke-width="1.3" stroke-linecap="round"><path d="M 43.7 89 v 4.5"/><path d="M 56.2 89 v 4.5"/></g>
    <path d="${bodyPath}" fill="none" stroke="rgba(40,30,30,0.13)" stroke-width="2"/>
    <!-- 머리 (얼굴 마크업을 상단으로 축소 배치 — 치비 비율: 머리를 몸보다 크게) -->
    <g transform="translate(15 -6) scale(0.7)">${headMarkup(a, clipId)}</g>
  </svg>`;
}

// 4각 별 — 밤하늘냥 별박이 (headMarkup의 star와 동일 모양, 몸통용 공유 헬퍼)
const starPath = (x: number, y: number, s: number, fill: string) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0,-4 L1.1,-1.1 L4,0 L1.1,1.1 L0,4 L-1.1,1.1 L-4,0 L-1.1,-1.1 Z" fill="${fill}"/>`;

/**
 * 종 키 → 옆모습 걷는 전신 고양이 SVG (지도 로밍 마커용) — 기본은 오른쪽(동쪽) 보기.
 * 이동 방향 반전은 호출측이 컨테이너에 scaleX(-1)를 건다.
 * 얼굴은 headMarkup 공유(정면 치비 — 지도에서도 눈이 마주치는 게 귀여움의 본체),
 * 몸통·다리 4개·꼬리만 옆모습으로 새로 그린다.
 * walking=true면 다리 총총(대각 2쌍 역위상)·꼬리 살랑 CSS 애니메이션이 붙는다
 * (globals.css nyangLegSwing/nyangTailSway). jitter(0..1)는 개체별 주기·위상 분산용.
 * 종별 실루엣 개성: munchkin=숏다리, bobtail=뭉치꼬리, points(샴)=진한 다리·꼬리.
 */
export function speciesArtWalkSvg(
  speciesKey: string, width: number, opts?: { walking?: boolean; jitter?: number },
): string {
  const a = ART[speciesKey] ?? FALLBACK;
  const walking = opts?.walking ?? true;
  const j = opts?.jitter ?? 0;
  const clipId = `cc-walkhead-${speciesKey}`;
  const bodyClip = `cc-walkbody-${speciesKey}`;
  const height = Math.round((width * 96) / 112);

  const short = speciesKey === "munchkin";
  const shift = short ? 8 : 0;              // 숏다리 — 몸을 낮춰 바닥(y=94)은 유지한 채 다리만 짧게
  const legTop = 72 + shift;
  const legLen = 94 - legTop;
  // 샴 포인트 — 다리·꼬리가 진한 색 (귀 안쪽은 headMarkup이 처리)
  const limbFur = a.pattern === "points" && a.patternColor ? a.patternColor : a.fur;

  const legDur = 0.52 + j * 0.14;
  const legStyle = (phase: 0 | 1) =>
    `style="transform-box:fill-box;transform-origin:50% 8%;${walking
      ? `animation:nyangLegSwing ${legDur.toFixed(2)}s ease-in-out ${(-phase * legDur / 2 - j * 0.31).toFixed(2)}s infinite`
      : ""}"`;
  // 대각 걸음: far(반대편) 다리는 살짝 어둡게 눌러 원근을 준다. 턱시도는 흰 양말.
  const leg = (x: number, phase: 0 | 1, far: boolean) => `
    <g ${legStyle(phase)}>
      <rect x="${x}" y="${legTop}" width="7.5" height="${legLen}" rx="3.7" fill="${limbFur}"/>
      ${a.pattern === "tuxedo" ? `<rect x="${x}" y="88" width="7.5" height="6" rx="3" fill="#FFFFFF"/>` : ""}
      ${far ? `<rect x="${x}" y="${legTop}" width="7.5" height="${legLen}" rx="3.7" fill="rgba(30,22,20,0.16)"/>` : ""}
    </g>`;

  const tailSway =
    `transform-box:fill-box;transform-origin:92% 92%;animation:nyangTailSway ${(1.6 + j * 0.8).toFixed(2)}s ease-in-out ${(-j * 1.5).toFixed(2)}s infinite`;
  const tailStripes = a.pattern === "stripes" && a.patternColor ? `
      <g stroke="${a.patternColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M 13 ${47 + shift} l 6 2.5"/><path d="M 11.5 ${40 + shift} l 6 1.5"/>
      </g>` : "";
  const tail = speciesKey === "bobtail"
    ? `<circle cx="26" cy="${54 + shift}" r="7" fill="${limbFur}" stroke="rgba(40,30,30,0.13)" stroke-width="1.8"/>`
    : `<g style="${tailSway}">
      <path d="M 27 ${62 + shift} Q 13 ${54 + shift} 11 ${37 + shift}" fill="none" stroke="${limbFur}" stroke-width="7" stroke-linecap="round"/>
      ${tailStripes}
    </g>`;

  // 몸통(가로 캡슐) + 종별 무늬 — 좌표는 몸통 클립 기준
  const bodyX = 24, bodyY = 50 + shift, bodyW = 54, bodyH = 28;
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
  } else if (a.pattern === "stars" && a.patternColor) {
    bodyPattern = `
      <g clip-path="url(#${bodyClip})" opacity="0.95">
        ${starPath(35, bodyY + 8, 0.8, a.patternColor)}${starPath(52, bodyY + 17, 0.55, a.patternColor)}${starPath(64, bodyY + 7, 0.65, a.patternColor)}
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
    <g transform="translate(50 ${-2 + shift}) scale(0.58)">${headMarkup(a, clipId)}</g>
  </svg>`;
}

/**
 * 내 위치 아바타 — 고양이귀 후드를 쓴 치비 집사 (여성형, PGO식 트레이너 아바타, 기본 오른쪽 보기).
 * 로밍 냥이(speciesArtWalkSvg)와 같은 문법: 정면 얼굴 + 옆모습 몸, 좌우 반전은 호출측 scaleX(-1).
 * 걷기/정지 상태는 마커 루트의 .me-walking 클래스가 제어한다(globals.css) —
 *   .me-legA/.me-legB/.me-armA/.me-armB: 걷는 동안만 총총 스윙 (다리·팔 대각 역위상)
 *   .me-body: 항상 은은한 숨쉬기 (스커트도 같은 그룹 — 하체가 몸통에서 떨어져 보이지 않게)
 * SVG 자체는 상태를 모르는 정적 마크업이라 클래스 토글만으로 걷기↔정지가 전환된다.
 *
 * [계약 유지] viewBox(0 0 72 100)·height 계산식·클래스명 5종·팔레트·레이어 순서는 그대로다.
 * 스커트 밑단(y=79)이 다리 스윙 피벗(y≈74)만 덮고 정강이 이하(79~96)는 노출돼 걷기 모션이
 * 그대로 읽힌다 — 밑단을 더 내리면 스윙이 가려지므로 79 아래로 내리지 말 것.
 */
export function butlerWalkSvg(width: number): string {
  const height = Math.round((width * 100) / 72);
  const HOODIE = "#3182F6", HOODIE_DARK = "#2B6FD4", PANTS = "#2A4A74", SKIN = "#F6D7B8";
  const HAIR = "#6B4A33";
  const OUTLINE = "rgba(40,30,30,0.13)";
  const leg = (x: number, cls: string, far: boolean) => `
    <g class="${cls}">
      <rect x="${x}" y="72" width="6.4" height="19" rx="3.2" fill="${PANTS}"/>
      <rect x="${x - 0.7}" y="89" width="10" height="7" rx="3.4" fill="#F4F6F9" stroke="${OUTLINE}" stroke-width="1.4"/>
      ${far ? `<rect x="${x - 0.7}" y="72" width="10" height="24" rx="3.4" fill="rgba(30,22,20,0.16)"/>` : ""}
    </g>`;
  const arm = (x: number, cls: string, far: boolean) => `
    <g class="${cls}">
      <rect x="${x}" y="50" width="6" height="18" rx="3" fill="${far ? HOODIE_DARK : HOODIE}"/>
      <circle cx="${x + 3}" cy="69" r="3.2" fill="${SKIN}"/>
      ${far ? `<rect x="${x}" y="50" width="6" height="22" rx="3" fill="rgba(30,22,20,0.12)"/>` : ""}
    </g>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 72 100" xmlns="http://www.w3.org/2000/svg">
    ${arm(24.5, "me-armB", true)}
    ${leg(29.5, "me-legA", true)}
    <!-- 몸통: A라인 스커트 + 허리가 살짝 들어간 후드집업 -->
    <g class="me-body">
      <path d="M 28.5 62 L 47.5 62 L 53 79 Q 38 82 23 79 Z" fill="${PANTS}"/>
      <path d="M 33 64 L 30.5 80 M 38 64 v 17 M 43 64 L 45.5 80" stroke="rgba(20,30,50,0.18)" stroke-width="1.2" fill="none"/>
      <path d="M 28.5 62 L 47.5 62 L 53 79 Q 38 82 23 79 Z" fill="none" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 27.6 55 Q 26.2 47.6 32 46 L 44 46 Q 49.8 47.6 48.4 55 L 47.4 70 Q 38 72.6 28.6 70 Z" fill="${HOODIE}"/>
      <path d="M 38 47.5 v 23" stroke="${HOODIE_DARK}" stroke-width="1.8"/>
      <path d="M 31 64 q 7 4.5 14 0" stroke="${HOODIE_DARK}" stroke-width="1.8" fill="none"/>
      <path d="M 35 48 l -1.5 6 M 41 48 l 1.5 6" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>
      <path d="M 27.6 55 Q 26.2 47.6 32 46 L 44 46 Q 49.8 47.6 48.4 55 L 47.4 70 Q 38 72.6 28.6 70 Z" fill="none" stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round"/>
    </g>
    ${leg(39, "me-legB", false)}
    ${arm(44.5, "me-armA", false)}
    <!-- 머리: 긴 머리 + 고양이귀 후드 + 정면 치비 얼굴 -->
    <g>
      <!-- 뒷머리(등 쪽=왼쪽)·앞쪽 옆머리 — 머리통보다 먼저 그려 뒤로 깔린다 -->
      <path d="M 27 16 Q 17 27 16.2 45 Q 15.8 57 21.5 60.5 Q 27.6 57.5 27.9 47 Q 27.2 30 33.5 20 Z" fill="${HAIR}" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 49 19 Q 57.4 28 57.7 43 Q 57.7 51 53.4 53.6 Q 50.8 45 49.6 33 Z" fill="${HAIR}" stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M 25 15 L 20.5 3.5 Q 20 0.5 23.5 2 L 34 8 Z" fill="${HOODIE}" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 51 13 L 56.5 2.5 Q 57.5 -0.5 60 2.5 L 61 9 Q 58 15 52 17 Z" fill="${HOODIE}" stroke="${OUTLINE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M 26.5 12.5 L 23.5 5.5 L 31 9.5 Z" fill="#F5B8C0"/>
      <path d="M 53 11 L 57 4.5 L 57.5 9.5 Z" fill="#F5B8C0"/>
      <circle cx="37" cy="29" r="20" fill="${HOODIE}"/>
      <circle cx="40" cy="30" r="15.5" fill="${SKIN}"/>
      <!-- 앞머리: 가운데 가르마 + 볼까지 내려오는 옆머리 -->
      <path d="M 25.5 27 Q 26.5 15 40 14.6 Q 53 15 54.8 26 Q 49.5 21.8 44 24.4 Q 41 20.4 38.5 24.4 Q 33 21.8 25.5 27 Z" fill="${HAIR}"/>
      <path d="M 25.6 26 Q 23.6 34 25 41 Q 28 38 28.4 30 Z" fill="${HAIR}"/>
      <path d="M 54.6 25.5 Q 56.6 34 55.2 41.5 Q 52.2 38 51.8 30 Z" fill="${HAIR}"/>
      <circle cx="37" cy="29" r="20" fill="none" stroke="${OUTLINE}" stroke-width="2"/>
      <!-- 눈·볼·입 (냥이와 같은 왕눈+하이라이트 문법 — 속눈썹은 넣지 않는다.
           44px 마커에서 뭉개져 찌푸린 눈썹으로 읽히고, 냥이와 공유하는 문법도 깨진다.) -->
      <circle cx="35.5" cy="32" r="2.8" fill="#1E1A22"/><circle cx="34.5" cy="31" r="1" fill="white"/>
      <circle cx="46.5" cy="32" r="2.8" fill="#1E1A22"/><circle cx="45.5" cy="31" r="1" fill="white"/>
      <ellipse cx="31.5" cy="37.5" rx="3.4" ry="2.2" fill="#F09090" opacity="0.5"/>
      <ellipse cx="50" cy="37.5" rx="3.4" ry="2.2" fill="#F09090" opacity="0.5"/>
      <path d="M 38.5 38.5 q 2.5 2.5 5 0" stroke="#8A6A5A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

// 얼굴 마크업(귀·머리·눈·주둥이 등) — 얼굴 전용/전신 양쪽이 공유. viewBox 0 0 100 100 기준.
function headMarkup(a: SpeciesArt, clipId: string): string {

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
  } else if (a.pattern === "stars") {
    const star = (x: number, y: number, s: number) =>
      `<path transform="translate(${x} ${y}) scale(${s})" d="M0,-4 L1.1,-1.1 L4,0 L1.1,1.1 L0,4 L-1.1,1.1 L-4,0 L-1.1,-1.1 Z" fill="${a.patternColor}"/>`;
    pattern = `<g clip-path="url(#${clipId})" opacity="0.95">${star(30, 40, 0.9)}${star(68, 34, 0.7)}${star(58, 46, 0.5)}</g>`;
  }

  // 갈기 (머리 뒤 스캘럽 원)
  const mane = a.mane ? `
    <g fill="${a.mane}">
      ${Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2;
        const x = 50 + Math.cos(ang) * 37;
        const y = 57 + Math.sin(ang) * 34;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>`;
      }).join("")}
    </g>` : "";

  // 주름 (민털냥)
  const wrinkles = a.wrinkles ? `
    <g stroke="#C99880" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8">
      <path d="M 40 32 q 10 -4 20 0"/>
      <path d="M 42 38 q 8 -3 16 0"/>
    </g>` : "";

  const rightIris = a.irisRight ?? a.iris;

  return `
    <defs><clipPath id="${clipId}"><ellipse cx="50" cy="59" rx="35" ry="32"/></clipPath></defs>
    ${mane}
    <!-- 귀 (짧고 둥근 팁 — 뾰족귀보다 아기 비율) -->
    <path d="M 20 45 L 15.5 19 Q 15 13.5 20 15.5 L 44 28 Z" fill="${a.fur}"/>
    <path d="M 80 45 L 84.5 19 Q 85 13.5 80 15.5 L 56 28 Z" fill="${a.fur}"/>
    <path d="M 24 39 L 21 23 L 36.5 30 Z" fill="${a.pattern === "points" ? a.patternColor : a.earInner}"/>
    <path d="M 76 39 L 79 23 L 63.5 30 Z" fill="${a.pattern === "points" ? a.patternColor : a.earInner}"/>
    <!-- 머리 (더 크고 둥글게) -->
    <ellipse cx="50" cy="59" rx="35" ry="32" fill="${a.fur}"/>
    ${pattern}
    ${wrinkles}
    <!-- 셰이딩: 좌상단 하이라이트 + 하단 그림자 + 외곽선 (입체감) -->
    <g clip-path="url(#${clipId})">
      <ellipse cx="37" cy="42" rx="17" ry="9" fill="white" opacity="0.16" transform="rotate(-16 37 42)"/>
      <ellipse cx="50" cy="88" rx="33" ry="13" fill="black" opacity="0.07"/>
    </g>
    <ellipse cx="50" cy="59" rx="35" ry="32" fill="none" stroke="rgba(70,45,38,0.2)" stroke-width="2.2"/>
    <path d="M 20 45 L 15.5 19 Q 15 13.5 20 15.5 L 44 28" fill="none" stroke="rgba(70,45,38,0.18)" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M 80 45 L 84.5 19 Q 85 13.5 80 15.5 L 56 28" fill="none" stroke="rgba(70,45,38,0.18)" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- 주둥이 (작을수록 눈이 커 보인다) -->
    <ellipse cx="50" cy="71" rx="13" ry="8.5" fill="${a.muzzle}" opacity="0.9"/>
    <!-- 눈 (1.3배 왕눈 + 이중 하이라이트 — 귀여움의 본체) -->
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
    <!-- 볼터치 (넓고 은은하게) -->
    <ellipse cx="26.5" cy="66.5" rx="5.6" ry="3.5" fill="#F09090" opacity="0.5"/>
    <ellipse cx="73.5" cy="66.5" rx="5.6" ry="3.5" fill="#F09090" opacity="0.5"/>
    <!-- 코 (둥근 젤리코) + ω입 -->
    <path d="M 47 66.4 L 53 66.4 Q 54.2 66.4 53.5 67.6 L 51 70.2 Q 50 71.2 49 70.2 L 46.5 67.6 Q 45.8 66.4 47 66.4 Z" fill="#E8837A"/>
    <path d="M 50 70.6 q -0.9 3.2 -4.8 2.9 M 50 70.6 q 0.9 3.2 4.8 2.9"
      stroke="#8A6A5A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <!-- 수염 (짧고 얌전하게) -->
    <g stroke="#8A8A8A" stroke-width="1.4" stroke-linecap="round" opacity="0.5">
      <path d="M 20 68 L 12 66.5"/><path d="M 21 73 L 13 74"/>
      <path d="M 80 68 L 88 66.5"/><path d="M 79 73 L 87 74"/>
    </g>`;
}
