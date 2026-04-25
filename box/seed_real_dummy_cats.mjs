// 실제 사진으로 더미 고양이 시드 (1회성).
// 실행: node --env-file=.env.local box/seed_real_dummy_cats.mjs
//
// 동작:
//   1) C:\Users\acer\Desktop\고양이사진\*.jpg 를 cat-photos 버킷에 업로드
//   2) public.cats에 caretaker_id=NULL로 인서트 (= 더미 표시, cleanup_dummy_cats.sql로 일괄 삭제 가능)
//
// service_role 키로 RLS 우회. 실패한 항목은 콘솔에 표시 후 다음으로 진행.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

const PHOTO_DIR = "C:\\Users\\acer\\Desktop\\고양이사진";

const cats = [
  {
    file: "KakaoTalk_20260425_104346100.jpg",
    name: "장수",
    description:
      "합정역 4번 출구 골목에서 매일 밤 마주치는 친구. 가로등 켜지면 어디선가 나타나요. 처음엔 도망가더니 6개월 만에 발 옆까지 와요. 왼쪽 귀 컷 있고 TNR 완료입니다. 사료 그릇은 골목 모퉁이 화분 옆.",
    lat: 37.5494,
    lng: 126.9136,
    region: "서울 마포구 합정동",
    tags: ["TNR 완료", "이어팁", "야행성", "성묘"],
    caretaker_name: "합정 1동 캣맘",
  },
  {
    file: "KakaoTalk_20260425_104524038.jpg",
    name: "검둥이",
    description:
      "정릉동 빌라 정원에 사는 검둥이. 낮엔 화단 그늘에서 자고 저녁 7시쯤 밥 먹으러 와요. 사람 좋아하는데 안기는 건 싫어함. 겨울엔 보일러실 쪽 통풍구가 본인 자리.",
    lat: 37.6092,
    lng: 127.015,
    region: "서울 성북구 정릉동",
    tags: ["TNR 완료", "사람 친화", "성묘"],
    caretaker_name: "정릉 캣대디",
  },
  {
    file: "KakaoTalk_20260425_104819458.jpg",
    name: "옥상이",
    description:
      "옥상이 본인 영역인 줄 아는 삼색이. 처마 위가 단골 자리예요. 비 오는 날엔 차고 처마 밑으로 옮겨가요. 4년째 이 동네 지킴이. 가끔 옥상에서 햇볕 쬐며 자는 모습이 보임.",
    lat: 37.491,
    lng: 126.743,
    region: "인천 부평구 부개동",
    tags: ["TNR 완료", "성묘", "영역 인식"],
    caretaker_name: "부개2동 자원봉사",
  },
  {
    file: "KakaoTalk_20260425_104819458_01.jpg",
    name: "처마",
    description:
      "옥상이 동생인지 친척인지 비슷하게 생긴 아이. 같은 처마 위를 공유하지만 시간대가 달라요. 옥상이가 낮이면 얘는 새벽~아침. 사람 보면 입 벌리고 야옹 한 번 길게 해요.",
    lat: 37.4915,
    lng: 126.7438,
    region: "인천 부평구 부개동",
    tags: ["TNR 필요", "성묘", "수다쟁이"],
    caretaker_name: null,
  },
  {
    file: "KakaoTalk_20260425_105033931.jpg",
    name: "콩이",
    description:
      "원미산 둘레길 산책로의 단골손님. 통나무 위가 자기 자리예요. 운동하러 오는 사람한테 익숙해서 인사하면 빤히 쳐다봄. TNR 완료고 동네 캣맘 두 분이 번갈아 사료 챙겨주세요.",
    lat: 37.5037,
    lng: 126.766,
    region: "경기 부천시 원미동",
    tags: ["TNR 완료", "사람 친화", "성묘"],
    caretaker_name: "원미산 캣맘 모임",
  },
  {
    file: "KakaoTalk_20260425_105553384.jpg",
    name: "두식이네",
    description:
      "만수공원 분수대 근처 패밀리. 검은이·삼색이·턱시도 세 마리가 매일 같은 자리에 모여요. 영역 안 다투고 사이좋게 사는 보기 드문 패거리. 사진은 두식이(턱시도)랑 미자(삼색이)가 같이 있을 때.",
    lat: 37.4495,
    lng: 126.749,
    region: "인천 남동구 만수동",
    tags: ["TNR 완료", "패밀리", "사람 친화"],
    caretaker_name: "만수 캣맘 연대",
  },
  {
    file: "KakaoTalk_20260425_105553384_01.jpg",
    name: "삼각이 자매",
    description:
      "정왕동 공원에서 만난 카오스 자매. 항상 같이 다니고 잠도 같이 자요. 한 마리는 작년에 TNR 완료, 다른 한 마리도 잡으려고 노력 중인데 영리해서 포획틀 근처도 안 와요. 새끼는 안 낳은 듯.",
    lat: 37.35,
    lng: 126.747,
    region: "경기 시흥시 정왕동",
    tags: ["TNR 부분", "자매", "예민"],
    caretaker_name: "정왕 동네 모임",
  },
  {
    file: "KakaoTalk_20260425_105553384_02.jpg",
    name: "간장이",
    description:
      "역삼동 뒷골목 햇살 자리의 주인공. 점심시간이면 그 자리에 늘 누워있어요. '간장이~' 부르면 꼬리만 살랑살랑. 직장인들이 다 알아보는 동네 스타. 작년 가을 TNR 완료.",
    lat: 37.5012,
    lng: 127.0366,
    region: "서울 강남구 역삼동",
    tags: ["TNR 완료", "사람 친화", "성묘", "온순"],
    caretaker_name: "역삼 직장인 모임",
  },
  {
    file: "KakaoTalk_20260425_105553384_03.jpg",
    name: "유자",
    description:
      "주안 시장 옆 공사장 자재 위가 단골 자리. 핸디 박스를 의자처럼 써요. 살짝 다가가면 거리 두고 자리 옮김. 신뢰 쌓기 6개월째인데 아직도 1m 안엔 못 들어가요. 사료는 잘 먹어줌.",
    lat: 37.4646,
    lng: 126.6826,
    region: "인천 미추홀구 주안동",
    tags: ["TNR 필요", "겁 많음", "성묘"],
    caretaker_name: null,
  },
  {
    file: "KakaoTalk_20260425_105553384_04.jpg",
    name: "삼순이",
    description:
      "청량리역 뒤편의 단정한 카오스. 자세가 하도 우아해서 동네 사람들이 다 알아요. 캣맘 손길은 아직 무서워하지만 사료는 잘 먹습니다. 겨울 담요 두고 갔는데 잘 쓰는 듯해요.",
    lat: 37.58,
    lng: 127.047,
    region: "서울 동대문구 청량리동",
    tags: ["TNR 완료", "예민", "성묘"],
    caretaker_name: "청량리 캣맘",
  },
  {
    file: "KakaoTalk_20260425_105553384_05.jpg",
    name: "양말이",
    description:
      "상계동 아파트 화단의 양말이. 발끝마다 흰 양말 신은 듯해서 붙인 이름. 수풀 사이 숨숨집에서 자요. 겨울엔 캣맘이 만들어준 스티로폼 집 사용 중. 작년 11월 TNR 완료.",
    lat: 37.662,
    lng: 127.064,
    region: "서울 노원구 상계동",
    tags: ["TNR 완료", "이어팁", "겁 많음"],
    caretaker_name: "상계3동 캣맘",
  },
  {
    file: "KakaoTalk_20260425_105553384_06.jpg",
    name: "얼룩이",
    description:
      "성균관대 후문 단골손님. 학생들이 사료 챙겨주는 학교 주변 터줏대감. 부르면 천천히 다가와요. 수업 끝나는 시간에 정문 앞으로 마중 나오는 영리함. TNR 완료.",
    lat: 37.586,
    lng: 127.001,
    region: "서울 종로구 명륜동",
    tags: ["TNR 완료", "사람 친화", "성묘", "영리함"],
    caretaker_name: "성대 동물보호 동아리",
  },
  {
    file: "KakaoTalk_20260425_105553384_07.jpg",
    name: "반달이",
    description:
      "송도 카페거리 식빵자세 마스터. 가슴팍 흰 무늬가 반달 모양이라 반달이. 식빵 자세로 사람 구경하는 게 취미. 사진 잘 찍혀서 카페 손님들 인스타에도 자주 등장.",
    lat: 37.3879,
    lng: 126.658,
    region: "인천 연수구 송도동",
    tags: ["TNR 완료", "사람 친화", "성묘", "포토제닉"],
    caretaker_name: "송도 카페 사장님 모임",
  },
  {
    file: "P20240727_004536905_CCD412D6-312F-481C-9E35-40B2E63B969A.JPG",
    name: "꼬물이",
    description:
      "어미 잃고 구조한 아기. 현재 임시보호 중이고 눈 뜬 지 얼마 안 됐을 때 발견했어요. 분유랑 캔으로 키우는 중. 곧 입양 보낼 예정인데 너무 예뻐서 보내기 싫음... 잠 잘 때 분홍 발바닥이 진짜 반칙.",
    lat: 37.3669,
    lng: 127.1083,
    region: "경기 성남시 분당구 정자동",
    tags: ["임시보호", "아기 고양이", "입양 대기"],
    caretaker_name: "분당 임보처",
  },
];

