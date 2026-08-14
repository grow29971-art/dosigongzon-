// 세계 고양이의 날 보신각 집회 홍보 배너 (2026-08-08 오후 4시, 주최 헬프캣츠 · 후원 도시공존)
// 홈 최상단(로그인/비로그인 공통) 노출 — 집회 다음 날부터 자동 숨김
import Image from "next/image";
import RallyJoinButton from "@/app/components/RallyJoinButton";

const HIDE_AFTER = new Date("2026-08-09T00:00:00+09:00");

export default function RallyPosterBanner() {
  if (new Date() >= HIDE_AFTER) return null;
  return (
    <div className="mb-4">
      <a
        href="/events/rally-20260808-v2.jpg"
        target="_blank"
        rel="noopener"
        className="block active:scale-[0.99] transition-transform"
        style={{
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 12px 32px rgba(173,94,59,0.22)",
          border: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <Image
          src="/events/rally-20260808-v2.jpg"
          alt="공존 캠페인 — 세계 고양이의 날 보신각 집회. 길고양이 처우개선 촉구, 자원봉사자·스텝·집회참여자 대모집. 8월 8일 토요일 오후 4시, 보신각 앞(종각역). 문의·신청 @helpcats2004 / @helpcats2019 DM. 주최 헬프캣츠, 후원 도시공존"
          width={1080}
          height={1080}
          priority
          className="w-full h-auto"
        />
      </a>
      <RallyJoinButton />
      {/* 후원사와 주최자의 책임 범위를 명확히 — 참여자 모집·인원 집계를 앱에서 하다 보니
          공동주최로 오인될 소지가 있다. (2026-08-06) */}
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-text-light">
        주최 <b>헬프캣츠</b> · 후원 도시공존. 행사 운영과 현장 안전관리 책임은 주최 측에 있으며,
        문의는 주최 측 채널(@helpcats2004 / @helpcats2019)로 부탁드려요.
        미성년자는 보호자 동반 또는 사전 동의가 필요해요.
      </p>
    </div>
  );
}
