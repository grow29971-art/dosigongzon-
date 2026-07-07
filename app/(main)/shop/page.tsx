import { ShoppingBag } from "lucide-react";

export const metadata = {
  title: "쇼핑몰 — 도시공존",
  description: "도시공존 쇼핑몰이 곧 오픈합니다.",
};

export default function ShopPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "linear-gradient(135deg, #f5e6d8 0%, #e8c9a8 100%)" }}
      >
        <ShoppingBag size={36} style={{ color: "#4C82BC" }} />
      </div>
      <h1 className="text-[22px] font-extrabold text-text-main mb-3">쇼핑몰 준비 중</h1>
      <p className="text-[14px] text-text-sub leading-relaxed">
        도시공존 쇼핑몰이 곧 오픈합니다.
        <br />
        조금만 기다려 주세요!
      </p>
    </div>
  );
}
