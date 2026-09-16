// 고양이 상세 서버 렌더 대기 중 스켈레톤 — 지도/홈에서 카드를 탭한 직후
// "안 눌린 줄 알고 다시 누르는" 무반응 구간을 없앤다. page.tsx(계측 동결)는 건드리지 않는 새 파일.
// 2026-09-16 리디자인: 실제 상세와 같은 골격 — 풀블리드 히어로 → 이름 블록(헤어라인) → 구분선 행.

import { SkeletonBlock, SkeletonCircle, SkeletonText } from "@/app/components/Skeleton";

export default function CatDetailLoading() {
  return (
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* 히어로 사진 자리 */}
      <SkeletonBlock style={{ aspectRatio: "4 / 3", borderRadius: 0, width: "100%" }} />

      {/* 이름·지역 */}
      <div className="px-4 pt-4 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <SkeletonText className="w-1/3 h-5" />
        <SkeletonText className="w-1/2 mt-2 h-3" />
        <div className="flex gap-2 mt-3">
          <SkeletonBlock className="h-6 w-16" style={{ borderRadius: "var(--radius-square)" }} />
          <SkeletonBlock className="h-6 w-16" style={{ borderRadius: "var(--radius-square)" }} />
          <SkeletonBlock className="h-6 w-20" style={{ borderRadius: "var(--radius-square)" }} />
        </div>
      </div>

      {/* 구분선 행 2개 */}
      <div className="px-4">
        <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <SkeletonCircle className="w-8 h-8 shrink-0" />
          <SkeletonText className="w-2/3 h-3" />
        </div>
        <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <SkeletonCircle className="w-8 h-8 shrink-0" />
          <SkeletonText className="w-1/2 h-3" />
        </div>
        <div className="py-4">
          <SkeletonText className="w-1/4" />
          <SkeletonText className="w-full mt-2.5 h-2.5" />
          <SkeletonText className="w-4/5 mt-1.5 h-2.5" />
        </div>
      </div>
    </div>
  );
}
