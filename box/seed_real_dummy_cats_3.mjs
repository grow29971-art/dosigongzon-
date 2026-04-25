// 실제 사진으로 더미 고양이 시드 (3차) — 전국 분산.
// 실행: node --env-file=.env.local box/seed_real_dummy_cats_3.mjs
//
// 전략:
//   - "(1)" 중복 파일 자동 스킵
//   - 이름·설명·위치를 procedural하게 조합 (86장 모두 고유한 컨텐츠)
//   - 전국 17 광역시도에 고르게 분산

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ env 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

const PHOTO_DIRS = [
  "C:\\Users\\acer\\Desktop\\고양이사진",
  "C:\\Users\\acer\\Desktop\\고양이사진2",
];

// ── 위치 풀: 전국 90개 (round-robin으로 사용) ──
const LOCATIONS = [
  // 서울 (15)
  { region: "서울 마포구 망원동", lat: 37.556, lng: 126.9105 },
  { region: "서울 마포구 서교동", lat: 37.5557, lng: 126.9223 },
  { region: "서울 마포구 연남동", lat: 37.566, lng: 126.924 },
  { region: "서울 강남구 삼성동", lat: 37.5145, lng: 127.0593 },
  { region: "서울 종로구 혜화동", lat: 37.5824, lng: 127.0019 },
  { region: "서울 동대문구 회기동", lat: 37.5896, lng: 127.0566 },
  { region: "서울 성북구 길음동", lat: 37.6035, lng: 127.0259 },
  { region: "서울 영등포구 여의도동", lat: 37.524, lng: 126.9243 },
  { region: "서울 강서구 화곡동", lat: 37.5418, lng: 126.8395 },
  { region: "서울 관악구 봉천동", lat: 37.4818, lng: 126.951 },
  { region: "서울 서초구 서초동", lat: 37.4837, lng: 127.0324 },
  { region: "서울 성동구 성수동", lat: 37.5446, lng: 127.0566 },
  { region: "서울 은평구 응암동", lat: 37.6028, lng: 126.9173 },
  { region: "서울 도봉구 창동", lat: 37.6536, lng: 127.0473 },
  { region: "서울 구로구 구로동", lat: 37.4956, lng: 126.8874 },
  // 부산 (8)
  { region: "부산 해운대구 중동", lat: 35.1626, lng: 129.1685 },
  { region: "부산 수영구 광안동", lat: 35.153, lng: 129.118 },
  { region: "부산 수영구 민락동", lat: 35.157, lng: 129.135 },
  { region: "부산 사하구 다대동", lat: 35.061, lng: 128.965 },
  { region: "부산 부산진구 부전동", lat: 35.1582, lng: 129.0593 },
  { region: "부산 동래구 명륜동", lat: 35.2115, lng: 129.0786 },
  { region: "부산 영도구 영선동", lat: 35.085, lng: 129.0476 },
  { region: "부산 남구 대연동", lat: 35.1335, lng: 129.0938 },
  // 대구 (5)
  { region: "대구 중구 삼덕동", lat: 35.8665, lng: 128.6042 },
  { region: "대구 수성구 황금동", lat: 35.8454, lng: 128.6359 },
  { region: "대구 달서구 두류동", lat: 35.8496, lng: 128.5547 },
  { region: "대구 북구 침산동", lat: 35.892, lng: 128.591 },
  { region: "대구 동구 신천동", lat: 35.8782, lng: 128.6253 },
  // 인천 (8)
  { region: "인천 남동구 구월동", lat: 37.45, lng: 126.708 },
  { region: "인천 부평구 산곡동", lat: 37.4915, lng: 126.7117 },
  { region: "인천 미추홀구 도화동", lat: 37.4665, lng: 126.6512 },
  { region: "인천 연수구 옥련동", lat: 37.4097, lng: 126.6443 },
  { region: "인천 서구 가좌동", lat: 37.4797, lng: 126.681 },
  { region: "인천 중구 신포동", lat: 37.4738, lng: 126.6258 },
  { region: "인천 동구 송림동", lat: 37.4762, lng: 126.6489 },
  { region: "인천 계양구 계산동", lat: 37.5377, lng: 126.7375 },
  // 광주 (4)
  { region: "광주 동구 충장동", lat: 35.149, lng: 126.918 },
  { region: "광주 서구 상무지구", lat: 35.1494, lng: 126.8478 },
  { region: "광주 북구 용봉동", lat: 35.179, lng: 126.913 },
  { region: "광주 남구 봉선동", lat: 35.13, lng: 126.91 },
  // 대전 (4)
  { region: "대전 유성구 궁동", lat: 36.366, lng: 127.34 },
  { region: "대전 중구 대흥동", lat: 36.328, lng: 127.426 },
  { region: "대전 서구 둔산동", lat: 36.3514, lng: 127.378 },
  { region: "대전 동구 자양동", lat: 36.3408, lng: 127.4527 },
  // 울산 (3)
  { region: "울산 남구 삼산동", lat: 35.5402, lng: 129.343 },
  { region: "울산 동구 일산동", lat: 35.499, lng: 129.421 },
  { region: "울산 북구 농소동", lat: 35.604, lng: 129.354 },
  // 세종 (2)
  { region: "세종 보람동", lat: 36.4815, lng: 127.2828 },
  { region: "세종 조치원읍", lat: 36.6, lng: 127.298 },
  // 경기 (12)
  { region: "경기 성남시 분당구 판교동", lat: 37.394, lng: 127.111 },
  { region: "경기 안산시 단원구 고잔동", lat: 37.3168, lng: 126.834 },
  { region: "경기 수원시 팔달구 인계동", lat: 37.272, lng: 127.029 },
  { region: "경기 수원시 영통구 매탄동", lat: 37.2547, lng: 127.054 },
  { region: "경기 고양시 일산동구 정발산동", lat: 37.6586, lng: 126.7765 },
  { region: "경기 평택시 비전동", lat: 36.99, lng: 127.083 },
  { region: "경기 화성시 동탄동", lat: 37.2007, lng: 127.073 },
  { region: "경기 의정부시 신곡동", lat: 37.7456, lng: 127.0628 },
  { region: "경기 김포시 장기동", lat: 37.6418, lng: 126.6595 },
  { region: "경기 용인시 수지구 풍덕천동", lat: 37.3253, lng: 127.0966 },
  { region: "경기 남양주시 다산동", lat: 37.616, lng: 127.155 },
  { region: "경기 파주시 운정동", lat: 37.7204, lng: 126.7536 },
  // 강원 (6)
  { region: "강원 춘천시 효자동", lat: 37.872, lng: 127.736 },
  { region: "강원 강릉시 교동", lat: 37.762, lng: 128.892 },
  { region: "강원 원주시 단계동", lat: 37.345, lng: 127.946 },
  { region: "강원 속초시 조양동", lat: 38.187, lng: 128.581 },
  { region: "강원 동해시 천곡동", lat: 37.527, lng: 129.115 },
  { region: "강원 양양군 양양읍", lat: 38.075, lng: 128.628 },
  // 충북 (4)
  { region: "충북 청주시 흥덕구 복대동", lat: 36.6435, lng: 127.43 },
  { region: "충북 충주시 호암동", lat: 36.96, lng: 127.927 },
  { region: "충북 제천시 청전동", lat: 37.139, lng: 128.197 },
  { region: "충북 단양군 단양읍", lat: 36.984, lng: 128.366 },
  // 충남 (5)
  { region: "충남 천안시 동남구 두정동", lat: 36.836, lng: 127.135 },
  { region: "충남 천안시 서북구 성정동", lat: 36.8158, lng: 127.137 },
  { region: "충남 아산시 배방읍", lat: 36.785, lng: 127.05 },
  { region: "충남 공주시 반포면", lat: 36.405, lng: 127.18 },
  { region: "충남 서산시 동문동", lat: 36.785, lng: 126.45 },
  // 전북 (4)
  { region: "전북 전주시 완산구 효자동", lat: 35.815, lng: 127.118 },
  { region: "전북 전주시 덕진구 평화동", lat: 35.833, lng: 127.143 },
  { region: "전북 군산시 수송동", lat: 35.97, lng: 126.717 },
  { region: "전북 익산시 영등동", lat: 35.945, lng: 126.96 },
  // 전남 (4)
  { region: "전남 여수시 학동", lat: 34.745, lng: 127.74 },
  { region: "전남 순천시 연향동", lat: 34.951, lng: 127.512 },
  { region: "전남 목포시 옥암동", lat: 34.802, lng: 126.43 },
  { region: "전남 광양시 중동", lat: 34.94, lng: 127.703 },
  // 경북 (5)
  { region: "경북 포항시 북구 두호동", lat: 36.06, lng: 129.376 },
  { region: "경북 경주시 황남동", lat: 35.835, lng: 129.21 },
  { region: "경북 안동시 옥동", lat: 36.566, lng: 128.713 },
  { region: "경북 구미시 송정동", lat: 36.122, lng: 128.345 },
  { region: "경북 김천시 평화동", lat: 36.135, lng: 128.115 },
  // 경남 (6)
  { region: "경남 창원시 의창구 팔용동", lat: 35.245, lng: 128.628 },
  { region: "경남 창원시 성산구 상남동", lat: 35.226, lng: 128.682 },
  { region: "경남 진주시 평거동", lat: 35.197, lng: 128.07 },
  { region: "경남 김해시 외동", lat: 35.241, lng: 128.872 },
  { region: "경남 양산시 북정동", lat: 35.345, lng: 129.038 },
  { region: "경남 통영시 무전동", lat: 34.852, lng: 128.435 },
  // 제주 (3)
  { region: "제주특별자치도 제주시 노형동", lat: 33.487, lng: 126.476 },
  { region: "제주특별자치도 제주시 일도2동", lat: 33.512, lng: 126.534 },
  { region: "제주특별자치도 서귀포시 동홍동", lat: 33.255, lng: 126.572 },
];

