export interface NewsItem {
  id: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  gradient: string;
  image: string;
  title: string;
  desc: string;
  date: string;
  dday: string;
  body: string;
  externalUrl?: string;
  externalLabel?: string;
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: "news-1",
    badge: "행사",
    badgeColor: "#C47E5A",
    badgeBg: "#EEE8E0",
    gradient: "linear-gradient(135deg, #EEE8E0 0%, #E5DCCF 100%)",
    image: "https://placehold.co/800x450/EEE8E0/C47E5A?text=CAT+FESTA+2026",
    title: "2026 궁디팡팡 캣페스타",
    desc: "전국 최대 고양이 문화 축제가 서울에서 열립니다",
    date: "5월 15일",
    dday: "D-38",
    body: `전국 최대 규모의 고양이 문화 축제 '2026 궁디팡팡 캣페스타'가 올해도 서울에서 개최됩니다.

일시: 2026년 5월 15일(금) ~ 5월 17일(일)
장소: 서울 코엑스 Hall A

주요 프로그램:
• 전국 길고양이 보호 단체 부스 120여 개
• 수의사와 함께하는 무료 건강 상담
• 고양이 용품 나눔 마켓
• TNR 사업 성과 발표 세미나
• 길고양이 사진 공모전 시상식

입장료: 무료 (사전 등록 시 기념품 증정)

올해는 특별히 '길고양이와 도시 공존' 주제로 지자체 협력 사례를 공유하는 포럼이 마련됩니다. 전국의 캣맘, 캣대디분들과 함께 소통할 수 있는 소중한 기회입니다.`,
    externalUrl: "https://www.catfesta.kr",
    externalLabel: "궁디팡팡 공식 홈페이지",
  },
  {
    id: "news-2",
    badge: "TNR",
    badgeColor: "#6B8E6F",
    badgeBg: "#E8ECE5",
    gradient: "linear-gradient(135deg, #E8ECE5 0%, #D6DCD2 100%)",
    image: "https://placehold.co/800x450/E8ECE5/6B8E6F?text=TNR+Program",
    title: "인천시 남동구 상반기 길고양이 TNR 접수 안내",
    desc: "남동구 관내 길고양이 중성화 수술 무료 지원",
    date: "4월 10일 시작",
    dday: "D-3",
    body: `인천광역시 남동구에서 2026년 상반기 길고양이 TNR(포획-중성화-방사) 사업 접수를 시작합니다.

접수 기간: 2026년 4월 10일(목) ~ 예산 소진 시까지
대상 지역: 남동구 전 지역
수술 비용: 전액 무료 (구비 지원)

신청 방법:
1. 남동구청 동물보호 담당부서 전화 접수 (032-453-2580)
2. 인천시 동물보호관리시스템 온라인 접수

신청 시 필요 사항:
• 길고양이 발견 장소 (상세 주소)
• 예상 개체 수
• 신청자 연락처
• 급식 여부 및 돌봄 상태

유의 사항:
• 이어팁이 있는 고양이는 이미 중성화된 개체입니다
• 포획 틀은 구청에서 무상 대여 가능합니다
• 수술 후 1~2일 안정 후 원래 장소에 방사해주세요`,
    externalUrl: "https://www.namdong.go.kr",
    externalLabel: "남동구청 홈페이지",
  },
  {
    id: "news-3",
    badge: "법령",
    badgeColor: "#7A6B8E",
    badgeBg: "#EAE6E8",
    gradient: "linear-gradient(135deg, #EAE6E8 0%, #DCD6D9 100%)",
    image: "https://placehold.co/800x450/EAE6E8/7A6B8E?text=Animal+Protection+Law",
    title: "개정 동물보호법 '학대 처벌 강화' 안내",
    desc: "상습 학대 시 형의 1/2 가중, 사육 제한 명령 신설",
    date: "2026.04.01 시행",
    dday: "시행중",
    body: `2026년 4월 1일부터 개정된 동물보호법이 시행됩니다. 주요 변경 사항을 안내드립니다.

주요 개정 내용:

1. 학대 처벌 강화 (제8조)
• 기존: 2년 이하 징역 또는 2,000만원 이하 벌금
• 개정: 3년 이하 징역 또는 3,000만원 이하 벌금
• 상습범: 형의 1/2 가중

2. 사육 제한 명령 신설 (제46조의2)
• 학대 전력자에 대해 최대 5년간 동물 사육 금지
• 위반 시 1년 이하 징역 또는 1,000만원 이하 벌금

3. 신고자 보호 강화 (제14조)
• 학대 신고자 개인정보 보호 의무화
• 신고자에 대한 불이익 금지 조항 신설

4. 길고양이 보호 확대 (제24조의2)
• 지자체 TNR 사업 의무화 (기존: 권장)
• 숨숨집·급식소 훼손 시 재물손괴죄 + 동물보호법 위반 병과 가능

동물학대를 목격하셨다면:
• 경찰 112
• 동물보호콜센터 1577-0954
• 동물보호관리시스템 animal.go.kr`,
    externalUrl: "https://www.law.go.kr",
    externalLabel: "국가법령정보센터",
  },
];

export function getNewsById(id: string): NewsItem | undefined {
  return NEWS_ITEMS.find((n) => n.id === id);
}
