// 고양이 상세 서버 렌더 대기 중 스켈레톤 — 지도/홈에서 카드를 탭한 직후
// "안 눌린 줄 알고 다시 누르는" 무반응 구간을 없앤다. page.tsx(계측 동결)는 건드리지 않는 새 파일.

import { SkeletonBlock, SkeletonCircle, SkeletonText } from "@/app/components/Skeleton";

export default function CatDetailLoading() {
  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      {/* 히어로 사진 자리 */}
      <SkeletonBlock style={{ aspectRatio: "1 / 1", borderRadius: 0, width: "100%" }} />

      <div className="px-4 -mt-6">
        {/* 이름·지역 카드 */}
        <div className="rounded-3xl bg-white p-4" style={{ boxShadow: "var(--shadow-raised)" }}>
          <div className="flex items-center gap-3">
            <SkeletonCircle className="w-12 h-12 shrink-0" />
            <div className="flex-1 min-w-0">
              <SkeletonText className="w-1/3 h-4" />
              <SkeletonText className="w-1/2 mt-2 h-2.5" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <SkeletonBlock className="h-7 w-16 rounded-full" />
            <SkeletonBlock className="h-7 w-16 rounded-full" />
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </div>
        </div>

        {/* 본문 카드 2장 */}
        <div className="rounded-2xl bg-white p-4 mt-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <SkeletonText className="w-1/4" />
          <SkeletonText className="w-full mt-2.5 h-2.5" />
          <SkeletonText className="w-4/5 mt-1.5 h-2.5" />
        </div>
        <div className="rounded-2xl bg-white p-4 mt-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <SkeletonText className="w-1/3" />
          <div className="flex items-center gap-2 mt-3">
            <SkeletonCircle className="w-8 h-8 shrink-0" />
            <SkeletonText className="w-2/3 h-2.5" />
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <SkeletonCircle className="w-8 h-8 shrink-0" />
            <SkeletonText className="w-1/2 h-2.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
