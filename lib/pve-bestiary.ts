// 도감(컬렉션) UI용 PVE 로스터 — app/api/cats/card-battle/route.ts의 PVE_ROSTER와
// 표시용 필드(key/name/emoji)만 동기화해서 들고 있는 클라이언트 세이프 버전.
// 실제 배틀 스탯/스킬은 서버 전용 route.ts에만 있고 여기엔 없음 — 로스터 종류를
// 추가/변경하면 이 파일도 같이 업데이트해야 함.
export interface BestiaryEntry {
  key: string;
  name: string;
  emoji: string;
  photo: boolean; // public/pve/{key}.jpg 존재 여부
}

export const PVE_BESTIARY: BestiaryEntry[] = [
  { key: "mosquito",  name: "모기",    emoji: "🦟", photo: true },
  { key: "fly",       name: "파리",    emoji: "🪰", photo: true },
  { key: "centipede", name: "지네",    emoji: "🐛", photo: true },
  { key: "slug",      name: "민달팽이", emoji: "🐌", photo: true },
  { key: "ant",       name: "개미",    emoji: "🐜", photo: true },
  { key: "roach",     name: "바퀴벌레", emoji: "🪳", photo: true },
  { key: "mouse",     name: "생쥐",    emoji: "🐭", photo: true },
  { key: "rat",       name: "쥐",      emoji: "🐀", photo: true },
  { key: "mole",      name: "두더지",  emoji: "🕳️", photo: true },
  { key: "deer",      name: "고라니",  emoji: "🦌", photo: true },
  { key: "marten",    name: "담비",    emoji: "🦫", photo: true },
  { key: "weasel",    name: "족제비",  emoji: "🐿️", photo: true },
  { key: "badger",    name: "오소리",  emoji: "🦡", photo: true },
  { key: "raccoon",   name: "너구리",  emoji: "🦝", photo: true },
  { key: "boar",      name: "멧돼지",  emoji: "🐗", photo: true },
  { key: "pigeon",    name: "비둘기",  emoji: "🐦", photo: true },
  { key: "crow",      name: "까마귀",  emoji: "🐦‍⬛", photo: true },
  { key: "hawk",      name: "황조롱이", emoji: "🦅", photo: true },
  { key: "owl",       name: "부엉이",  emoji: "🦉", photo: true },
  { key: "snake",     name: "뱀",      emoji: "🐍", photo: true },
  { key: "wasp",      name: "말벌",    emoji: "🐝", photo: true },
  { key: "spider",    name: "거미",    emoji: "🕷️", photo: true },
];

export const PVE_BOSS: BestiaryEntry = { key: "boss", name: "고양이학대범", emoji: "😾", photo: true };

export function bestiaryPhotoUrl(entry: BestiaryEntry): string | null {
  if (!entry.photo) return null;
  if (entry.key === "boss") return "/boss/villain-card.jpg";
  return `/pve/${entry.key}.jpg`;
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
