// 공용 스켈레톤 컴포넌트 — 로딩 시 단순 스피너 대신 콘텐츠 형태 미리 보여줌.
// CLS(Cumulative Layout Shift) 줄이고 체감 속도 개선.

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const baseStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #EEE8E0 0%, #F5F0E8 50%, #EEE8E0 100%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
};

/** 직사각형 블록 (이미지·카드 등) */
export function SkeletonBlock({ className, style }: SkeletonProps) {
  return <div className={`rounded-lg ${className ?? ""}`} style={{ ...baseStyle, ...style }} />;
}

/** 원형 (아바타·아이콘 등) */
export function SkeletonCircle({ className, style }: SkeletonProps) {
  return <div className={`rounded-full ${className ?? ""}`} style={{ ...baseStyle, ...style }} />;
}

/** 한 줄 텍스트 */
export function SkeletonText({ className, style }: SkeletonProps) {
  return <div className={`rounded-md h-3 ${className ?? ""}`} style={{ ...baseStyle, ...style }} />;
}

/* ═══ 페이지별 컴포지션 ═══ */

/** 고양이 카드 (areas·search) */
export function SkeletonCatCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
      <SkeletonBlock style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
      <div className="p-2.5">
        <SkeletonText className="w-2/3" />
        <SkeletonText className="w-1/2 mt-1.5 h-2.5" />
      </div>
    </div>
  );
}

/** 게시글 카드 (community·search) */
export function SkeletonPostCard() {
  return (
    <div className="rounded-2xl bg-white p-3.5" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <SkeletonText className="w-4/5" />
      <SkeletonText className="w-full mt-2 h-2.5" />
      <SkeletonText className="w-3/5 mt-1 h-2.5" />
      <div className="flex items-center gap-2 mt-2">
        <SkeletonCircle className="w-4 h-4" />
        <SkeletonText className="w-1/4 h-2.5" />
      </div>
    </div>
  );
}

/** 병원 카드 (search·hospitals) */
export function SkeletonHospitalCard() {
  return (
    <div className="rounded-2xl bg-white p-3.5" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <SkeletonText className="w-3/5" />
      <SkeletonText className="w-4/5 mt-2 h-2.5" />
      <SkeletonText className="w-1/3 mt-1.5 h-2.5" />
    </div>
  );
}

/** 통계 카드 (admin/insights) */
export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl bg-white p-3.5" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <SkeletonText className="w-1/3 h-2.5" />
      <SkeletonBlock className="mt-2.5 h-7 w-1/2" />
    </div>
  );
}

/** 리스트 행 (TOP 5 등) */
export function SkeletonListRow() {
  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SkeletonCircle className="w-4 h-4 shrink-0" />
        <SkeletonText className="w-2/3" />
      </div>
      <SkeletonText className="w-10 h-2.5" />
    </div>
  );
}
