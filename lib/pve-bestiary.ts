// 도감(컬렉션) UI용 PVE 로스터 — app/api/cats/card-battle/route.ts의 PVE_ROSTER와
// 표시용 필드(key/name/emoji/traits 등)만 동기화해서 들고 있는 클라이언트 세이프 버전.
// 실제 배틀 스탯/스킬은 서버 전용 route.ts에만 있고 여기엔 없음 — 로스터 종류를
// 추가/변경하면 이 파일도 같이 업데이트해야 함.
export interface BestiaryEntry {
  key: string;
  dexNo: number;       // 포켓몬 도감 스타일 번호 (No.001부터)
  name: string;
  emoji: string;
  photo: boolean;       // public/pve/{key}.jpg 존재 여부
  category: string;     // 포켓몬 도감의 "종" 분류처럼 짧은 한 줄 분류명
  categoryColor: string; // 분류군별 배지 색
  traits: [string, string];
  personality: string;  // 성격 한 줄
  story: string;        // 조우 스토리 — 이겨야(defeated) 도감에서 볼 수 있음
}

const INSECT_COLOR = "#5BA876";
const MAMMAL_COLOR = "#E8935A";
const BIRD_COLOR = "#6FA0D8";
const REPTILE_COLOR = "#8B65B8";
const BOSS_COLOR = "#D85555";

