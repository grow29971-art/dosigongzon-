// 야생 고양이 스폰 종 카탈로그 — 클라이언트 세이프 (지도 마커·포획 화면·도감 공용).
//
// 냥줍의 카드는 실제 고양이 사진이 아니라 "종(species)" 기반 가상 고양이다.
// 도시공존과 달리 실물 등록 전제가 없으므로, 여기 정의된 종 풀에서 스폰이 생성되고
// 포획 시 species_key가 cards.species_key로 저장된다. 종을 추가하면 도감도 같이 늘어난다.
//
// 이미지 에셋 없이 이모지로 시작 — 나중에 일러스트가 생기면 photo 필드를 켜는 방식
// (lib/pve-bestiary.ts의 photo/bestiaryPhotoUrl 패턴과 동일).

import type { GradeKey } from "@/lib/cat-grade-rules"; // 냥줍과 동일 계보 — city 기존 모듈 재사용 (2026-08-04 catch 이식)
import { speciesArtDataUrl } from "@/lib/catch/species-art";

export interface SpawnSpecies {
  key: string;
  dexNo: number;        // 도감 번호 (No.001부터, PVE 도감과 별도 시리즈)
  name: string;
  emoji: string;
  rarity: GradeKey;
  category: string;     // 도감 분류 한 줄
  categoryColor: string;
  traits: [string, string];
  flavor: string;       // 카드 플레이버 텍스트
}

const COMMON_COLOR = "#8B9DAF";
const UNCOMMON_COLOR = "#5BA876";
const RARE_COLOR = "#6F8FD8";
const LEGENDARY_COLOR = "#D8A03F";

