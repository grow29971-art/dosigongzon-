"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import {
  listPharmacyGuideItems,
  type PharmacyGuideItem,
} from "@/lib/pharmacy-guide-repo";

export default function PharmacyGuidePage() {
  const router = useRouter();
  const [items, setItems] = useState<PharmacyGuideItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPharmacyGuideItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main">동물약국 약품 가이드</h1>
          <p className="text-[11px] text-text-sub mt-0.5">길고양이 돌봄에 쓰이는 약품·영양제</p>
        </div>
      </div>

      {/* 주의사항 */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 mb-5"
        style={{
          background: "linear-gradient(135deg, #FBEAEA 0%, #FFF 100%)",
          borderRadius: 18,
          border: "1px solid rgba(216,85,85,0.15)",
        }}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: "#D85555" }} />
        <div>
          <p className="text-[12px] font-bold leading-snug" style={{ color: "#B84545" }}>약품 구매·사용 전 확인</p>
          <p className="text-[11px] text-text-sub mt-1 leading-relaxed">
            정확한 용량과 투여 방법은 <strong>수의사 상담</strong> 후 결정하세요.
            증상이 심한 경우 <strong>동물병원</strong>을 방문하세요.
          </p>
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && items.length === 0 && (
        <div className="py-16 text-center text-[13px] text-text-sub">
          아직 등록된 약품이 없어요.
        </div>
      )}

      {/* 제품 카드 */}
      <div className="space-y-4">
        {items.map((p) => (
          <article
            key={p.id}
            className="overflow-hidden"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="w-full h-48 object-cover" />
            )}
            {!p.image_url && (
              <div
                className="w-full h-36 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${p.color}18 0%, ${p.color}08 100%)` }}
              >
                <span className="text-[14px] font-bold" style={{ color: p.color }}>{p.category}</span>
              </div>
            )}

            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg" style={{ backgroundColor: p.color, color: "#fff" }}>
                  {p.category}
                </span>
                {p.brand && <span className="text-[10px] text-text-light">{p.brand}</span>}
              </div>

              <h3 className="text-[16px] font-extrabold text-text-main mb-2 leading-tight">{p.name}</h3>
              <p className="text-[13px] text-text-sub leading-relaxed mb-4">{p.description}</p>

              {p.usage_info && (
                <div className="px-3.5 py-3 rounded-xl mb-2.5" style={{ backgroundColor: `${p.color}10` }}>
                  <p className="text-[11px] font-extrabold mb-1" style={{ color: p.color }}>사용법</p>
                  <p className="text-[12px] text-text-main leading-relaxed">{p.usage_info}</p>
                </div>
              )}

              {p.tip && (
                <div className="px-3.5 py-3 rounded-xl mb-3" style={{ backgroundColor: "#FDF9F2" }}>
                  <p className="text-[11px] font-extrabold mb-1 text-primary">💡 알아두세요</p>
                  <p className="text-[12px] text-text-main leading-relaxed">{p.tip}</p>
                </div>
              )}

              {p.price && (
                <span className="text-[13px] font-bold" style={{ color: p.color }}>{p.price}</span>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* 하단 */}
      {!loading && items.length > 0 && (
        <div className="mt-6 px-5 py-4 text-center" style={{ background: "#FFFFFF", borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.04)" }}>
          <p className="text-[13px] font-bold text-text-main mb-1">가까운 동물약국 찾기</p>
          <p className="text-[11px] text-text-sub mb-3">지도에서 💊 보라색 마커를 탭하면 약국 정보를 확인할 수 있어요</p>
          <button onClick={() => router.push("/map")} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white active:scale-[0.97] transition-transform" style={{ background: "linear-gradient(135deg, #9B6DD7 0%, #7B4FBF 100%)", boxShadow: "0 6px 16px rgba(155,109,215,0.35)" }}>
            지도에서 동물약국 보기
          </button>
        </div>
      )}
    </div>
  );
}
