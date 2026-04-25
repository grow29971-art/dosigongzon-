// 실제 사진으로 더미 고양이 시드 (2차).
// 실행: node --env-file=.env.local box/seed_real_dummy_cats_2.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ env 누락");
  process.exit(1);
}
const supabase = createClient(url, key);

const PHOTO_DIR = "C:\\Users\\acer\\Desktop\\고양이사진";

const cats = [
  {
    file: "KakaoTalk_20260425_112106133.jpg",
    name: "골목이",
    description:
      "북촌 카페거리 단골. 카페 야외 테이블 사이를 자기 영역처럼 걸어다녀요. 손님들이 사진 찍어도 신경 안 씀. 이 길에서 4년째 봐서 동네 카페 사장님들이 다 알아봐요. TNR 완료.",
    lat: 37.5829,
    lng: 126.9853,
    region: "서울 종로구 가회동",
    tags: ["TNR 완료", "사람 친화", "성묘", "관광객 익숙"],
    caretaker_name: "북촌 카페 모임",
  },
  {
    file: "KakaoTalk_20260425_112106133_01.jpg",
    name: "재개발이",
    description:
      "북아현 재개발 공장 근처 골목 단골. 차들 사이를 잘 피해다녀요. 동네 분이 사료 챙겨주시는데 본인은 거리 두고 먹는 스타일. 작년에 TNR 완료, 왼쪽 귀 이어팁.",
    lat: 37.5587,
    lng: 126.9555,
    region: "서울 서대문구 북아현동",
    tags: ["TNR 완료", "이어팁", "예민", "성묘"],
    caretaker_name: "북아현 동네 모임",
  },
  {
    file: "KakaoTalk_20260425_112106133_02.jpg",
    name: "식빵이",
    description:
      "후암동 골목 노포 야외 의자 다리 사이가 단골 자리. 더울 땐 의자 아래 그늘에서 식빵, 추울 땐 의자 위 방석에서 식빵. 자세 변천사가 풍부함. 사료는 사장님이 매일 챙겨줌.",
    lat: 37.5481,
    lng: 126.978,
    region: "서울 용산구 후암동",
    tags: ["TNR 완료", "사람 친화", "성묘"],
    caretaker_name: "후암동 노포 사장님",
  },
  {
    file: "KakaoTalk_20260425_112106133_03.jpg",
    name: "노랑이",
    description:
      "자양동 빌라 화단 옆 보도블록 위가 본인 산책로. 매일 같은 시간(오후 6시쯤)에 같은 코스 돕니다. 노랑 치즈인데 등쪽이 좀 더 진한 호랑무늬. TNR 완료. 만지는 건 안 됨.",
    lat: 37.5345,
    lng: 127.0817,
    region: "서울 광진구 자양동",
    tags: ["TNR 완료", "이어팁", "성묘", "정시 산책"],
    caretaker_name: "자양1동 캣맘",
  },
  {
    file: "KakaoTalk_20260425_112106133_04.jpg",
    name: "철수와 영희",
    description:
      "청라동 빌라 옆 사료대 단골. 철수(턱시도)는 새침하고 영희(회+흰 얼룩)는 친화적. 둘이 같은 시간에 와서 사이좋게 먹어요. 캣맘이 자동급식기 설치한 후로는 시간 맞춰 와요.",
    lat: 37.5365,
    lng: 126.6451,
    region: "인천 서구 청라동",
    tags: ["TNR 완료", "패밀리", "정시 식사"],
    caretaker_name: "청라 캣맘",
  },
  {
    file: "KakaoTalk_20260425_112106133_05.jpg",
    name: "장군이",
    description:
      "경동시장 안쪽 천막 사이가 본거지. 시장 상인분들이 다 아는 터줏대감. 정육점 사장님이 부산물 챙겨주셔서 영양 상태 좋음. 사람 좋아하지만 만지는 건 본인 컨디션에 따라 다름.",
    lat: 37.5805,
    lng: 127.0383,
    region: "서울 동대문구 제기동",
    tags: ["TNR 완료", "사람 친화", "성묘", "터줏대감"],
    caretaker_name: "경동시장 상인회",
  },
  {
    file: "KakaoTalk_20260425_112106133_06.jpg",
    name: "안전이",
    description:
      "잠실동 약국 앞 자전거 옆이 본인 자리. 약국 사장님이 사료 그릇 두셔서 매일 출근 도장. 손님 와도 도망 안 감. CCTV 안내판 옆에 앉아있는 모습이 동네 시그니처.",
    lat: 37.513,
    lng: 127.1006,
    region: "서울 송파구 잠실동",
    tags: ["TNR 완료", "사람 친화", "성묘", "단골 자리"],
    caretaker_name: "잠실 안전약국 사장님",
  },
  {
    file: "KakaoTalk_20260425_112106133_07.jpg",
    name: "회색이",
    description:
      "우동 해변 산책로 의자 옆에 자주 앉아있어요. 바다 보면서 멍 때리는 게 일과. 산책객들이 사진 많이 찍어가고 가끔 츄르도 받아먹어요. 작년 가을 TNR 완료, 영양 상태 양호.",
    lat: 35.1631,
    lng: 129.1635,
    region: "부산 해운대구 우동",
    tags: ["TNR 완료", "사람 친화", "성묘", "관광객 익숙"],
    caretaker_name: "해운대 캣맘 모임",
  },
  {
    file: "KakaoTalk_20260425_112120462.jpg",
    name: "옥상까망",
    description:
      "동성로 뒷골목 빌라 옥상이 본인 영역. 올라가는 외부 계단으로 자유롭게 다녀요. 검회색 단모인데 햇빛 받으면 약간 갈색기 도는 진한 회색. 캣맘이 옥상에 사료 두는데 잘 받아먹음.",
    lat: 35.8693,
    lng: 128.5947,
    region: "대구 중구 동성로",
    tags: ["TNR 완료", "성묘", "옥상"],
    caretaker_name: "동성로 빌라 캣맘",
  },
  {
    file: "KakaoTalk_20260425_112120462_01.jpg",
    name: "정자이",
    description:
      "오포읍 마을 정자 아래 단골. 정자 나무 바닥 틈으로 들어가서 비도 피하고 더위도 피해요. 어르신들이 손주 보듯 챙겨주시는데 본인은 적당히 거리 둠. 흰 발이 트레이드마크.",
    lat: 37.3245,
    lng: 127.2435,
    region: "경기 광주시 오포읍",
    tags: ["TNR 필요", "예민", "성묘"],
    caretaker_name: "오포 마을 어르신들",
  },
  {
    file: "KakaoTalk_20260425_112120462_02.jpg",
    name: "햇살이",
    description:
      "봉명동 한정식집 정자 위가 일광욕 명소. 점심시간 끝나면 햇살 좋은 자리에 올라가서 한참 누워있어요. 크림색 치즈인데 코랑 발끝이 분홍이 진해서 더 귀여움. 손님 사진 찍기 단골.",
    lat: 36.3582,
    lng: 127.3543,
    region: "대전 유성구 봉명동",
    tags: ["TNR 완료", "사람 친화", "성묘", "포토제닉"],
    caretaker_name: "봉명동 한정식 사장님",
  },
  {
    file: "KakaoTalk_20260425_112159762.jpg",
    name: "그림자",
    description:
      "동명동 카페골목 야간 단골. 낮엔 잘 안 보이고 밤 9시 넘으면 어디선가 나타나요. 풀숲 사이 나무 옆이 단골 자리. 카페 사장님이 닫고 갈 때 사료 챙겨주신 게 1년째.",
    lat: 35.1467,
    lng: 126.9248,
    region: "광주 동구 동명동",
    tags: ["TNR 완료", "이어팁", "야행성", "성묘"],
    caretaker_name: "동명동 카페 사장님",
  },
];

let success = 0;
let fail = 0;
const stamp = Date.now();

for (const [idx, cat] of cats.entries()) {
  try {
    const buf = readFileSync(join(PHOTO_DIR, cat.file));
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