export const SPAWN_SPECIES: SpawnSpecies[] = [
  // ── 일반 (common) — 동네 어디서나 ──
  { key: "cheese", dexNo: 1, name: "치즈냥", emoji: "🐈", rarity: "common", category: "동네 터줏대감", categoryColor: COMMON_COLOR,
    traits: ["햇볕 낮잠", "밥그릇 사수"], flavor: "담벼락 위에서 해바라기하는 게 하루 일과. 치즈색 털이 트레이드마크다." },
  { key: "mackerel", dexNo: 2, name: "고등어냥", emoji: "🐈‍⬛", rarity: "common", category: "줄무늬 순찰대", categoryColor: COMMON_COLOR,
    traits: ["살금살금 순찰", "잽싼 발놀림"], flavor: "고등어 등처럼 진한 줄무늬. 골목 순찰을 하루도 거르지 않는다." },
  { key: "tuxedo", dexNo: 3, name: "턱시도냥", emoji: "🐱", rarity: "common", category: "정장 신사", categoryColor: COMMON_COLOR,
    traits: ["우아한 걸음", "냉정한 응시"], flavor: "흰 셔츠에 검은 정장을 차려입은 듯한 무늬. 늘 격식을 차린다." },
  { key: "allblack", dexNo: 4, name: "까망냥", emoji: "🐈‍⬛", rarity: "common", category: "그림자 요원", categoryColor: COMMON_COLOR,
    traits: ["그림자 은신", "야간 시력"], flavor: "밤이 되면 어둠에 완전히 녹아든다. 반짝이는 눈만 보인다." },
  { key: "allwhite", dexNo: 5, name: "하양냥", emoji: "🐱", rarity: "common", category: "새하얀 결벽가", categoryColor: COMMON_COLOR,
    traits: ["꼼꼼한 그루밍", "도도한 외면"], flavor: "티끌 하나 용납 못 하는 결벽가. 하루의 절반을 그루밍에 쓴다." },
  { key: "graytabby", dexNo: 6, name: "회색냥", emoji: "🐈", rarity: "common", category: "무던한 이웃", categoryColor: COMMON_COLOR,
    traits: ["무던한 성격", "묵직한 앉기"], flavor: "웬만한 소란에는 눈도 깜빡 안 하는 대인배. 앉은 자리가 곧 자기 자리다." },

  // ── 고급 (uncommon) — 조금 드문 무늬 ──
  { key: "calico", dexNo: 7, name: "삼색냥", emoji: "🐈", rarity: "uncommon", category: "행운의 삼색", categoryColor: UNCOMMON_COLOR,
    traits: ["행운 부르기", "변덕 부리기"], flavor: "세 가지 색을 한 몸에 지닌 행운의 상징. 기분도 세 가지쯤 된다." },
  { key: "tortie", dexNo: 8, name: "카오스냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "혼돈의 무늬", categoryColor: UNCOMMON_COLOR,
    traits: ["예측불가 돌진", "변화무쌍"], flavor: "검정과 주황이 뒤섞인 무늬처럼 성격도 한 치 앞을 알 수 없다." },
  { key: "oddeye", dexNo: 9, name: "오드아이냥", emoji: "🐱", rarity: "uncommon", category: "두 빛깔 눈동자", categoryColor: UNCOMMON_COLOR,
    traits: ["홀리는 눈빛", "신비한 응시"], flavor: "왼쪽과 오른쪽 눈 색이 다르다. 마주치면 한참을 바라보게 된다." },
  { key: "munchkin", dexNo: 10, name: "숏다리냥", emoji: "🐈", rarity: "uncommon", category: "짧은 다리 질주자", categoryColor: UNCOMMON_COLOR,
    traits: ["의외의 스피드", "귀여움 어필"], flavor: "다리는 짧지만 달리기 시작하면 아무도 못 잡는다." },
  { key: "bobtail", dexNo: 11, name: "동그리꼬리냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "복슬 꼬리 요정", categoryColor: UNCOMMON_COLOR,
    traits: ["꼬리 뽐내기", "폴짝 도약"], flavor: "토끼처럼 동그란 꼬리가 매력 포인트. 걸을 때마다 씰룩거린다." },

  // ── 레어 (rare) — 만나기 어려운 아이들 ──
  { key: "russianblue", dexNo: 12, name: "은빛냥", emoji: "🐈", rarity: "rare", category: "은빛 귀족", categoryColor: RARE_COLOR,
    traits: ["우아한 도약", "서늘한 눈매"], flavor: "달빛을 받으면 털이 은색으로 빛난다. 쉽게 곁을 내주지 않는다." },
  { key: "siamese", dexNo: 13, name: "샴냥", emoji: "🐱", rarity: "rare", category: "푸른 눈 감시자", categoryColor: RARE_COLOR,
    traits: ["꿰뚫는 시선", "수다스런 울음"], flavor: "사파이어처럼 푸른 눈으로 모든 걸 지켜본다. 할 말은 꼭 하는 성격." },
  { key: "norwegian", dexNo: 14, name: "숲냥", emoji: "🐈‍⬛", rarity: "rare", category: "북풍의 장모", categoryColor: RARE_COLOR,
    traits: ["풍성한 갈기", "혹한 견디기"], flavor: "겨울바람 속에서도 끄떡없는 풍성한 털. 나무 타기의 달인이다." },
  { key: "sphynx", dexNo: 15, name: "민털냥", emoji: "🐱", rarity: "rare", category: "맨살의 현자", categoryColor: RARE_COLOR,
    traits: ["따뜻한 체온", "주름진 통찰"], flavor: "털이 없어 더 따뜻하다. 주름진 얼굴에 세상 이치를 다 아는 표정." },

  // ── 레전드 (legendary) — 전설로만 전해지는 ──
  { key: "goldenking", dexNo: 16, name: "황금냥", emoji: "🦁", rarity: "legendary", category: "황금 갈기 제왕", categoryColor: LEGENDARY_COLOR,
    traits: ["제왕의 포효", "황금 갈기"], flavor: "동네 고양이들의 왕. 황금빛 갈기를 본 사람은 손에 꼽는다." },
  { key: "snowspirit", dexNo: 17, name: "설산냥", emoji: "🐯", rarity: "legendary", category: "설산의 정령", categoryColor: LEGENDARY_COLOR,
    traits: ["눈보라 부르기", "서리 발톱"], flavor: "첫눈 오는 날에만 나타난다는 전설의 흰 호랑이 무늬 고양이." },
  { key: "nightlord", dexNo: 18, name: "밤하늘냥", emoji: "🐈‍⬛", rarity: "legendary", category: "별빛 방랑자", categoryColor: LEGENDARY_COLOR,
    traits: ["별빛 도약", "밤하늘 은신"], flavor: "털에 별이 박혀 있다는 소문이 있다. 자정 넘어서만 목격된다." },

  // ═══ 대확장 100종 (2026-07-24) — No.019~118. 사진 에셋 없이 SVG 아트만으로 추가
  //     (speciesPhotoUrl이 아트 데이터 URL로 폴백). 팔레트는 lib/species-art.ts ART에 1:1 대응. ═══

  // ── 일반 확장 (No.019~058) — 동네의 얼굴들 ──
  { key: "milk", dexNo: 19, name: "우유냥", emoji: "🐱", rarity: "common", category: "하얀 우유 한 컵", categoryColor: COMMON_COLOR,
    traits: ["우유 사수", "혀로 찍먹"], flavor: "그릇의 우유는 다 제 것인 줄 안다. 입가에 흰 수염 자국이 늘 남아 있다." },
  { key: "latte", dexNo: 20, name: "라떼냥", emoji: "🐈", rarity: "common", category: "고소한 라떼 무늬", categoryColor: COMMON_COLOR,
    traits: ["카페 앞 죽치기", "향기 감별"], flavor: "카페 문 앞을 지키면 단골들이 인사를 건넨다. 털색이 딱 라떼 거품색." },
  { key: "mochi", dexNo: 21, name: "콩떡냥", emoji: "🐱", rarity: "common", category: "말랑 콩떡", categoryColor: COMMON_COLOR,
    traits: ["말랑 볼살", "슬로우 걸음"], flavor: "만지면 콩떡처럼 말랑하다는 소문. 본인은 근육이라고 주장한다." },
  { key: "sparrow", dexNo: 22, name: "참새냥", emoji: "🐈", rarity: "common", category: "참새 친구", categoryColor: COMMON_COLOR,
    traits: ["참새 관찰", "지붕 점프"], flavor: "참새를 쫓는 게 아니라 같이 논다. 참새들도 이제 안 도망간다." },
  { key: "dawnfog", dexNo: 23, name: "새벽냥", emoji: "🐈‍⬛", rarity: "common", category: "새벽 산책자", categoryColor: COMMON_COLOR,
    traits: ["첫차 배웅", "이슬 밟기"], flavor: "첫차 기사님과 눈인사하는 사이. 늘 새벽 공기 냄새가 난다." },
  { key: "alleyboss", dexNo: 24, name: "골목대장냥", emoji: "🐈", rarity: "common", category: "골목의 대장", categoryColor: COMMON_COLOR,
    traits: ["구역 순찰", "보스 앉기"], flavor: "이 골목 밥그릇 서열 1위. 그런데 강아지가 오면 제일 먼저 숨는다." },
  { key: "churuthief", dexNo: 25, name: "츄르도둑냥", emoji: "🐱", rarity: "common", category: "츄르 전문 털이범", categoryColor: COMMON_COLOR,
    traits: ["소리 없는 접근", "순간 낚아채기"], flavor: "츄르 뜯는 소리가 나면 이미 옆에 와 있다. 범행 후엔 시치미의 달인." },
  { key: "boots", dexNo: 26, name: "장화냥", emoji: "🐈‍⬛", rarity: "common", category: "하얀 장화 신사", categoryColor: COMMON_COLOR,
    traits: ["진흙길 활보", "발도장 찍기"], flavor: "네 발만 새하얘서 장화를 신은 것 같다. 진흙길을 걸어도 장화는 안 더러워진다는 전설." },
  { key: "chonk", dexNo: 27, name: "뚱냥", emoji: "🐈", rarity: "common", category: "동네 최중량", categoryColor: COMMON_COLOR,
    traits: ["밥그릇 두 개", "묵직한 존재감"], flavor: "수의사 선생님이 다이어트를 권했지만 온 동네가 밥을 준다." },
  { key: "punch", dexNo: 28, name: "냥냥펀치냥", emoji: "🐱", rarity: "common", category: "속사포 펀치", categoryColor: COMMON_COLOR,
    traits: ["잽 연타", "반사신경"], flavor: "펀치가 눈에 안 보인다. 맞아도 하나도 안 아픈 게 함정." },
  { key: "breadloaf", dexNo: 29, name: "식빵냥", emoji: "🐈", rarity: "common", category: "완벽한 식빵", categoryColor: COMMON_COLOR,
    traits: ["식빵 자세 8시간", "미동 없음"], flavor: "앞발을 완벽히 접은 식빵 자세의 장인. 갓 구운 식빵보다 노릇하다." },
  { key: "nap", dexNo: 30, name: "낮잠냥", emoji: "🐱", rarity: "common", category: "낮잠 마스터", categoryColor: COMMON_COLOR,
    traits: ["아무 데서나 취침", "기지개 예술"], flavor: "하루 20시간 수면을 지향한다. 나머지 4시간도 대부분 졸고 있다." },
  { key: "scratcher", dexNo: 31, name: "스크래처냥", emoji: "🐈", rarity: "common", category: "발톱 조각가", categoryColor: COMMON_COLOR,
    traits: ["전신주 관리", "발톱 갈기"], flavor: "동네 전신주마다 이 냥이의 작품이 남아 있다. 소파는 참아 준다." },
  { key: "tsundere", dexNo: 32, name: "츤데레냥", emoji: "🐱", rarity: "common", category: "새침한 밀당", categoryColor: COMMON_COLOR,
    traits: ["다가오면 도망", "떠나면 따라옴"], flavor: "부르면 안 오고 무시하면 따라온다. 그게 매력이라는 걸 본인도 안다." },
  { key: "doorcat", dexNo: 33, name: "문앞냥", emoji: "🐈‍⬛", rarity: "common", category: "현관 마중이", categoryColor: COMMON_COLOR,
    traits: ["발소리 구분", "문 앞 대기"], flavor: "골목 사람들 발소리를 다 구분한다. 챙겨주는 사람 앞에서만 벌러덩." },
  { key: "boxcat", dexNo: 34, name: "상자냥", emoji: "🐈", rarity: "common", category: "상자 감정사", categoryColor: COMMON_COLOR,
    traits: ["상자 안 착석", "사이즈 무시"], flavor: "골판지 상자를 보면 일단 들어간다. 몸보다 작아도 어떻게든 들어간다." },
  { key: "piggy", dexNo: 35, name: "어부바냥", emoji: "🐱", rarity: "common", category: "무등 애호가", categoryColor: COMMON_COLOR,
    traits: ["어깨 점프", "높은 곳 독차지"], flavor: "앉아 있으면 어깨로 뛰어올라온다. 내려올 생각은 없다." },
  { key: "whiskers", dexNo: 36, name: "수염냥", emoji: "🐈", rarity: "common", category: "은빛 수염 어르신", categoryColor: COMMON_COLOR,
    traits: ["느긋한 순찰", "젊은 냥이 훈수"], flavor: "유난히 길고 흰 수염이 트레이드마크. 골목 냥이들의 고민 상담소." },
  { key: "backalley", dexNo: 37, name: "뒷골목냥", emoji: "🐈‍⬛", rarity: "common", category: "그늘의 방랑자", categoryColor: COMMON_COLOR,
    traits: ["소리 없는 이동", "벽 타기"], flavor: "낮에도 그늘로만 다닌다. 사실 낯을 많이 가릴 뿐이다." },
  { key: "morning", dexNo: 38, name: "아침냥", emoji: "🐱", rarity: "common", category: "아침형 냥이", categoryColor: COMMON_COLOR,
    traits: ["아침 6시 기상", "창가 해바라기"], flavor: "해 뜨면 정확히 일어나 온 동네를 깨운다. 본인은 다시 잔다." },
  { key: "raindrop", dexNo: 39, name: "빗물냥", emoji: "🐈", rarity: "common", category: "비 오는 날의 산책자", categoryColor: COMMON_COLOR,
    traits: ["처마 밑 감상", "물웅덩이 응시"], flavor: "비 오는 날 처마 밑에서 빗줄기를 하염없이 바라본다. 감성파다." },
  { key: "button", dexNo: 40, name: "단추냥", emoji: "🐱", rarity: "common", category: "단추 무늬", categoryColor: COMMON_COLOR,
    traits: ["단추 수집", "반짝이 애호"], flavor: "가슴팍에 단추 같은 점이 세 개 나란히 있다. 떨어진 단추를 물어온다." },
  { key: "aegyo", dexNo: 41, name: "재롱냥", emoji: "🐈", rarity: "common", category: "재롱 만점", categoryColor: COMMON_COLOR,
    traits: ["배 보이기", "꼬리 하트"], flavor: "시선이 모이면 재롱 스위치가 켜진다. 박수 받으면 두 배로 한다." },
  { key: "yawn", dexNo: 42, name: "하품냥", emoji: "🐱", rarity: "common", category: "전염성 하품", categoryColor: COMMON_COLOR,
    traits: ["세상 큰 하품", "눈물 찔끔"], flavor: "하품이 어찌나 큰지 보는 사람도 따라 하게 된다. 하루의 절반이 하품." },
  { key: "kneady", dexNo: 43, name: "꾹꾹이냥", emoji: "🐈", rarity: "common", category: "반죽의 장인", categoryColor: COMMON_COLOR,
    traits: ["무릎 반죽", "리듬 꾹꾹"], flavor: "폭신한 것만 보면 앞발로 반죽을 시작한다. 제빵사 전생설이 있다." },
  { key: "furball", dexNo: 44, name: "털뭉치냥", emoji: "🐱", rarity: "common", category: "굴러다니는 털뭉치", categoryColor: COMMON_COLOR,
    traits: ["몸단장 대충", "바람에 날림"], flavor: "어디까지가 몸이고 어디부터가 털인지 아무도 모른다." },
  { key: "bell", dexNo: 45, name: "방울냥", emoji: "🐈", rarity: "common", category: "딸랑딸랑", categoryColor: COMMON_COLOR,
    traits: ["방울 소리 내기", "목걸이 자랑"], flavor: "누가 달아줬는지 모를 방울 목걸이가 잘 어울린다. 몰래 다니기는 포기했다." },
  { key: "rooftop", dexNo: 46, name: "지붕냥", emoji: "🐈‍⬛", rarity: "common", category: "지붕 위 감시자", categoryColor: COMMON_COLOR,
    traits: ["지붕 릴레이", "높은 곳 낮잠"], flavor: "지붕에서 지붕으로 건너다니며 동네를 내려다본다. 내려오는 법은 까먹었다." },
  { key: "wallcat", dexNo: 47, name: "담벼락냥", emoji: "🐈", rarity: "common", category: "담벼락 워커", categoryColor: COMMON_COLOR,
    traits: ["외줄 걷기", "균형 감각"], flavor: "좁은 담벼락 위를 런웨이처럼 걷는다. 떨어진 적은 비밀이다." },
  { key: "flowerbed", dexNo: 48, name: "화단냥", emoji: "🐱", rarity: "common", category: "화단 지킴이", categoryColor: COMMON_COLOR,
    traits: ["꽃냄새 맡기", "나비 관찰"], flavor: "꽃을 꺾지 않고 냄새만 맡는 신사. 나비와는 서로 못 본 척하는 사이." },
  { key: "groomer", dexNo: 49, name: "그루밍냥", emoji: "🐈", rarity: "common", category: "윤기 대장", categoryColor: COMMON_COLOR,
    traits: ["3시간 그루밍", "완벽한 털결"], flavor: "털 한 올도 흐트러지는 걸 못 참는다. 빗질은 사양, 셀프가 원칙." },
  { key: "purr", dexNo: 50, name: "골골송냥", emoji: "🐱", rarity: "common", category: "골골송 가수", categoryColor: COMMON_COLOR,
    traits: ["저음 골골", "무릎 독차지"], flavor: "골골송 볼륨이 남다르다. 무릎에 올라오면 잠들 때까지 못 일어난다." },
  { key: "slurp", dexNo: 51, name: "츄릅냥", emoji: "🐈", rarity: "common", category: "츄릅 소리 장인", categoryColor: COMMON_COLOR,
    traits: ["밥그릇 광내기", "입맛 다시기"], flavor: "밥 먹는 소리가 유난히 맛있게 들린다. 옆에서 보면 나도 배고파진다." },
  { key: "bellyup", dexNo: 52, name: "발라당냥", emoji: "🐱", rarity: "common", category: "발라당 전문", categoryColor: COMMON_COLOR,
    traits: ["배 보이며 뒹굴", "함정 카드"], flavor: "배를 보여주지만 만지면 냥냥펀치. 그래도 또 속게 된다." },
  { key: "toasty", dexNo: 53, name: "꼬순내냥", emoji: "🐈", rarity: "common", category: "꼬순내 제조기", categoryColor: COMMON_COLOR,
    traits: ["발바닥 꼬순내", "이불 파고들기"], flavor: "발에서 갓 구운 과자 냄새가 난다는 소문. 맡아본 사람만 안다." },
  { key: "tunacan", dexNo: 54, name: "참치캔냥", emoji: "🐈", rarity: "common", category: "캔 소리 감별사", categoryColor: COMMON_COLOR,
    traits: ["캔 소리에 순간이동", "은빛 털"], flavor: "참치캔 따는 소리를 300m 밖에서 듣는다. 정신 차리면 이미 발밑에 와 있다." },
  { key: "anchovy", dexNo: 55, name: "멸치냥", emoji: "🐱", rarity: "common", category: "날쌘 멸치", categoryColor: COMMON_COLOR,
    traits: ["전력 질주", "높이뛰기"], flavor: "몸이 가벼워 담장을 새처럼 넘는다. 밥은 많이 먹는데 살이 안 찐다." },
  { key: "market", dexNo: 56, name: "시장냥", emoji: "🐈‍⬛", rarity: "common", category: "시장 마스코트", categoryColor: COMMON_COLOR,
    traits: ["생선가게 앞 대기", "상인들 인기쟁이"], flavor: "시장 상인들이 다 이름을 알고 있다. 생선가게 앞에선 세상 착해진다." },
  { key: "playground", dexNo: 57, name: "놀이터냥", emoji: "🐈", rarity: "common", category: "모래놀이 챔피언", categoryColor: COMMON_COLOR,
    traits: ["미끄럼틀 독차지", "아이들 친구"], flavor: "미끄럼틀 꼭대기가 지정석. 아이들이 와도 안 비켜주지만 미움받지 않는다." },
  { key: "dashcat", dexNo: 58, name: "배달냥", emoji: "🐱", rarity: "common", category: "번개 배달부", categoryColor: COMMON_COLOR,
    traits: ["지름길 마스터", "전속력 질주"], flavor: "골목 지름길을 다 꿰고 있다. 어디로 갔나 싶으면 벌써 저 앞에 있다." },

  // ── 희귀 확장 (No.059~088) — 조금 특별한 무늬와 향기 ──
  { key: "cowcat", dexNo: 59, name: "젖소냥", emoji: "🐱", rarity: "uncommon", category: "우유 배달부", categoryColor: UNCOMMON_COLOR,
    traits: ["큼직한 얼룩", "우유 애호"], flavor: "흑백 얼룩이 영락없는 젖소. 정작 우유보다 츄르를 좋아한다." },
  { key: "halfmoon", dexNo: 60, name: "반달냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "가슴의 반달", categoryColor: UNCOMMON_COLOR,
    traits: ["달밤 산책", "반달 자랑"], flavor: "새까만 가슴팍에 하얀 반달이 떴다. 달 없는 밤엔 이 냥이가 반달이다." },
  { key: "goldnecklace", dexNo: 61, name: "금목걸이냥", emoji: "🐈", rarity: "uncommon", category: "금빛 목도리", categoryColor: UNCOMMON_COLOR,
    traits: ["목털 자랑", "우아한 앉기"], flavor: "목둘레 털만 금빛으로 빛난다. 목도리를 두른 귀족 같다." },
  { key: "swirl", dexNo: 62, name: "회오리냥", emoji: "🐱", rarity: "uncommon", category: "소용돌이 무늬", categoryColor: UNCOMMON_COLOR,
    traits: ["뱅글뱅글 꼬리잡기", "회전 점프"], flavor: "옆구리 무늬가 소용돌이친다. 제 꼬리를 쫓다 보면 진짜 회오리가 된다." },
  { key: "mandarin", dexNo: 63, name: "귤냥", emoji: "🐈", rarity: "uncommon", category: "귤빛 통통이", categoryColor: UNCOMMON_COLOR,
    traits: ["귤 굴리기", "겨울 별미 감시"], flavor: "겨울 창가의 귤 바구니 옆이 지정석. 털색 때문에 귤이 하나 더 있어 보인다." },
  { key: "cottoncandy", dexNo: 64, name: "솜사탕냥", emoji: "🐱", rarity: "uncommon", category: "분홍빛 솜뭉치", categoryColor: UNCOMMON_COLOR,
    traits: ["푹신 착지", "부풀어 오른 털"], flavor: "털이 솜사탕처럼 부풀어 있다. 비를 맞으면 급격히 작아진다." },
  { key: "charcoal", dexNo: 65, name: "숯냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "숯검댕이", categoryColor: UNCOMMON_COLOR,
    traits: ["아궁이 앞 잠자기", "온기 탐지"], flavor: "군고구마 트럭 근처에서 자주 목격된다. 원래 이 색인지 그을린 건지 아무도 모른다." },
  { key: "maple", dexNo: 66, name: "단풍냥", emoji: "🐈", rarity: "uncommon", category: "가을 단풍", categoryColor: UNCOMMON_COLOR,
    traits: ["낙엽 밟기", "단풍잎 수집"], flavor: "가을이면 낙엽 더미에 완벽하게 은신한다. 밟으면 바스락 소리가 날 것 같다." },
  { key: "vanilla", dexNo: 67, name: "바닐라냥", emoji: "🐱", rarity: "uncommon", category: "달콤한 바닐라", categoryColor: UNCOMMON_COLOR,
    traits: ["디저트 가게 앞 대기", "달콤한 냄새"], flavor: "지나가면 은은하게 달콤한 냄새가 난다는 소문. 빵집 단골이다." },
  { key: "mocha", dexNo: 68, name: "모카냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "쌉싸름 모카", categoryColor: UNCOMMON_COLOR,
    traits: ["카페 창가 착석", "원두 냄새 감별"], flavor: "진한 모카색 얼룩이 근사하다. 카페인은 안 되지만 카페 분위기는 즐긴다." },
  { key: "caramel", dexNo: 69, name: "캐러멜냥", emoji: "🐈", rarity: "uncommon", category: "쫀득 캐러멜", categoryColor: UNCOMMON_COLOR,
    traits: ["햇살 늘어지기", "쫀득한 기지개"], flavor: "기지개가 캐러멜처럼 쭉쭉 늘어난다. 보고 있으면 같이 늘어지게 된다." },
  { key: "chestnut", dexNo: 70, name: "밤톨냥", emoji: "🐱", rarity: "uncommon", category: "가시 밤송이", categoryColor: UNCOMMON_COLOR,
    traits: ["밤송이 헤어", "꿍한 표정"], flavor: "동그란 몸이 영락없는 밤톨. 화나면 털이 밤송이처럼 선다." },
  { key: "eyebrow", dexNo: 71, name: "눈썹냥", emoji: "🐈", rarity: "uncommon", category: "여덟팔자 눈썹", categoryColor: UNCOMMON_COLOR,
    traits: ["억울한 표정", "동정 유발"], flavor: "눈 위 얼룩이 팔자 눈썹 같아서 늘 억울해 보인다. 간식을 두 배로 받는 비결." },
  { key: "socks", dexNo: 72, name: "양말냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "네 짝 양말", categoryColor: UNCOMMON_COLOR,
    traits: ["양말 물어가기", "발끝 세우기"], flavor: "네 발 양말이 다 다른 길이다. 건조대의 양말이 자꾸 사라진다면 범인은 이 녀석." },
  { key: "necktie", dexNo: 73, name: "넥타이냥", emoji: "🐱", rarity: "uncommon", category: "출근하는 냥이", categoryColor: UNCOMMON_COLOR,
    traits: ["아침 출근길 동행", "단정한 앉기"], flavor: "가슴에 넥타이 모양 무늬가 있다. 아침마다 지하철역까지 출근했다 돌아온다." },
  { key: "marble", dexNo: 74, name: "대리석냥", emoji: "🐈", rarity: "uncommon", category: "대리석 조각", categoryColor: UNCOMMON_COLOR,
    traits: ["미술관급 자태", "우아한 정지"], flavor: "가만히 있으면 대리석 조각상 같다. 숨은 쉬고 있으니 걱정 말자." },
  { key: "peach", dexNo: 75, name: "복숭아냥", emoji: "🐱", rarity: "uncommon", category: "말랑 복숭아", categoryColor: UNCOMMON_COLOR,
    traits: ["볼살 출렁", "낮잠 후 부은 얼굴"], flavor: "볼이 복숭아처럼 발그레하다. 깨물면 안 된다. 진짜 안 된다." },
  { key: "mint", dexNo: 76, name: "민트냥", emoji: "🐈", rarity: "uncommon", category: "청량한 민트", categoryColor: UNCOMMON_COLOR,
    traits: ["시원한 그늘 독차지", "박하 냄새"], flavor: "이 냥이가 지나가면 왠지 공기가 시원해진다. 여름 한정 인기 폭발." },
  { key: "pepper", dexNo: 77, name: "후추냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "톡 쏘는 후추", categoryColor: UNCOMMON_COLOR,
    traits: ["재채기 유발", "깨알 얼룩"], flavor: "온몸에 후추를 뿌린 듯한 깨알 무늬. 가까이 가면 왠지 재채기가 나온다." },
  { key: "salt", dexNo: 78, name: "소금냥", emoji: "🐱", rarity: "uncommon", category: "귀끝 소금", categoryColor: UNCOMMON_COLOR,
    traits: ["새하얀 몸", "귀끝만 회색"], flavor: "온몸이 소금처럼 하얀데 귀끝만 살짝 회색. 요리에 진심인 집 앞에 산다." },
  { key: "lilac", dexNo: 79, name: "라일락냥", emoji: "🐈", rarity: "uncommon", category: "은은한 라일락", categoryColor: UNCOMMON_COLOR,
    traits: ["봄밤 산책", "꽃그늘 낮잠"], flavor: "털에서 라일락빛이 돈다. 봄밤에 보면 특히 예쁘다." },
  { key: "acorn", dexNo: 80, name: "도토리냥", emoji: "🐱", rarity: "uncommon", category: "도토리 저금왕", categoryColor: UNCOMMON_COLOR,
    traits: ["도토리 굴리기", "다람쥐와 경쟁"], flavor: "공원 도토리를 다람쥐와 나눠 갖는다. 나눠 갖는 비율은 아직 협상 중." },
  { key: "walnut", dexNo: 81, name: "호두냥", emoji: "🐈", rarity: "uncommon", category: "단단한 호두", categoryColor: UNCOMMON_COLOR,
    traits: ["단단한 이마", "박치기 인사"], flavor: "이마가 유난히 단단하다. 반가우면 박치기로 인사하니 마음의 준비를." },
  { key: "cherrycat", dexNo: 82, name: "앵두냥", emoji: "🐱", rarity: "uncommon", category: "앵두 같은 코", categoryColor: UNCOMMON_COLOR,
    traits: ["앵두 코", "조막만 한 얼굴"], flavor: "코와 입이 앵두처럼 붉고 작다. 하품해도 귀엽다는 게 불공평하다." },
  { key: "cloudcat", dexNo: 83, name: "구름냥", emoji: "🐈", rarity: "uncommon", category: "뭉게구름", categoryColor: UNCOMMON_COLOR,
    traits: ["공중 점프", "사뿐한 착지"], flavor: "점프하면 잠깐 떠 있는 것처럼 보인다. 구름을 닮아 발소리도 없다." },
  { key: "sunsetcat", dexNo: 84, name: "노을냥", emoji: "🐱", rarity: "uncommon", category: "노을 수집가", categoryColor: UNCOMMON_COLOR,
    traits: ["노을 감상", "옥상 지정석"], flavor: "매일 저녁 옥상에서 노을을 본다. 노을색이 털에 물들었다는 소문." },
  { key: "dewdrop", dexNo: 85, name: "이슬냥", emoji: "🐈", rarity: "uncommon", category: "아침 이슬", categoryColor: UNCOMMON_COLOR,
    traits: ["풀잎 이슬 마시기", "반짝이는 털"], flavor: "아침 풀밭에서 이슬만 골라 마신다. 그래서 털이 반짝인다나." },
  { key: "mulberry", dexNo: 86, name: "오디냥", emoji: "🐈‍⬛", rarity: "uncommon", category: "오디 얼룩", categoryColor: UNCOMMON_COLOR,
    traits: ["뽕나무 아래 낮잠", "보라 발자국"], flavor: "오디를 밟고 다녔는지 발끝이 보라색. 지나간 자리를 알 수 있다." },
  { key: "injeolmi", dexNo: 87, name: "인절미냥", emoji: "🐱", rarity: "uncommon", category: "콩고물 폴폴", categoryColor: UNCOMMON_COLOR,
    traits: ["몸 털면 고물 날림", "말랑 찹쌀"], flavor: "몸을 털면 콩고물 같은 먼지가 폴폴 난다. 물론 씻어도 그 색이다." },
  { key: "mugwort", dexNo: 88, name: "쑥떡냥", emoji: "🐈", rarity: "uncommon", category: "은은한 쑥향", categoryColor: UNCOMMON_COLOR,
    traits: ["봄나물 감별", "들판 뒹굴기"], flavor: "들판을 뒹굴어 쑥향이 밴 초록빛 털. 봄이면 유난히 활발해진다." },

  // ── 레어 확장 (No.089~108) — 만나기 어려운 품종과 빛 ──
  { key: "persian", dexNo: 89, name: "페르시안냥", emoji: "🐱", rarity: "rare", category: "구름 갈기 귀족", categoryColor: RARE_COLOR,
    traits: ["우아한 무시", "풍성한 갈기"], flavor: "구름 같은 털에 파묻혀 얼굴만 빼꼼. 빗질 시중을 받아야 움직인다." },
  { key: "mainecoon", dexNo: 90, name: "메인쿤냥", emoji: "🐈", rarity: "rare", category: "거대한 온화함", categoryColor: RARE_COLOR,
    traits: ["압도적 덩치", "의외의 애교"], flavor: "몸집은 동네 최대인데 마음은 최연소. 무릎에 올라오면 다리에 쥐가 난다." },
  { key: "bengal", dexNo: 91, name: "벵갈냥", emoji: "🐈", rarity: "rare", category: "표범 무늬 질주자", categoryColor: RARE_COLOR,
    traits: ["표범 점프", "야생 본능"], flavor: "표범 무늬 그대로 골목을 질주한다. 사냥감은 주로 낙엽." },
  { key: "desertcat", dexNo: 92, name: "사막냥", emoji: "🐱", rarity: "rare", category: "모래바람 여행자", categoryColor: RARE_COLOR,
    traits: ["모래색 위장", "더위 무시"], flavor: "한여름 뙤약볕에도 끄떡없다. 모래색 털은 화단에서 완벽한 위장복." },
  { key: "angora", dexNo: 93, name: "앙고라냥", emoji: "🐱", rarity: "rare", category: "백설 명주실", categoryColor: RARE_COLOR,
    traits: ["명주실 털", "도도한 응시"], flavor: "명주실 같은 털이 바람에 흩날린다. 하얀 털엔 먼지도 감히 못 앉는다." },
  { key: "fold", dexNo: 94, name: "폴드냥", emoji: "🐈", rarity: "rare", category: "접힌 귀 동그리", categoryColor: RARE_COLOR,
    traits: ["동그란 실루엣", "접힌 귀"], flavor: "귀가 접혀 얼굴이 완벽한 원이 된다. 동그라미를 그리다 만든 냥이라는 설." },
  { key: "ragdoll", dexNo: 95, name: "랙돌냥", emoji: "🐱", rarity: "rare", category: "안기면 녹는 인형", categoryColor: RARE_COLOR,
    traits: ["안기면 축 늘어짐", "인형 모드"], flavor: "안아 올리면 봉제인형처럼 늘어진다. 내려놓으면 서운해한다." },
  { key: "himalayan", dexNo: 96, name: "히말라얀냥", emoji: "🐱", rarity: "rare", category: "설산의 귀공자", categoryColor: RARE_COLOR,
    traits: ["기품 있는 정좌", "높은 곳 선호"], flavor: "짙은 포인트에 푸른 눈. 책장 꼭대기를 히말라야라 여기며 등반한다." },
  { key: "jade", dexNo: 97, name: "옥색냥", emoji: "🐈", rarity: "rare", category: "옥빛 눈동자", categoryColor: RARE_COLOR,
    traits: ["옥구슬 눈", "고요한 응시"], flavor: "눈동자가 옥구슬처럼 맑다. 눈을 마주치면 마음을 읽힌 기분이 든다." },
  { key: "amethyst", dexNo: 98, name: "자수정냥", emoji: "🐈‍⬛", rarity: "rare", category: "보랏빛 신비", categoryColor: RARE_COLOR,
    traits: ["보랏빛 광택", "달빛 충전"], flavor: "달빛 아래서 털이 자수정처럼 반짝인다. 보름달엔 유난히 활기차다." },
  { key: "pearl", dexNo: 99, name: "진주냥", emoji: "🐱", rarity: "rare", category: "진주 광택", categoryColor: RARE_COLOR,
    traits: ["무지개 광택", "조개껍데기 수집"], flavor: "빛에 따라 털색이 은은하게 바뀐다. 어시장 근처에서 조개껍데기를 모은다." },
  { key: "obsidian", dexNo: 100, name: "흑요석냥", emoji: "🐈‍⬛", rarity: "rare", category: "칠흑의 광택", categoryColor: RARE_COLOR,
    traits: ["거울 같은 털", "날카로운 눈빛"], flavor: "털에 윤이 나서 밤에도 반질반질 빛난다. 눈빛은 흑요석 칼날처럼 예리하다." },
  { key: "blossom", dexNo: 101, name: "벚꽃냥", emoji: "🐱", rarity: "rare", category: "봄의 전령", categoryColor: RARE_COLOR,
    traits: ["꽃잎 맞기", "봄바람 질주"], flavor: "벚꽃이 피면 나타나는 분홍 얼룩 냥이. 꽃잎이 떨어지면 같이 사라진다." },
  { key: "frost", dexNo: 102, name: "서리냥", emoji: "🐈", rarity: "rare", category: "첫서리 은세공", categoryColor: RARE_COLOR,
    traits: ["입김 뿜기", "서리 무늬"], flavor: "털 끝에 서리가 앉은 듯 반짝인다. 추운 아침에만 무늬가 선명해진다." },
  { key: "fogcat", dexNo: 103, name: "안개냥", emoji: "🐈", rarity: "rare", category: "안개 속 실루엣", categoryColor: RARE_COLOR,
    traits: ["스르륵 등장", "희미한 존재감"], flavor: "안개 낀 날 홀연히 나타났다 사라진다. 사진엔 늘 흐릿하게 찍힌다." },
  { key: "lighthouse", dexNo: 104, name: "등대냥", emoji: "🐈‍⬛", rarity: "rare", category: "항구의 등대지기", categoryColor: RARE_COLOR,
    traits: ["밤바다 응시", "뱃고동 화답"], flavor: "항구 방파제 끝이 지정석. 밤이면 노란 눈이 등대처럼 빛난다." },
  { key: "aurora", dexNo: 105, name: "오로라냥", emoji: "🐱", rarity: "rare", category: "빛의 커튼", categoryColor: RARE_COLOR,
    traits: ["빛 아래 변신", "극광 꼬리"], flavor: "털이 보는 각도마다 초록·보라로 어른거린다. 밤하늘의 커튼을 두르고 왔다." },
  { key: "starcandy", dexNo: 106, name: "별사탕냥", emoji: "🐱", rarity: "rare", category: "별사탕 요정", categoryColor: RARE_COLOR,
    traits: ["단 것 탐지", "축제 등장"], flavor: "축제 날 솜사탕 가게 앞에 나타난다. 파스텔 얼룩이 별사탕을 닮았다." },
  { key: "wisp", dexNo: 107, name: "도깨비불냥", emoji: "🐈‍⬛", rarity: "rare", category: "푸른 불꽃", categoryColor: RARE_COLOR,
    traits: ["도깨비불 눈빛", "홀리기"], flavor: "깊은 밤 골목 끝에서 푸른 눈만 두 개 떠다닌다. 따라가면 츄르를 요구한다." },
  { key: "moonhalo", dexNo: 108, name: "달무리냥", emoji: "🐈", rarity: "rare", category: "달무리 두른 밤", categoryColor: RARE_COLOR,
    traits: ["달무리 소환", "고요한 밤 산책"], flavor: "이 냥이 주위엔 달무리처럼 은은한 빛이 돈다. 달 밝은 밤에만 목격된다." },

  // ── 레전드 확장 (No.109~118) — 전설과 신화 ──
  { key: "haetae", dexNo: 109, name: "해태냥", emoji: "🦁", rarity: "legendary", category: "궁궐의 수호수", categoryColor: LEGENDARY_COLOR,
    traits: ["재앙 막기", "궁궐 순찰"], flavor: "경복궁 해태상을 꼭 닮았다. 이 냥이가 앉은 골목엔 나쁜 일이 안 생긴다는 전설." },
  { key: "sansin", dexNo: 110, name: "산신령냥", emoji: "🐈", rarity: "legendary", category: "산신령의 동행", categoryColor: LEGENDARY_COLOR,
    traits: ["구름 타기", "산길 인도"], flavor: "등산객이 길을 잃으면 어디선가 나타나 앞장선다. 정상엔 늘 먼저 도착해 있다." },
  { key: "gumiho", dexNo: 111, name: "구미호냥", emoji: "🦊", rarity: "legendary", category: "아홉 꼬리의 환영", categoryColor: LEGENDARY_COLOR,
    traits: ["환영 분신", "홀리는 재주"], flavor: "꼬리가 아홉 개로 보이는 순간이 있다. 눈을 비비면 다시 하나. 분명 아홉 개였는데." },
  { key: "dragonking", dexNo: 112, name: "용왕냥", emoji: "🐉", rarity: "legendary", category: "심해의 왕", categoryColor: LEGENDARY_COLOR,
    traits: ["비 부르기", "파도 다스리기"], flavor: "이 냥이가 세수를 하면 비가 온다는 전설. 어부들이 몰래 생선을 바친다." },
  { key: "phoenix", dexNo: 113, name: "불사조냥", emoji: "🔥", rarity: "legendary", category: "불꽃의 환생", categoryColor: LEGENDARY_COLOR,
    traits: ["불꽃 깃털", "새벽 부활"], flavor: "노을 속으로 사라졌다가 새벽에 다시 나타난다. 털이 불꽃처럼 일렁인다." },
  { key: "galaxy", dexNo: 114, name: "은하냥", emoji: "🌌", rarity: "legendary", category: "은하수를 삼킨", categoryColor: LEGENDARY_COLOR,
    traits: ["은하수 유영", "별자리 그리기"], flavor: "털 속에 은하수가 흐른다. 어두운 곳에서 보면 별이 헤엄치는 게 보인다." },
  { key: "thunder", dexNo: 115, name: "뇌운냥", emoji: "⚡", rarity: "legendary", category: "천둥을 모는", categoryColor: LEGENDARY_COLOR,
    traits: ["번개 질주", "천둥 골골송"], flavor: "이 냥이가 달리면 멀리서 천둥소리가 난다. 골골송도 우르릉거린다." },
  { key: "rainbowcat", dexNo: 116, name: "무지개냥", emoji: "🌈", rarity: "legendary", category: "비 갠 뒤의 기적", categoryColor: LEGENDARY_COLOR,
    traits: ["무지개 소환", "행운 뿌리기"], flavor: "소나기 갠 직후에만 나타난다. 만난 사람은 그 주에 좋은 일이 생긴다." },
  { key: "daybreak", dexNo: 117, name: "여명냥", emoji: "🌅", rarity: "legendary", category: "새벽을 여는", categoryColor: LEGENDARY_COLOR,
    traits: ["해돋이 배웅", "첫 햇살 독차지"], flavor: "이 냥이가 기지개를 켜면 해가 뜬다. 순서가 반대라는 지적은 받아들이지 않는다." },
  { key: "guardian", dexNo: 118, name: "수호냥", emoji: "🛡️", rarity: "legendary", category: "골목의 수호신", categoryColor: LEGENDARY_COLOR,
    traits: ["집사 지키기", "위험 감지"], flavor: "위험이 다가오면 어느새 앞을 막아선다. 모든 골목냥이의 큰형님." },
];

