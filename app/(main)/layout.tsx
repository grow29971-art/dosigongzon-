import BottomNav from "@/app/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-warm-white overflow-x-hidden">
      <main className="pb-20 mx-auto w-full max-w-lg overflow-x-hidden">{children}</main>
      <BottomNav />
    </div>
  );
}
