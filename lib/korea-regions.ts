// 전국 광역시·도 매핑 (서울 외)
// /regions/[sido] 랜딩 페이지에서 사용. 서울은 lib/seoul-regions.ts 별도 (구·동 단위 디테일 있음).
// SEO 확장: 수도권·광역시 사용자도 "<도시명> 길고양이" 검색에서 노출되도록.

export interface SidoInfo {
  slug: string;        // URL-safe (예: "incheon")
  name: string;        // 풀네임 (예: "인천광역시")
  shortName: string;   // 검색·태그용 짧은 이름 (예: "인천")
  latlng: [number, number]; // 대표 좌표 (시청)

  // 단독 매칭 안전 키워드 — substring 충돌이 없는 unique 명칭.
  // 예: 시·도 short name(인천/부산), Sejong/제주의 고유 동네, 경기도의 시 이름들.
  // OR 조건으로 단독 사용해도 다른 지역 cats 안 잡힘.
  primaryKeywords: string[];

  // sido 컨텍스트가 필요한 키워드 — 일반적인 구·군 이름(중구/동구/남구 등).
  // 다른 광역시와 substring 충돌하므로 sido shortName과 AND로만 매칭.
  // 비어있으면 districtKeywords가 없는 것 (Sejong/제주/경기).
  districtKeywords: string[];
}

export const KOREA_SIDOS: SidoInfo[] = [
  {
    slug: "incheon",
    name: "인천광역시",
    shortName: "인천",
    latlng: [37.4563, 126.7052],
    primaryKeywords: ["인천"],
    districtKeywords: ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
  },
  {
    slug: "busan",
    name: "부산광역시",
    shortName: "부산",
    latlng: [35.1796, 129.0756],
    primaryKeywords: ["부산"],
    districtKeywords: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
  },
  {
    slug: "daegu",
    name: "대구광역시",
    shortName: "대구",
    latlng: [35.8714, 128.6014],
    primaryKeywords: ["대구"],
    districtKeywords: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군"],
  },
  {
    slug: "gwangju",
    name: "광주광역시",
    shortName: "광주",
    latlng: [35.1595, 126.8526],
    primaryKeywords: ["광주광역시"], // "광주시"는 경기도 광주시와 충돌해서 제외
    districtKeywords: ["동구", "서구", "남구", "북구", "광산구"],
  },
  {
    slug: "daejeon",
    name: "대전광역시",
    shortName: "대전",
    latlng: [36.3504, 127.3845],
    primaryKeywords: ["대전"],
    districtKeywords: ["동구", "중구", "서구", "유성구", "대덕구"],
  },
  {
    slug: "ulsan",
    name: "울산광역시",
    shortName: "울산",
    latlng: [35.5384, 129.3114],
    primaryKeywords: ["울산"],
    districtKeywords: ["중구", "남구", "동구", "북구", "울주군"],
  },
  {
    slug: "sejong",
    name: "세종특별자치시",
    shortName: "세종",
    latlng: [36.4801, 127.2890],
    // 세종 dong들은 다른 시도와 substring 충돌 없음 → 모두 primary
    primaryKeywords: ["세종특별자치시", "세종시", "조치원", "한솔동", "도담동", "아름동", "종촌동", "고운동", "보람동", "대평동", "소담동", "다정동", "새롬동", "나성동", "어진동", "반곡동"],
    districtKeywords: [],
  },
  {
    slug: "jeju",
    name: "제주특별자치도",
    shortName: "제주",
    latlng: [33.4996, 126.5312],
    primaryKeywords: ["제주", "서귀포"],
    districtKeywords: [],
  },
  {
    slug: "gyeonggi",
    name: "경기도",
    shortName: "경기",
    latlng: [37.4138, 127.5183],
    // 경기도는 sido 차원의 unique 키워드("경기")가 region 텍스트에 거의 안 쓰여서
    // 시 이름 단독 매칭. "광주시"는 광주광역시와 충돌해서 제외.
    primaryKeywords: ["수원", "성남", "고양시", "용인", "부천", "안산", "안양", "남양주", "화성시", "평택", "의정부", "시흥", "파주", "광명", "김포", "군포", "하남", "오산", "이천", "양주", "구리", "안성", "포천", "의왕", "여주", "동두천", "과천", "가평", "연천", "양평"],
    districtKeywords: [],
  },
];

export function findSidoBySlug(slug: string): SidoInfo | undefined {
  return KOREA_SIDOS.find((s) => s.slug === slug);
}