// ── 이름 풀: 100개 (이전 배치와 중복 안 되게) ──
const NAMES = [
  "까망콩", "흰둥이", "치즈", "미키", "미니", "보리", "별이", "달이", "태양이", "구름이",
  "비둘기", "호두", "밤이", "민트", "라떼", "모카", "카라멜", "까미", "점박이", "구찌",
  "사랑이", "행복이", "인절미", "두부", "떡복이", "감자", "고구마", "김치", "단무지", "멜로디",
  "솜이", "솜사탕", "양갱이", "쑥", "누룽지", "짬뽕", "짜장이", "딸기", "망고", "자몽",
  "레몬", "라임", "블루", "보라", "진주", "다이아", "쿠키", "도넛", "와플", "마카롱",
  "베이글", "푸딩", "젤리", "크림", "무지개", "햇님이", "노을이", "바람이", "봄이", "여름이",
  "가을이", "겨울이", "첫눈", "백설이", "잠보", "새벽이", "파파야", "망토", "부엉이", "호랑이",
  "호야", "모찌", "메리", "또또", "마롱", "카푸치노", "에스프레소", "미소", "우유", "냥냥이",
  "옹심이", "단호박", "야옹이", "호일이", "싸리", "빵이", "토토", "곰돌이", "덕배", "만세",
  "칠성이", "별빛", "은하수", "구슬이", "동백이", "매화", "라일락", "둥글이", "강낭콩", "완두콩",
];

