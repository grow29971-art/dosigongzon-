import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "길을 잃었어요 (404)",
  description: "찾으시는 페이지가 없거나 이동됐어요. 도시공존 홈으로 돌아가주세요.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 60%, #DAC4A3 100%)",
      }}
    >
      <div
        className="w-full max-w-md rounded-[32px] text-center relative overflow-hidden"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          padding: "48px 32px 36px",
        }}
      >
        {/* 장식 원 */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(196,126,90,0.15) 0%, rgba(196,126,90,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(107,142,111,0.12) 0%, rgba(107,142,111,0) 70%)",
          }}
        />

        {/* 일러스트 대체 — 큰 고양이 이모지 + 404 텍스트 */}
        <div className="relative">
          <div className="text-[90px] leading-none mb-2" aria-hidden>
            🐾
          </div>
          <p
            className="text-[14px] font-extrabold tracking-[0.3em] mb-4"
            style={{ color: "#C47E5A" }}
          >
            404
          </p>
          <h1
            className="text-[22px] font-extrabold text-text-main tracking-tight leading-tight mb-2"
          >
            아이를 찾지 못했어요
          </h1>
          <p className="text-[13px] text-text-sub leading-relaxed mb-7">
            주소가 바뀌었거나 삭제된 페이지예요.<br />
            대신 가볼 만한 곳을 준비했어요.
          </p>

          {/* 주요 이동 버튼 */}
          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 4px 14px rgba(196,126,90,0.4)",
              }}
            >
              🏠 홈으로 가기
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/map"
                className="py-2.5 rounded-2xl text-[12.5px] font-bold active:scale-[0.98]"
                style={{
                  background: "#F7F4EE",
                  color: "#A38E7A",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                🗺️ 지도
              </Link>
              <Link
                href="/protection"
                className="py-2.5 rounded-2xl text-[12.5px] font-bold active:scale-[0.98]"
                style={{
                  background: "#F7F4EE",
                  color: "#A38E7A",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                📖 보호지침
              </Link>
              <Link
                href="/community"
                className="py-2.5 rounded-2xl text-[12.5px] font-bold active:scale-[0.98]"
                style={{
                  background: "#F7F4EE",
                  color: "#A38E7A",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                💬 커뮤니티
              </Link>
              <Link
                href="/guide"
                className="py-2.5 rounded-2xl text-[12.5px] font-bold active:scale-[0.98]"
                style={{
                  background: "#F7F4EE",
                  color: "#A38E7A",
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                ✨ 기능 가이드
              </Link>
            </div>
          </div>

          {/* 감성 문구 */}
          <p className="text-[11px] text-text-light mt-6 leading-relaxed">
            길을 잃은 건 오늘 하루의 아주 작은 일이에요.<br />
            동네의 아이들이 기다리고 있어요 💛
          </p>
        </div>
      </div>
    </div>
  );
}
