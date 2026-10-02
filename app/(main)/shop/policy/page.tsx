// 쇼핑몰 이용안내 — 판매자 정보 · 배송 · 교환/반품 · 환불 (전자상거래법 고지)
// 읽기 전용 → 서버 컴포넌트. 사업자 등록 완료 시 판매자 정보 채울 것.
// 2026-09-16 리디자인: 카드 대신 헤어라인 구획 — 본문 문자열은 법정 고지라 손대지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
// 반품 배송비 고지는 정책 상수를 직접 렌더 — lib/refund-policy.ts와 불일치가 원천 불가능
import { RETURN_SHIPPING_FEE_BASE } from "@/lib/refund-policy";

export const metadata: Metadata = {
  title: "쇼핑몰 이용안내 | 도시공존",
  description: "도시공존 쇼핑몰의 배송, 교환/반품, 환불 규정 안내",
};

const CONTACT_EMAIL = "grow29971@gmail.com";

const sectionStyle = {
  borderBottom: "1px solid var(--color-divider)",
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="text-[13px] text-text-light w-[92px] shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-text-main">{value}</span>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-[13px] text-text-sub leading-relaxed">
      <span className="shrink-0 text-text-light">·</span>
      <span>{children}</span>
    </li>
  );
}

export default function ShopPolicyPage() {
  return (
    <div className="pb-24">
      <div className="px-4 pt-12 pb-2 flex items-center gap-1">
        <Link data-page-back
          href="/shop"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="쇼핑몰로 돌아가기"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </Link>
        <h1 className="text-[17px] font-bold text-text-main">쇼핑몰 이용안내</h1>
      </div>

      <div className="px-4">
        {/* 판매자 정보 */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2">판매자 정보</h2>
          <Row label="상호" value="도시공존" />
          <Row label="대표자" value="김성우" />
          <Row label="사업자등록번호" value="793-16-02886" />
          <Row label="통신판매업 신고" value="제2026-인천검단-0207호" />
          <Row label="사업장 주소" value="인천광역시 검단구 원당대로820번길 35, 초롱마을 13동 401호 (당하동)" />
          <Row label="전화" value="010-7790-2997" />
          <Row label="문의" value={CONTACT_EMAIL} />
        </section>

        {/* 호스팅·결제 — 전자상거래법 제10조(호스팅 사업자 표시)·제13조(결제 방법). 판매자 정보 블록은
            토스 카드사 심사 중 동결이라 별도 구획으로 둔다(2026-09-28). */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2">호스팅·결제</h2>
          <Row label="호스팅 제공자" value="Vercel Inc." />
          <Row label="결제대행" value="토스페이먼츠(주)" />
          <p className="mt-1.5 text-[13px] text-text-sub leading-relaxed">
            결제는 신용·체크카드(간편결제 포함)로만 받으며, 결제대금예치(에스크로) 서비스는 이용하지 않아요.
          </p>
        </section>

        {/* 배송 안내 */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">배송 안내</h2>
          <ul className="space-y-1.5">
            <Item>결제 확인 후 영업일 기준 2~5일 이내에 택배로 발송돼요.</Item>
            <Item>배송비는 상품별로 표기되며, 주문서에서 최종 배송비를 확인할 수 있어요.</Item>
            <Item>여러 상품·수량을 함께 주문해도 합포장으로 보내드려서 배송비는 1회(가장 높은 상품 배송비)만 부과돼요.</Item>
            <Item>후원(가상) 상품은 배송이 없는 상품으로, 배송지 입력 없이 결제돼요.</Item>
            <Item>도서·산간 지역은 추가 배송비가 발생할 수 있어요. 이 경우 발송 전에 안내드려요.</Item>
          </ul>
        </section>

        {/* 교환·반품 안내 */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">교환·반품 안내</h2>
          <ul className="space-y-1.5">
            <Item>상품을 받은 날부터 <b className="text-text-main">7일 이내</b>에 교환·반품을 신청할 수 있어요. (전자상거래법 제17조)</Item>
            <Item>
              단순 변심에 의한 교환·반품은 왕복 배송비를 구매자가 부담해요. 반품 배송비는
              주문 시 결제한 배송비와 같은 금액이 환불액에서 차감되며, 무료배송 상품은 왕복
              택배 실비 {(RETURN_SHIPPING_FEE_BASE * 2).toLocaleString()}원이 차감돼요.
            </Item>
            <Item>상품 하자·오배송의 경우 배송비 전액을 판매자가 부담해요.</Item>
            <Item>
              받은 상품이 표시·광고 내용과 다르거나 계약과 다르게 배송된 경우에는 <b className="text-text-main">받은 날부터 3개월 이내</b>,
              그 사실을 안 날(또는 알 수 있었던 날)부터 30일 이내에 교환·반품할 수 있어요. (전자상거래법 제17조 제3항)
            </Item>
            <Item>
              다음의 경우에는 교환·반품이 어려워요: 사용·훼손으로 상품 가치가 떨어진 경우,
              포장 개봉으로 재판매가 곤란한 경우, 시간이 지나 재판매가 어려울 정도로 상품
              가치가 하락한 경우.
            </Item>
            <Item>
              환불 신청은 주문 상세의 환불 요청으로 할 수 있어요. 비회원은 주문한 기기의 주문 내역에서 신청하고,
              다른 기기라면 주문번호와 함께 이메일({CONTACT_EMAIL})로 알려주세요. 교환은 이메일 또는 마이페이지 1:1 문의로 접수해주세요.
            </Item>
          </ul>
        </section>

        {/* 가격 표시 — 전자상거래법 총액표시 (2026-08-26 원탁회의 세무 게이트) */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">가격 표시</h2>
          <p className="text-[13px] text-text-sub leading-relaxed">
            쇼핑몰의 모든 상품 가격과 배송비는 <b>부가가치세(VAT)가 포함된 최종 금액</b>이에요.
            표시된 금액 외에 추가로 청구되는 세금은 없어요.
          </p>
        </section>

        {/* 환불 안내 */}
        <section className="py-4" style={sectionStyle}>
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">환불 안내</h2>
          <ul className="space-y-1.5">
            <Item>
              반품 상품을 돌려받은 날(배송 전 취소는 취소 신청일)부터 <b className="text-text-main">3영업일 이내</b>에 환불해요.
              카드 결제는 이 기간 안에 카드사에 결제 취소를 요청하며, 실제 카드 대금 반영은 카드사 사정에 따라 3~5영업일이 더 걸릴 수 있어요.
            </Item>
            <Item>
              판매자 사정으로 환불이 늦어지면, 늦어진 기간만큼 연 15%의 지연배상금을 함께 지급해요. (전자상거래법 제18조 제2항, 시행령 제21조의3)
            </Item>
            <Item>환불할 때 그 주문으로 모인 후원 금액도 함께 조정되며, 쇼핑몰 홈의 후원 현황에 반영돼요.</Item>
            <Item>배송 시작 전 주문은 주문 상세에서 직접 취소할 수 있어요. 상품 준비 중이면 발주 취소를 확인한 뒤 환불돼요.</Item>
          </ul>
        </section>

        {/* 후원 안내 */}
        <section className="py-4">
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">수익의 사용</h2>
          <p className="text-[13px] text-text-sub leading-relaxed">
            일반 상품은 <b>수익(이익)의 10%</b>가 중성화(TNR)·쉼터 입소 등 길고양이 케어에 사용돼요.
            도시공존은 <b>길냥이쉼터 묘연</b>과 협약해, 이용자가 구조한 고양이가 쉼터에 입소할 수 있도록 지원해요.
            입소 문의는 마이페이지 1:1 문의나 이메일({CONTACT_EMAIL})로 받아요. 입소 여부와 비용은 쉼터 심사로 결정되며,
            입소가 보장되지는 않아요. 구조 전에 동물등록 조회·지자체 보호공고로 주인이 있는 아이인지 먼저 확인해 주세요.
            (전액 후원 상품은 결제 금액 전액) 상품별 비율은 상품 상세에서 확인할 수 있고,
            모인 금액·쓰인 금액·잔액은 쇼핑몰 홈에서 그대로 공개하고 있어요.
          </p>
        </section>
      </div>
    </div>
  );
}