const SCENES = [
  "주차장 자동차 아래", "빌라 계단 옆 통풍구", "편의점 앞 평상", "공원 벤치 뒤 화단",
  "재래시장 어귀 박스 위", "카페 야외 테이블 사이", "학교 후문 화단", "약국 입구 매트",
  "교회 화단 그늘", "성당 뒷마당", "지하철역 출구 옆 자전거 거치대", "버스정류장 옆 화단",
  "분수대 근처 그늘", "동사무소 화단", "도서관 뒤편 통풍구", "체육공원 운동기구 옆",
  "아파트 단지 분리수거장", "빌라 옥상 환기구 옆", "공사장 자재 위", "노포 식당 야외 의자 아래",
  "어린이집 담장 옆", "정자 마루 아래", "마을회관 뒤편", "자전거 보관소 안쪽",
  "재개발 빌라 뒷골목", "골목 모퉁이 화분 옆", "빵집 뒷문 통풍구", "세탁소 옆 평상",
];

const COLORS_BY_HINT = {
  // 사진 색상에 따라 추정 가능한 표현. 랜덤하게 선택.
  default: [
    "한 번 보면 잊지 못할 매력", "동네 인기스타", "조용하고 차분한 친구",
    "호기심 많은 친구", "낯가림 좀 있지만 사람 좋아하는", "장난기 많은",
    "느긋한 성격", "도도한 자세가 매력", "쪼끄만 체구에 큰 야옹",
  ],
};