let success = 0;
let fail = 0;
const stamp = Date.now();

for (const [idx, cat] of cats.entries()) {
  try {
    const buf = readFileSync(join(PHOTO_DIR, cat.file));
    // Supabase Storage는 ASCII만 허용 → 인덱스+랜덤으로 키 생성
    const fileName = `dummy-real/${stamp}-${String(idx).padStart(2, "0")}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: upErr } = await supabase.storage
      .from("cat-photos")
      .upload(fileName, buf, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw new Error(`업로드: ${upErr.message}`);

    const { data: urlData } = supabase.storage
      .from("cat-photos")
      .getPublicUrl(fileName);

    const { error: insertErr } = await supabase.from("cats").insert({
      name: cat.name,
      description: cat.description,
      photo_url: urlData.publicUrl,
      lat: cat.lat,
      lng: cat.lng,
      region: cat.region,
      tags: cat.tags,
      caretaker_name: cat.caretaker_name,
    });
    if (insertErr) throw new Error(`인서트: ${insertErr.message}`);

    console.log(`✓ ${cat.name} (${cat.region})`);
    success++;
  } catch (err) {
    console.error(`✗ ${cat.name}:`, err instanceof Error ? err.message : err);
    fail++;
  }
}

console.log(`\n완료: 성공 ${success} / 실패 ${fail} / 총 ${cats.length}`);
