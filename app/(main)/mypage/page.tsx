import { User, ChevronRight } from "lucide-react";

export default function MyPage() {
  return (
    <div className="px-5 pt-14 pb-4">
      <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">마이페이지</h1>

      {/* 프로필 카드 */}
      <div className="card p-5 mt-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-[22px] bg-primary flex items-center justify-center shrink-0">
          <User size={36} color="#fff" strokeWidth={1.8} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-extrabold text-text-main">게스트</p>
          <p className="text-[13px] text-text-light mt-0.5">로그인하고 커뮤니티에 참여하세요</p>
        </div>
        <ChevronRight size={20} className="text-text-muted" />
      </div>

      {/* 메뉴 */}
      <div className="card mt-4 overflow-hidden">
        {["내가 쓴 글", "좋아요 한 글", "알림 설정", "공지사항", "문의하기"].map((label, i, arr) => (
          <button key={label} className={`w-full flex items-center justify-between px-5 py-4 text-left active:bg-surface-alt transition-colors ${i < arr.length - 1 ? "border-b border-divider" : ""}`}>
            <span className="text-[15px] font-medium text-text-main">{label}</span>
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-text-muted mt-6">도시공존 v0.1.0</p>
    </div>
  );
}