const HABITS = [
  "낮엔 그늘에서 자고 저녁 7시쯤 활동",
  "사료 챙겨주면 한 발 거리 두고 먹음",
  "츄르 받으러 다가올 때만 사람 친화 모드",
  "비 오는 날엔 처마 밑으로 옮겨감",
  "겨울엔 빌라 보일러실 통풍구가 단골 자리",
  "이른 아침에 마실 다니다가 저녁 무렵 다시 옴",
  "단골 자리에 가면 거의 매번 만날 수 있어요",
  "사람 발소리에 익숙해서 도망 안 감",
  "옆에 있는 친구랑 같이 다님",
  "본인 영역 의식 강해서 다른 고양이가 오면 살짝 견제",
  "사진 찍으면 한 번 쳐다보고 다시 식빵",
  "캣맘이 부르면 마지못해 다가오는 츤데레",
];

const CARETAKERS = [
  "동네 캣맘 모임",
  "근처 카페 사장님",
  "빌라 관리인 아저씨",
  "교회 자원봉사자",
  "재래시장 상인회",
  "학교 동물보호 동아리",
  "지역 동물보호단체",
  "노포 식당 사장님",
  "약국 사장님",
  "아파트 부녀회",
  "마을회관 어르신들",
  "이웃 캣대디",
  null, null, // 일부는 캣맘 미상
];

const TNR = [
  "TNR 완료, 왼쪽 귀 이어팁",
  "TNR 완료, 오른쪽 귀 이어팁",
  "TNR 필요 — 포획틀 신청 대기 중",
  "TNR 완료 (작년)",
  "TNR 완료 후 영양 상태 회복",
  "TNR 미완 — 새끼 안 낳도록 곧 진행 예정",
];

const TAGS_POOL = [
  ["TNR 완료", "사람 친화", "성묘"],
  ["TNR 완료", "이어팁", "성묘"],
  ["TNR 필요", "예민", "성묘"],
  ["TNR 완료", "사람 친화", "온순"],
  ["TNR 완료", "야행성", "성묘"],
  ["TNR 완료", "터줏대감", "사람 친화"],
  ["TNR 완료", "포토제닉", "성묘"],
  ["TNR 완료", "겁 많음"],
  ["TNR 완료", "패밀리", "사람 친화"],
];

const pick = (arr, i) => arr[i % arr.length];
const pickOff = (arr, i, off) => arr[(i + off) % arr.length];

function describe(i, region) {
  const area = region.replace(/^.+?\s/, "").replace(/동$|읍$|면$/, "");
  const scene = pick(SCENES, i);
  const habit = pick(HABITS, i + 2);
  const habit2 = pickOff(HABITS, i, 5);
  const caregiver = pick(CARETAKERS, i + 1);
  const tnr = pick(TNR, i + 3);
  const charm = pick(COLORS_BY_HINT.default, i);
  const careLine = caregiver
    ? `${caregiver}이 사료 챙겨주신 지 1년 넘어요.`
    : "캣맘은 아직 정해지지 않았고 동네 분들이 가끔 사료 두고 가세요.";
  return `${area} 일대 ${scene}이 단골 자리. ${habit}. ${charm}. ${careLine} ${tnr}.`;
}

