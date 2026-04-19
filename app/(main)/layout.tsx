import BottomNav from "@/app/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // overflow-x-hidden은 map 페이지의 absolute positioning + 100dvh 계산을
  // 일부 안드로이드 기기에서 깨트리므로 루트에서는 적용하지 않음.
  // 가로 오버플로우 방지는 각 페이지 단위 컨테이너에서 처리.
  return (
    <div className="min-h-dvh bg-warm-white">
      <main className="pb-20 mx-auto w-full max-w-lg">{children}</main>
      <BottomNav />
    </div>
  );
}
