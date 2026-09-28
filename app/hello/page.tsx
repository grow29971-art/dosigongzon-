import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// 인스타그램 프로필 링크·광고 랜딩 — 그림 한 장 + 버튼 하나.
// 링크는 /hello?utm_source=instagram 으로 건다(SourceCapture가 진입 즉시 출처를 잡는다).
// 버튼은 가입 없이 바로 지도로 — "지도가 곧 온보딩".

export const metadata: Metadata = {
  title: "우리 동네 길고양이 | 도시공존",
  description: "오늘 우리 골목 고양이는 밥을 먹었을까? 동네 길집사들이 함께 기록하는 길고양이 지도.",
  robots: { index: false },
  openGraph: { images: ["/images/hello-hero.jpg"] },
};

export default function HelloPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      <Image
        src="/images/hello-hero.jpg"
        alt="골목 담장 위에 앉은 치즈 고양이"
        fill
        priority
        sizes="(max-width: 512px) 100vw, 512px"
        className="object-cover object-top"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-10 pt-6">
        <p className="text-[15px] font-bold">도시공존</p>

        <div className="mt-auto text-center">
          <p className="text-[17px] font-semibold opacity-90">우리 동네 길고양이 지도</p>
          <h1 className="mt-2 text-[44px] font-extrabold leading-tight">골목의 고양이들</h1>
          <p className="mt-4 text-[15px] leading-relaxed opacity-80">
            “오늘 밥은 누가 줬을까?”
            <br />
            동네 길집사들이 함께 기록해요
          </p>

          <Link
            href="/map"
            className="mt-8 flex h-14 w-full items-center justify-center rounded-lg text-[17px] font-bold text-white press-strong transition-transform"
            style={{ background: "var(--color-primary)" }}
          >
            우리 동네 고양이 보기
          </Link>
          <Link href="/login" className="mt-4 inline-block text-[14px] underline opacity-70">
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    </main>
  );
}
