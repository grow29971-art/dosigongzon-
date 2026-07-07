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
