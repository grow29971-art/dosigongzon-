import Link from "next/link";
import { ArrowLeft, Film } from "lucide-react";

export default function EmptyShorts() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#0E0E10", color: "#FFFFFF" }}
    >
      <Link
        href="/"
        className="absolute top-12 left-5 w-10 h-10 rounded-full flex items-center justify-center active:scale-90"
        style={{ background: "rgba(255,255,255,0.1)" }}
        aria-label="홈으로"
      >
        <ArrowLeft size={18} color="#FFFFFF" />
      </Link>
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
        style={{
          background: "rgba(196,126,90,0.18)",
          border: "1px solid rgba(196,126,90,0.35)",
        }}
      >
        <Film size={38} color="#E8B57E" strokeWidth={1.5} />
      </div>
      <h1 className="text-[20px] font-extrabold tracking-tight mb-2">
        곧 첫 영상이 올라가요
      </h1>
      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
        운영자가 직접 찍거나 큐레이션한
        <br />
        고양이·강아지 영상이 차곡차곡 쌓일 자리예요.
      </p>
      <Link
        href="/"
        className="mt-7 px-5 py-2.5 rounded-full text-[12.5px] font-extrabold active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
          color: "#FFFFFF",
          boxShadow: "0 8px 22px rgba(196,126,90,0.35)",
        }}
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
