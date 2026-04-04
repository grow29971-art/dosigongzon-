import BottomNav from "@/app/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-warm-white">
      <main className="pb-20 mx-auto w-full max-w-lg">{children}</main>
      <BottomNav />
    </div>
  );
}