export const SPECIES_BY_KEY: Record<string, SpawnSpecies> =
  Object.fromEntries(SPAWN_SPECIES.map(s => [s.key, s]));

export const SPECIES_BY_RARITY: Record<GradeKey, SpawnSpecies[]> = {
  common: SPAWN_SPECIES.filter(s => s.rarity === "common"),
  uncommon: SPAWN_SPECIES.filter(s => s.rarity === "uncommon"),
  rare: SPAWN_SPECIES.filter(s => s.rarity === "rare"),
  legendary: SPAWN_SPECIES.filter(s => s.rarity === "legendary"),
};

// 등급명 고정: 일반/희귀/레어/레전드 (CatCard CARD_THEME 라벨과 통일 — 예전엔 "고급"으로 갈라져 있었음)
export const RARITY_LABEL: Record<GradeKey, string> = {
  common: "일반", uncommon: "희귀", rare: "레어", legendary: "레전드",
};

// 등급색 고정 규칙(2026-07-11 Figma 스펙 v2): 일반=회색/희귀=초록/레어=파랑/레전드=골드
export const RARITY_COLOR: Record<GradeKey, string> = {
  common: "#9CA3AF", uncommon: "#22C55E", rare: "#3B82F6", legendary: "#F5A623",
};

// 로밍 마커/트레이/포획 화면용 실사 초상 (Unsplash License — 상업 사용 가능, 출처표기 불요).
// public/species-photo/{key}.jpg, 200×200. 도감·카드의 종 아트(SVG)는 별개로 유지.
// 실사 jpg는 초기 18종(No.001~018)만 존재 — 대확장 100종은 SVG 아트 데이터 URL로 폴백해
// <img>·캔버스(자랑 카드) 호출처를 하나도 안 바꾸고 동작한다. 나중에 사진이 생기면 셋에 추가.
const PHOTO_KEYS = new Set([
  "cheese", "mackerel", "tuxedo", "allblack", "allwhite", "graytabby",
  "calico", "tortie", "oddeye", "munchkin", "bobtail",
  "russianblue", "siamese", "norwegian", "sphynx",
  "goldenking", "snowspirit", "nightlord",
]);
export function speciesPhotoUrl(key: string): string {
  return PHOTO_KEYS.has(key) ? `/species-photo/${key}.jpg` : speciesArtDataUrl(key, 200);
}

export function speciesDexNoLabel(n: number): string {
  return `No.${String(n).padStart(3, "0")}`;
}
