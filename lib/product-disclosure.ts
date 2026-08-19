// 전자상거래법 상품정보제공고시 + 사료관리법 표시의무 — 상품별 고시 정보.
// 상품 수가 적어(대즐 단독 라인업) 코드 상수로 관리한다.
// 라인업 확장 시 products 테이블 disclosure jsonb 컬럼으로 이관할 것.
// pending=true 항목은 공급사 서면(사료성분등록증) 수령 전 — 값 확인 즉시 교체.
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

export const PRODUCT_DISCLOSURES: Record<string, ProductDisclosure> = {
  // 대즐 치킨&연어 전연령 사료 15kg
  "495e4774-68e1-4700-af69-df598e819244": {
    rows: [
      { label: "품목·명칭", value: "고양이 사료 · 대즐 치킨&연어" },
      { label: "형태", value: "건식 사료 (익스트루전)" },
      { label: "용도", value: "고양이 전연령(All Life Stages)용" },
      { label: "등록성분량", value: "조단백 32% 이상 · 조지방 12% 이상" },
      { label: "주원료", value: "닭고기, 연어 등 (돼지고기 무첨가)" },
      { label: "중량", value: "15kg" },
      { label: "제조국", value: "공급사 서면 확인 중", pending: true },
      { label: "제조사·수입사", value: "공급사 서면 확인 중", pending: true },
      { label: "성분등록번호", value: "공급사 서면 확인 중", pending: true },
      { label: "유통기한", value: "포장 별도 표기 (공급사 서면 확인 중)", pending: true },
      {
        label: "주의사항",
        value:
          "직사광선을 피해 서늘하고 건조한 곳에 보관하고, 개봉 후에는 밀봉해 주세요. 급여 후 남은 사료와 포장재는 꼭 회수해 주세요.",
      },
      { label: "소비자상담", value: "010-7790-2997 · grow29971@gmail.com" },
    ],
    note: "확인 중인 항목은 공급사의 사료성분등록 서면을 받는 대로 갱신하며, 확인 전에는 판매를 개시하지 않습니다.",
  },
};