export const PVE_BESTIARY: BestiaryEntry[] = [
  // ── 곤충·벌레류 ──
  { key: "slug", dexNo: 1, name: "민달팽이", emoji: "🐌", photo: true, category: "끈적 달팽이", categoryColor: INSECT_COLOR,
    traits: ["끈적한 점액", "느릿느릿 전진"], personality: "유유자적",
    story: "화단 돌 밑에 살며 비 오는 날에만 슬며시 기어나와 은빛 자국을 남기고 사라진다." },
  { key: "mosquito", dexNo: 2, name: "모기", emoji: "🦟", photo: true, category: "흡혈 곤충", categoryColor: INSECT_COLOR,
    traits: ["앵앵 소리", "따끔한 침"], personality: "집요함",
    story: "여름밤 방충망 틈을 귀신같이 찾아내 잠든 사이 몰래 다가온다." },
  { key: "fly", dexNo: 3, name: "파리", emoji: "🪰", photo: true, category: "성가신 곤충", categoryColor: INSECT_COLOR,
    traits: ["잽싼 날갯짓", "성가신 맴돌기"], personality: "눈치없음",
    story: "밥상만 차리면 어디선가 나타나 빙빙 돌며 신경을 긁는다." },
  { key: "spider", dexNo: 4, name: "거미", emoji: "🕷️", photo: true, category: "은둔 사냥꾼", categoryColor: INSECT_COLOR,
    traits: ["거미줄 치기", "살금살금 접근"], personality: "은둔형",
    story: "창고 구석에 조용히 집을 짓고 지내다 인기척에 화들짝 몸을 숨긴다." },
  { key: "ant", dexNo: 5, name: "개미", emoji: "🐜", photo: true, category: "군집 곤충", categoryColor: INSECT_COLOR,
    traits: ["떼로 몰려오기", "작은 턱"], personality: "단체행동",
    story: "과자 부스러기 냄새를 맡으면 순식간에 줄지어 몰려온다." },
  { key: "roach", dexNo: 6, name: "바퀴벌레", emoji: "🪳", photo: true, category: "생존 곤충", categoryColor: INSECT_COLOR,
    traits: ["잽싼 발놀림", "깜짝 도주"], personality: "생존왕",
    story: "불을 켜는 순간 번개같이 틈새로 사라지는 베테랑 생존자." },
  { key: "centipede", dexNo: 7, name: "지네", emoji: "🐛", photo: true, category: "다족 침입자", categoryColor: INSECT_COLOR,
    traits: ["다리 많은 질주", "독니 물기"], personality: "예민함",
    story: "장마철 돌 틈에서 스멀스멀 기어나와 마주치면 서로 놀란다." },
  { key: "wasp", dexNo: 8, name: "말벌", emoji: "🐝", photo: true, category: "호전 곤충", categoryColor: INSECT_COLOR,
    traits: ["따끔한 침", "윙윙 위협"], personality: "호전적",
    story: "처마 밑에 집을 짓고 누구든 다가오면 사정없이 경고한다." },

  // ── 포유류 ──
  { key: "mouse", dexNo: 9, name: "생쥐", emoji: "🐭", photo: true, category: "소심 설치류", categoryColor: MAMMAL_COLOR,
    traits: ["살금살금", "작은 이빨"], personality: "소심함",
    story: "밤이 되면 찬장 밑에서 몰래 나와 부스러기를 물고 사라진다." },
  { key: "mole", dexNo: 10, name: "두더지", emoji: "🕳️", photo: true, category: "땅굴 기습꾼", categoryColor: MAMMAL_COLOR,
    traits: ["땅굴 기습", "억센 앞발"], personality: "은근한 고집",
    story: "화단 밑에 미로 같은 굴을 파놓고 아무도 모르게 드나든다." },
  { key: "rat", dexNo: 11, name: "쥐", emoji: "🐀", photo: true, category: "억척 설치류", categoryColor: MAMMAL_COLOR,
    traits: ["날카로운 이빨", "질긴 생명력"], personality: "억척스러움",
    story: "하수구와 골목을 오가며 어떤 환경에서도 억척스럽게 살아남는다." },
  { key: "deer", dexNo: 12, name: "고라니", emoji: "🦌", photo: true, category: "돌발 복병", categoryColor: MAMMAL_COLOR,
    traits: ["껑충 도약", "숨겨진 송곳니"], personality: "예측불가",
    story: "야산 근처 도로로 불쑥 튀어나와 지나가던 이들을 깜짝 놀라게 한다." },
  { key: "marten", dexNo: 13, name: "담비", emoji: "🦫", photo: true, category: "곡예 사냥꾼", categoryColor: MAMMAL_COLOR,
    traits: ["날쌘 도약", "예리한 이빨"], personality: "민첩함",
    story: "나뭇가지 사이를 곡예하듯 넘나들며 순식간에 먹이를 노린다." },
  { key: "weasel", dexNo: 14, name: "족제비", emoji: "🐿️", photo: true, category: "야행 침입자", categoryColor: MAMMAL_COLOR,
    traits: ["날렵한 몸놀림", "기습 발톱"], personality: "야행성",
    story: "해가 지면 슬그머니 나타나 그림자처럼 골목을 누빈다." },
  { key: "badger", dexNo: 15, name: "오소리", emoji: "🦡", photo: true, category: "뚝심 굴착꾼", categoryColor: MAMMAL_COLOR,
    traits: ["억센 발톱", "질긴 가죽"], personality: "뚝심",
    story: "산기슭을 파헤치며 웬만한 위협에는 눈 하나 깜짝 안 한다." },
  { key: "raccoon", dexNo: 16, name: "너구리", emoji: "🦝", photo: true, category: "뻔뻔 침입자", categoryColor: MAMMAL_COLOR,
    traits: ["묵직한 몸통박치기", "날카로운 발톱"], personality: "뻔뻔함",
    story: "밤마다 동네 쓰레기통을 순찰하듯 뒤지고 다니는 단골손님." },
  { key: "boar", dexNo: 17, name: "멧돼지", emoji: "🐗", photo: true, category: "저돌 돌진꾼", categoryColor: MAMMAL_COLOR,
    traits: ["묵직한 돌진", "날카로운 엄니"], personality: "저돌적",
    story: "먹이를 찾아 산에서 마을까지 내려와 마주치면 절대 물러서지 않는다." },

  // ── 조류 ──
  { key: "pigeon", dexNo: 18, name: "비둘기", emoji: "🐦", photo: true, category: "뻔뻔 텃새", categoryColor: BIRD_COLOR,
    traits: ["푸드덕 날갯짓", "부리 쪼기"], personality: "뻔뻔함",
    story: "사람이 지나가도 눈 하나 깜짝 안 하고 전깃줄 위를 지키고 있다." },
  { key: "crow", dexNo: 19, name: "까마귀", emoji: "🐦‍⬛", photo: true, category: "영악 조류", categoryColor: BIRD_COLOR,
    traits: ["약 올리는 울음", "급강하 공격"], personality: "영악함",
    story: "머리가 좋아 빈틈을 귀신같이 노리고 약 올리듯 울어댄다." },
  { key: "hawk", dexNo: 20, name: "황조롱이", emoji: "🦅", photo: true, category: "냉철 맹금", categoryColor: BIRD_COLOR,
    traits: ["급강하 발톱", "매서운 눈매"], personality: "냉철함",
    story: "전봇대 꼭대기에서 조용히 지켜보다 눈 깜짝할 새 급강하한다." },
  { key: "owl", dexNo: 21, name: "부엉이", emoji: "🦉", photo: true, category: "밤의 사냥꾼", categoryColor: BIRD_COLOR,
    traits: ["소리 없는 비행", "매서운 눈빛"], personality: "고요한 위압감",
    story: "밤이 깊으면 소리 없이 날아와 나뭇가지 위에서 형형한 눈으로 내려다본다." },

  // ── 파충류 ──
  { key: "snake", dexNo: 22, name: "뱀", emoji: "🐍", photo: true, category: "서늘 매복꾼", categoryColor: REPTILE_COLOR,
    traits: ["스르륵 접근", "독니 물기"], personality: "서늘함",
    story: "담벼락 틈에서 스르륵 미끄러져 나와 순식간에 거리를 좁힌다." },
];