// ── 파일 수집: "(1)" 중복 자동 스킵 + 이전 배치 파일 제외 ──
const PREVIOUS_FILES = new Set([
  // 1차 배치
  "KakaoTalk_20260425_104346100.jpg",
  "KakaoTalk_20260425_104524038.jpg",
  "KakaoTalk_20260425_104819458.jpg",
  "KakaoTalk_20260425_104819458_01.jpg",
  "KakaoTalk_20260425_105033931.jpg",
  "KakaoTalk_20260425_105553384.jpg",
  "KakaoTalk_20260425_105553384_01.jpg",
  "KakaoTalk_20260425_105553384_02.jpg",
  "KakaoTalk_20260425_105553384_03.jpg",
  "KakaoTalk_20260425_105553384_04.jpg",
  "KakaoTalk_20260425_105553384_05.jpg",
  "KakaoTalk_20260425_105553384_06.jpg",
  "KakaoTalk_20260425_105553384_07.jpg",
  "P20240727_004536905_CCD412D6-312F-481C-9E35-40B2E63B969A.JPG",
  // 2차 배치
  "KakaoTalk_20260425_112106133.jpg",
  "KakaoTalk_20260425_112106133_01.jpg",
  "KakaoTalk_20260425_112106133_02.jpg",
  "KakaoTalk_20260425_112106133_03.jpg",
  "KakaoTalk_20260425_112106133_04.jpg",
  "KakaoTalk_20260425_112106133_05.jpg",
  "KakaoTalk_20260425_112106133_06.jpg",
  "KakaoTalk_20260425_112106133_07.jpg",
  "KakaoTalk_20260425_112120462.jpg",
  "KakaoTalk_20260425_112120462_01.jpg",
  "KakaoTalk_20260425_112120462_02.jpg",
  "KakaoTalk_20260425_112159762.jpg",
]);

// 여러 폴더에서 파일 수집 → {dir, file} 페어로
const files = [];
for (const dir of PHOTO_DIRS) {
  const list = readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .filter((f) => !f.includes(" (1)"))
    .filter((f) => !PREVIOUS_FILES.has(f));
  for (const f of list) files.push({ dir, file: f });
}

console.log(`처리할 파일: ${files.length}개`);

let success = 0;
let fail = 0;
const stamp = Date.now();

for (let i = 0; i < files.length; i++) {
  const { dir, file } = files[i];
  const loc = LOCATIONS[i % LOCATIONS.length];
  // 이름은 풀 + 인덱스 회전. 풀을 넘어가면 "둘째/셋째" 접미사로 충돌 회피.
  const cycle = Math.floor(i / NAMES.length);
  const baseName = NAMES[i % NAMES.length];
  const suffix = cycle === 0 ? "" : cycle === 1 ? " 둘째" : ` ${cycle + 1}호`;
  const name = baseName + suffix;
  const description = describe(i, loc.region);
  const tags = pick(TAGS_POOL, i + 7);
  const caretakerName = pick(CARETAKERS, i + 4);

  // 위치에 약간의 랜덤 오프셋 (같은 동에 마커 겹침 방지)
  const jitter = () => (Math.random() - 0.5) * 0.004; // 약 ±200m
  const lat = loc.lat + jitter();
  const lng = loc.lng + jitter();

  try {
    const buf = readFileSync(join(dir, file));
    const ext = file.toLowerCase().endsWith(".png") ? "png" : "jpg";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    const fileName = `dummy-real/${stamp}-${String(i).padStart(3, "0")}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("cat-photos")
      .upload(fileName, buf, { contentType, upsert: false });
    if (upErr) throw new Error(`업로드: ${upErr.message}`);

    const { data: urlData } = supabase.storage
      .from("cat-photos")
      .getPublicUrl(fileName);

    const { error: insertErr } = await supabase.from("cats").insert({
      name,
      description,
      photo_url: urlData.publicUrl,
      lat,
      lng,
      region: loc.region,
      tags,
      caretaker_name: caretakerName,
    });
    if (insertErr) throw new Error(`인서트: ${insertErr.message}`);

    if (i % 10 === 0 || i === files.length - 1) {
      console.log(`✓ [${i + 1}/${files.length}] ${name} (${loc.region})`);
    }
    success++;
  } catch (err) {
    console.error(`✗ [${i + 1}] ${name}:`, err instanceof Error ? err.message : err);
    fail++;
  }
}

console.log(`\n완료: 성공 ${success} / 실패 ${fail} / 총 ${files.length}`);
