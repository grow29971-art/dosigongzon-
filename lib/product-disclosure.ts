// 전자상거래법 상품정보제공고시 + 사료관리법 표시의무 — 상품별 고시 정보.
// 상품 수가 적어(대즐 단독 라인업) 코드 상수로 관리한다.
// 라인업 확장 시 products 테이블 disclosure jsonb 컬럼으로 이관할 것.
// 대즐 실값 출처(2026-08-19 공급사 서면): 사료검정증명서(한국사료협회 034호)·
// KFIA 검정서(DAN 2026-05534-2, Registration No. 등 2-174)·HACCP 사료공장증명서
// (충남도지사, 인증 2008-72)·공급사 판매 상세페이지(등록성분량·원료).
// pending=true 항목은 공급사 확인 대기 — 값 확인 즉시 교체.
// ⚠ pending 항목이 남아있는 사료는 실판매(PAYMENT_ENABLED=true) 개시 금지
//   (box/쇼핑오픈_Dday_체크리스트_20260807.md 게이트 8).

export interface DisclosureRow {
  label: string;
  value: string;
  /** 공급사 서면 확인 대기 중 — UI에서 회색 처리 */
  pending?: boolean;
}

export interface ProductDisclosure {
  rows: DisclosureRow[];
  note?: string;
}

const STORAGE_BASE =
  "https://sozxbnvgsougkliibnxl.supabase.co/storage/v1/object/public/cat-photos/products";

// 대즐 치킨&연어 전연령 사료 15kg
const DAZZLE_15KG_ID = "495e4774-68e1-4700-af69-df598e819244";

export const PRODUCT_DISCLOSURES: Record<string, ProductDisclosure> = {
  [DAZZLE_15KG_ID]: {
    rows: [
      { label: "품목·명칭", value: "애완고양이용 배합사료 · 대즐 치킨&연어" },
      { label: "형태", value: "건식 압출성형(익스트루전) 사료" },
      { label: "용도", value: "고양이 전연령(All Life Stages)용 · AAFCO 영양기준 충족 설계" },
      {
        label: "등록성분량",
        value:
          "조단백질 32.0% 이상 · 조지방 12.0% 이상 · 칼슘 1.2% 이상 · 인 0.8% 이상 · 조섬유 4.0% 이하 · 조회분 9.0% 이하 · 수분 14.0% 이하",
      },
      {
        label: "사용원료",
        value:
          "닭고기분말, 연어분말, 옥수수, 대두박, 소맥, 밀기울, 닭기름, 비트펄프, 옥수수글루텐, 크랜베리, 블루베리, 어분, 어유, 계란분말, 보스웰리아, 식이유황(MSM), 맥주효모, 프로바이오틱스, 혼합채소, 타우린, 글루코사민, 비타민·미네랄 프리믹스 등 ※ 유전자변형 옥수수·대두·소맥 포함 가능성 있음",
      },
      { label: "중량", value: "15kg" },
      { label: "제조국", value: "대한민국" },
      {
        label: "제조사",
        value:
          "사조동아원(주) 당진공장 — 충남 당진시 순성면 덕평로 873 · HACCP 적용 사료공장(인증번호 2008-72)",
      },
      {
        label: "등록번호",
        value: "성분등록 등 2-174 · 제조업등록 6440000-502-2007-0008",
      },
      {
        label: "품질검정",
        value:
          "한국사료협회·한국단미사료협회 검정 — 중금속(납·카드뮴·비소·수은·셀레늄)·곰팡이독소(아플라톡신·오크라톡신)·대장균·살모넬라 불검출 (2026-02~03)",
      },
      { label: "유통기한", value: "포장에 표기 · 현재 판매분 2028년 6월까지 (2026-08-19 공급사 확인)" },
      {
        label: "주의사항",
        value:
          "직사광선을 피해 서늘하고 건조한 곳에 보관하고, 개봉 후에는 밀봉해 주세요. 사료 교체 시 7일간 점차 비율을 늘려 주세요. 급여 후 남은 사료와 포장재는 꼭 회수해 주세요.",
      },
      { label: "소비자상담", value: "010-7790-2997 · grow29971@gmail.com" },
    ],
    // 전 항목 공급사 서면·확인 완료 (2026-08-19) — 게이트 8 표시의무 충족.
    // 유통기한은 입고 로트가 바뀌면 "현재 판매분" 연월을 갱신할 것.
  },
};

// 상품 하단 상세 이미지(공급사 제공 상세페이지) — 세로로 긴 원본을 3분할해 lazy 로딩.
export const PRODUCT_DETAIL_IMAGES: Record<string, { src: string; width: number; height: number }[]> = {
  [DAZZLE_15KG_ID]: [
    { src: `${STORAGE_BASE}/product_dazzle_detail_1.jpg`, width: 860, height: 2321 },
    { src: `${STORAGE_BASE}/product_dazzle_detail_2.jpg`, width: 860, height: 2321 },
    { src: `${STORAGE_BASE}/product_dazzle_detail_3.jpg`, width: 860, height: 2321 },
  ],
};