export const PVE_BOSS: BestiaryEntry = {
  key: "boss", dexNo: 23, name: "고양이학대범", emoji: "😾", photo: true, category: "진짜 빌런", categoryColor: BOSS_COLOR,
  traits: ["그물 던지기", "위협하기"], personality: "비열함",
  story: "동네를 어슬렁대며 무고한 고양이들을 위협하는 진짜 빌런. 반드시 혼쭐을 내줘야 한다.",
};

export function bestiaryPhotoUrl(entry: BestiaryEntry): string | null {
  if (!entry.photo) return null;
  if (entry.key === "boss") return "/boss/villain-card.jpg";
  return `/pve/${entry.key}.jpg`;
}

export function dexNoLabel(n: number): string {
  return `No.${String(n).padStart(3, "0")}`;
}

// ── 도감 기록 (서버 전용) ──
// PVE 배틀 결과 처리 라우트 2곳(자동/수동)에서 완전히 동일한 로직이 복붙돼 있던 걸
// 여기 하나로 뽑음. box/supabase_pve_bestiary_migration.sql 실행 전이면 profiles에
// 컬럼이 없어 실패하는데, 그 실패는 호출부에서 try/catch로 감싸서 코인/경험치 같은
// 핵심 보상 로직에 영향 안 주게 한다(이 함수 자체는 에러를 그냥 던짐).
// svc 타입은 호출부(route.ts)의 service-role 클라이언트 제네릭이 복잡해서 구조적으로만
// 느슨하게 받는다 — 실제로는 항상 @supabase/supabase-js의 SupabaseClient가 들어옴.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordPveEncounter(
  svc: any,
  userId: string,
  opponentId: string,
  isBossEncounter: boolean,
  won: boolean,
): Promise<void> {
  const pveKey = isBossEncounter ? "boss" : opponentId.replace(/^pve-/, "");
  if (!pveKey) return;
  const { data } = await svc.from("profiles").select("pve_seen_keys,pve_defeated_keys").eq("id", userId).maybeSingle();
  const row = data as { pve_seen_keys?: string[]; pve_defeated_keys?: string[] } | null;
  const seenSet = new Set(row?.pve_seen_keys ?? []);
  const defeatedSet = new Set(row?.pve_defeated_keys ?? []);
  seenSet.add(pveKey);
  if (won) defeatedSet.add(pveKey);
  const { error } = await svc.from("profiles").update({ pve_seen_keys: Array.from(seenSet), pve_defeated_keys: Array.from(defeatedSet) }).eq("id", userId);
  if (error) throw error;
}
