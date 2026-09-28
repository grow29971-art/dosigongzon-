"use client";

import Image from "next/image";
import Link from "next/link";

// 첫 방문 화면 — 그림 한 장 + 버튼 하나. /hello(인스타 링크)와 비로그인 첫 방문 홈(오버레이)에서 같이 쓴다.
// 버튼을 누르면 hello_seen 쿠키를 심어 홈에서 다시 뜨지 않게 한다(app/(main)/page.tsx가 읽음).
function markSeen() {
  document.cookie = `hello_seen=1; max-age=31536000; path=/; samesite=lax`;
}

export default function HelloScreen({ overlay = false }: { overlay?: boolean }) {
  return (
    <main
      className={`${overlay ? "fixed inset-0 z-[100]" : "relative min-h-dvh"} overflow-hidden bg-black text-white`}
    >
      <Image
        src="/images/hello-hero.jpg"
        alt="골목 담장 위에 앉은 치즈 고양이"
        fill
        priority
        sizes="(max-width: 512px) 100vw, 512px"
        className="object-cover object-top"
      />

      <div className="relative mx-auto flex h-full min-h-dvh w-full max-w-lg flex-col px-6 pb-10 pt-6">
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
            onClick={markSeen}
            className="mt-8 flex h-14 w-full items-center justify-center rounded-lg text-[17px] font-bold text-white press-strong transition-transform"
            style={{ background: "var(--color-primary)" }}
          >
            우리 동네 고양이 보기
          </Link>
          <Link href="/login" onClick={markSeen} className="mt-4 inline-block text-[14px] underline opacity-70">
            이미 계정이 있어요
          </Link>
        </div>
      </div>
    </main>
  );
}
