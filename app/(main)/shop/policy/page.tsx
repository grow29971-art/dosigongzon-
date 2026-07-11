// 쇼핑몰 이용안내 — 판매자 정보 · 배송 · 교환/반품 · 환불 (전자상거래법 고지)
// 읽기 전용 → 서버 컴포넌트. 사업자 등록 완료 시 판매자 정보 채울 것.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "쇼핑몰 이용안내 | 도시공존",
  description: "도시공존 쇼핑몰의 배송, 교환/반품, 환불 규정 안내",
};

const CONTACT_EMAIL = "grow29971@gmail.com";

const sectionStyle = {
  background: "#fff",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-card)",
  border: "1px solid rgba(0,0,0,0.04)",
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="text-[12px] font-bold text-text-light w-[92px] shrink-0">{label}</span>
      <span className="text-[12.5px] font-semibold text-text-main">{value}</span>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-[12.5px] text-text-sub leading-relaxed">
      <span className="shrink-0" style={{ color: "var(--color-primary)" }}>·</span>
      <span>{children}</span>
    </li>
  );
}

export default function ShopPolicyPage() {
  return (
    <div className="pb-24">
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/shop"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="쇼핑몰로 돌아가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <h1 className="text-[16px] font-extrabold text-text-main">쇼핑몰 이용안내</h1>
      </div>

      <div className="px-4 mt-3 space-y-4">
        {/* 판매자 정보 */}
        <section className="p-4" style={sectionStyle}>
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2">판매자 정보</h2>
          <Row label="상호" value="도시공존 (사업자 등록 절차 진행 중)" />
          <Row label="사업자등록번호" value="등록 완료 후 고지 예정" />
          <Row label="통신판매업 신고" value="등록 완료 후 고지 예정" />
          <Row label="문의" value={CONTACT_EMAIL} />
          <p className="text-[11px] text-text-light mt-2 leading-relaxed">
            현재 쇼핑몰은 정식 오픈 준비 중이며, 사업자 등록이 완료되는 대로 위
            정보를 갱신해 고지합니다.
          </p>
        </section>

        {/* 배송 안내 */}
        <section className="p-4" style={sectionStyle}>
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2.5">배송 안내</h2>
          <ul className="space-y-1.5">
            <Item>결제 확인 후 영업일 기준 2~5일 이내에 택배로 발송돼요.</Item>
            <Item>배송비는 상품별로 표기되며, 주문서에서 최종 배송비를 확인할 수 있어요.</Item>
            <Item>후원(가상) 상품은 배송이 없는 상품으로, 배송지 입력 없이 결제돼요.</Item>
            <Item>도서·산간 지역은 추가 배송비가 발생할 수 있어요. 이 경우 발송 전에 안내드려요.</Item>
          </ul>
        </section>

        {/* 교환·반품 안내 */}
        <section className="p-4" style={sectionStyle}>
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2.5">교환·반품 안내</h2>
          <ul className="space-y-1.5">
            <Item>상품을 받은 날부터 <b className="text-text-main">7일 이내</b>에 교환·반품을 신청할 수 있어요. (전자상거래법 제17조)</Item>
            <Item>단순 변심에 의한 교환·반품은 왕복 배송비를 구매자가 부담해요.</Item>
            <Item>상품 하자·오배송의 경우 배송비 전액을 판매자가 부담해요.</Item>
            <Item>
              다음의 경우에는 교환·반품이 어려워요: 사용·훼손으로 상품 가치가 떨어진 경우,
              포장 개봉으로 재판매가 곤란한 경우, 시간이 지나 재판매가 어려울 정도로 상품
              가치가 하락한 경우.
            </Item>
            <Item>교환·반품 신청은 이메일({CONTACT_EMAIL}) 또는 마이페이지 1:1 문의로 접수해주세요.</Item>
          </ul>
        </section>

        {/* 환불 안내 */}
        <section className="p-4" style={sectionStyle}>
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2.5">환불 안내</h2>
          <ul className="space-y-1.5">
            <Item>환불은 결제한 수단으로 진행되며, 카드 결제 취소는 카드사 사정에 따라 3~5영업일이 걸릴 수 있어요.</Item>
            <Item>배송 시작 전 주문은 주문 상세에서 직접 취소할 수 있어요.</Item>
            <Item>후원(가상) 상품은 결제일부터 7일 이내 요청 시 전액 환불돼요.</Item>
          </ul>
        </section>

        {/* 후원 안내 */}
        <section className="p-4" style={sectionStyle}>
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2.5">수익의 사용</h2>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            쇼핑몰 수익의 일부는 길고양이 쉼터 설치와 구조 활동에 사용돼요. 누적
            현황은 쇼핑몰 홈의 진행바에서 투명하게 공개하고 있어요 💛
          </p>
        </section>
      </div>
    </div>
  );
}
