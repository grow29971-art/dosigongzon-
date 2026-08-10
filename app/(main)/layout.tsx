import BottomNav from "@/app/components/BottomNav";
import WelcomeGate from "@/app/components/WelcomeGate";
import FeatureTourGate from "@/app/components/FeatureTourGate";
import AnnouncementModal from "@/app/components/AnnouncementModal";
import PushReconsentCard from "@/app/components/PushReconsentCard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // overflow-x-hidden은 map 페이지의 absolute positioning + 100dvh 계산을
  // 일부 안드로이드 기기에서 깨트리므로 루트에서는 적용하지 않음.
  // 가로 오버플로우 방지는 각 페이지 단위 컨테이너에서 처리.
  return (
    <div className="min-h-dvh bg-warm-white">
      <WelcomeGate />
      <FeatureTourGate />
      <AnnouncementModal />
      <PushReconsentCard />
      {/* 플로팅 네비(높이 58 + 하단 여백 10) 뒤로 콘텐츠가 가려지지 않도록 pb-24 */}
      <main className="pb-24 mx-auto w-full max-w-lg">{children}</main>
      <BottomNav />
    </div>
  );
}
